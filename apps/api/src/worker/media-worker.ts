import { SQL } from 'bun';
import { createHash, randomUUID } from 'node:crypto';
import { validateDatabaseUrl } from '../auth/policy';
import { DecoderSettlementUnknown, DockerMediaProcessor, RejectedImage, type MediaProcessor } from '../media/processor';
import { MediaStorage, readMediaStorageConfig } from '../media/storage';
import { writeMediaRecoveryReceipt, type MediaRecoveryWriter } from './media-recovery';

export interface ClaimedMediaJob {id:string;tenantId:string;assetId:string;kind:'process'|'purge';revision:number;fence:number}
type ProcessingMessage={kind:'process';originalKey:string;targetKey:string;bytes:number;checksum:string};
type PurgeMessage={kind:'purge';targets:string[]};
export class MediaWorker {
  private readonly client:SQL;readonly workerId=randomUUID();
  constructor(url:string,private readonly storage=new MediaStorage(readMediaStorageConfig()),private readonly processor:MediaProcessor=new DockerMediaProcessor(),private readonly recoveryWriter:MediaRecoveryWriter=writeMediaRecoveryReceipt) {
    this.client=new SQL(validateDatabaseUrl(url,'gcms_s07_worker'),{max:2,connectionTimeout:3,idleTimeout:60,maxLifetime:0});
  }
  async verifyRole() {
    const rows=await this.client`SELECT current_user AS name,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,
      pg_has_role(current_user,'gcms_s02_owner','MEMBER') AS owner_member,
      EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname IN ('gcms_s02','gcms_s02_auth','gcms_s04','gcms_s05','gcms_s07') AND n.nspowner=r.oid) AS owns_schema,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('gcms_s02','gcms_s02_auth','gcms_s04','gcms_s05','gcms_s07')
        AND c.relkind IN ('r','p') AND has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE')) AS table_access
      FROM pg_roles r WHERE rolname=current_user`;
    const r=rows[0];if(!r || r.name!=='gcms_s07_worker' || r.rolsuper || r.rolbypassrls || r.rolcreaterole || r.rolcreatedb || r.owner_member || r.owns_schema || r.table_access) throw new Error('Unsafe media worker role');
  }
  async claim(tenant:string):Promise<ClaimedMediaJob|null> {
    if(!/^[a-f0-9-]{36}$/.test(tenant)) throw new Error('Invalid explicit media worker scope');
    const rows=await this.client`SELECT gcms_s07.worker_claim(${tenant},${this.workerId}) AS claim`;
    return rows[0].claim as ClaimedMediaJob|null;
  }
  async process(claim:ClaimedMediaJob):Promise<'completed'|'failed'|'skipped'> {
    const connection=await this.client.reserve(),lockIdentity=`${claim.tenantId}/${claim.assetId}`;let locked=false;
    try {
      const locks=await connection`SELECT pg_try_advisory_lock(hashtextextended(${lockIdentity},7517)) AS locked`;
      locked=locks[0].locked===true;if(!locked) return 'skipped';
      const rows=await connection`SELECT gcms_s07.worker_start(${claim.tenantId},${claim.id},${this.workerId},${claim.fence}) AS message`;
      const message=rows[0].message as ProcessingMessage|PurgeMessage|null;if(!message) return 'skipped';
      let result:Record<string,unknown>={outcome:'retry',failureCode:'storage_failure'};let settlementUnknown:DecoderSettlementUnknown|undefined;
      try {
        if(message.kind==='process') {
          const original=await this.storage.get(message.originalKey,message.bytes);
          if(createHash('sha256').update(original).digest('hex')!==message.checksum) result={outcome:'retry',failureCode:'integrity_failure'};
          else {
            result={outcome:'retry',failureCode:'processor_failure'};
            const decoded=await this.processor.process(original);
            result={outcome:'retry',failureCode:'storage_failure'};
            await this.storage.put(message.targetKey,decoded.body,'image/webp');
            result={outcome:'success',detectedType:decoded.detectedType,sourceWidth:decoded.sourceWidth,sourceHeight:decoded.sourceHeight,width:decoded.width,height:decoded.height,bytes:decoded.bytes};
          }
        } else {
          // Hold the asset advisory lock until each actual DELETE and HEAD settles.
          // This excludes late process writes from a completed purge receipt.
          for(const key of message.targets) await this.storage.deleteVerified(key);
          result={outcome:'success'};
        }
      } catch(error) {
        if(error instanceof RejectedImage) result={outcome:'rejected'};
        if(error instanceof DecoderSettlementUnknown) {settlementUnknown=error;result={outcome:'settlement_unknown'};}
      }
      const finish=await connection`SELECT gcms_s07.worker_finish(${claim.tenantId},${claim.id},${this.workerId},${claim.fence},${JSON.stringify(result)}::text::jsonb) AS applied`;
      // Keep the job visibly unsuccessful and stop this batch when daemon state is unknown.
      // An operator must resolve the labelled container before resuming the worker.
      if(settlementUnknown) {
        let receiptPath:string|null=null;
        // The SQL latch is committed before receipt I/O. Receipt failure never resumes native work.
        try {receiptPath=await this.recoveryWriter({tenantId:claim.tenantId,assetId:claim.assetId,jobId:claim.id,fence:claim.fence,workerId:this.workerId},settlementUnknown);}catch{/* The database latch remains set; report a missing receipt without exposing filesystem details. */}
        settlementUnknown.recovery=Object.freeze({blocked:true,receiptPath});
        throw settlementUnknown;
      }
      return finish[0].applied?'completed':'failed';
    } finally {
      try {if(locked) await connection`SELECT pg_advisory_unlock(hashtextextended(${lockIdentity},7517))`;}
      finally {connection.release();}
    }
  }
  async runOnce(tenant:string,limit=10) {
    if(!Number.isSafeInteger(limit)||limit<1||limit>10) throw new Error('Invalid media worker batch');
    await this.verifyRole();const results:string[]=[];
    for(let i=0;i<limit;i++) {const claim=await this.claim(tenant);if(!claim) break;results.push(await this.process(claim));}
    return {claimed:results.length,completed:results.filter(v=>v==='completed').length,failed:results.filter(v=>v==='failed').length,skipped:results.filter(v=>v==='skipped').length};
  }
  async close() {this.storage.close();await this.client.close();}
}
