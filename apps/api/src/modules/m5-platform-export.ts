import {createHash,randomUUID} from 'node:crypto';
import {BadRequestException} from '@nestjs/common';
import {sql} from 'drizzle-orm';
import type {M5ExportManifest} from '../contracts/m5-platform';
import type {SessionActor} from '../database';
import type {MediaStorage} from '../media/storage';
import {parseIdentifier,type PrivateRequest} from './request-security';
import type {M5PlatformService} from './m5-platform.service';
import {streamZip,type ZipEntry} from './m5-platform-zip';

export const M5_EXPORT_DATASETS=['site','services','legacy_publications','legacy_heads','editorial_revisions','publication_heads','publication_history','content','content_revisions','content_publications','content_permissions','service_references','service_publication_references','builder_identities','builder_variants','builder_revisions','builder_publications','builder_permissions','leads','lead_history','recipient_settings','media_metadata','media_permissions','media_derivatives','domains'] as const;
type ExportRow={recordKey:string;version:unknown;exportedAt:string;data:unknown};
type MediaRow={assetId:string;revision:number;state:string;bytes:number;checksum:string;eligible:boolean};
type Target={key:string;bytes:number;checksum?:string};
function stopped(signal?:AbortSignal){signal?.throwIfAborted();}
async function* json(value:unknown){yield Buffer.from(JSON.stringify(value)+'\n');}
export class M5PlatformExport {
 constructor(private readonly platform:M5PlatformService,private readonly storage:Pick<MediaStorage,'get'>){}
 async create(request:PrivateRequest,tenant:string,query:Record<string,unknown>,signal?:AbortSignal):Promise<AsyncIterable<Uint8Array>> {
  const t=parseIdentifier(tenant);if(Object.keys(query).some(k=>k!=='includeMedia')||(query.includeMedia!==undefined&&query.includeMedia!=='true'&&query.includeMedia!=='false'))throw new BadRequestException();const includeMedia=query.includeMedia==='true',actor=await this.platform.actor(request);await this.authorize(actor,t);stopped(signal);return streamZip(this.entries(actor,t,includeMedia,signal));
 }
 private async authorize(actor:SessionActor,t:string){return this.platform.db.withReadTenant(actor,t,async tx=>{await tx.execute(sql`SELECT gcms_m5.require_read(${t})`);});}
 private async batch(actor:SessionActor,t:string,dataset:string,after:string|null):Promise<ExportRow[]>{return this.platform.db.withReadTenant(actor,t,async tx=>{const rows=await tx.execute(sql`SELECT gcms_m5.export_batch(${t},${dataset},${after},25) AS result`);if(!Array.isArray(rows[0]?.result))throw new Error('Invalid export batch');return rows[0].result as ExportRow[];});}
 private async target(actor:SessionActor,t:string,assetId:string,revision:number,variant:string):Promise<Target|null>{return this.platform.db.withReadTenant(actor,t,async tx=>{const rows=await tx.execute(sql`SELECT gcms_m5.export_media_target(${t},${assetId},${revision},${variant}) AS result`);return rows[0]?.result as Target|null;});}
 private async* entries(actor:SessionActor,t:string,includeMedia:boolean,signal?:AbortSignal):AsyncGenerator<ZipEntry>{
  const exportId=randomUUID(),startedAt=new Date().toISOString(),datasets:{name:string;records:number}[]=[],exclusions:{assetId:string;variant:string;reason:string}[]=[];let included=0,excluded=0;
  // Only bounded exclusion batches are kept; the streamed JSONL is itself evidence.
  yield {name:'export-info.json',body:json({schemaVersion:1,exportId,tenantId:t,startedAt,complete:false,consistency:'bounded-current-authorized-batches',restoreBackup:false})};
  for(const name of M5_EXPORT_DATASETS){const summary={name,records:0};datasets.push(summary);const fetchBatch=(after:string|null)=>this.batch(actor,t,name,after);
   async function* records(){let after:string|null=null;while(true){stopped(signal);const rows=await fetchBatch(after);if(!rows.length)break;for(const row of rows){stopped(signal);if(typeof row.recordKey!=='string'||(after!==null&&row.recordKey<=after))throw new Error('Invalid export continuation');after=row.recordKey;summary.records++;yield Buffer.from(JSON.stringify(row)+'\n');}if(rows.length<25)break;}}
   yield {name:`data/${name}.jsonl`,body:records()};
  }
  if(includeMedia){let after:string|null=null;while(true){stopped(signal);const batch:MediaRow[]=await this.platform.db.withReadTenant(actor,t,async tx=>{const rows=await tx.execute(sql`SELECT gcms_m5.export_media_batch(${t},${after},25) AS result`);if(!Array.isArray(rows[0]?.result))throw new Error('Invalid media export batch');return rows[0].result as MediaRow[];});if(!batch.length)break;
   for(const media of batch){if(after!==null&&media.assetId<=after)throw new Error('Invalid media continuation');after=media.assetId;for(const variant of ['original','cover']){stopped(signal);const target=await this.target(actor,t,media.assetId,media.revision,variant);if(!target){excluded++;exclusions.push({assetId:media.assetId,variant,reason:'no-current-download-right-or-eligible-object'});continue;}
     // One bounded media object at a time. Storage failure aborts the export.
     const body=await this.storage.get(target.key,target.bytes);if(target.checksum&&createHash('sha256').update(body).digest('hex')!==target.checksum)throw new Error('Export media integrity failure');
     const current=await this.target(actor,t,media.assetId,media.revision,variant);if(!current||current.key!==target.key||current.bytes!==target.bytes){excluded++;exclusions.push({assetId:media.assetId,variant,reason:'download-right-changed-before-delivery'});continue;}
     stopped(signal);included++;yield {name:`media/${media.assetId}/r${media.revision}/${variant}${variant==='cover'?'.webp':'.bin'}`,body:(async function*(){yield body;})()};
    }}
   if(exclusions.length){const rows=exclusions.splice(0);yield {name:`media-exclusions/batch-${after}.jsonl`,body:(async function*(){for(const row of rows)yield Buffer.from(JSON.stringify(row)+'\n');})()};}if(batch.length<25)break;
  }}
  stopped(signal);await this.authorize(actor,t);
  const manifest:M5ExportManifest={schemaVersion:1,exportId,tenantId:t,startedAt,completedAt:new Date().toISOString(),complete:true,consistency:'bounded-current-authorized-batches',restoreBackup:false,includeMedia,datasets,media:{included,excluded,exclusionsFile:'media-exclusions/*.jsonl'},limits:['Business export; not an operational restore backup.','Records can represent different instants. Current rights and lead expiry are checked for each batch.','Only currently downloadable media originals and current derivatives are included when requested.','Downloaded bytes cannot be recalled. No export file is retained on this server.','ZIP32 technical bounds: each file/archive is below 4 GiB and fewer than 65535 entries; overflow aborts without a completion manifest.']};
  yield {name:'manifest.json',body:json(manifest)};
 }
}
