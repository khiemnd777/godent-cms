import { SQL } from 'bun';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createS02Database } from '../apps/api/src/database';
import { createS02Auth } from '../apps/api/src/auth';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import { loadRuntimeEnvironment } from '../apps/api/src/auth/runtime-environment';
import { PublicationServiceOperations } from '../apps/api/src/modules/publication.service';
import { legacyDocument } from '../apps/api/src/contracts/content';
import type { PrivateRequest } from '../apps/api/src/modules/request-security';
import { openFixtureSession, type S02Fixtures } from './s02-fixtures';

export interface S04Fixtures { tenantId:string;tenantSlug:string;serviceId:string;serviceSlug:string;publicationId:string }
export async function fixturesS04() {
  if(!process.argv.includes('--local-s04')||!process.argv.includes('--synthetic-fixtures')||process.cwd()!==resolve(import.meta.dir,'..')) throw new Error('Explicit local S04 fixture scope required');
  const path=resolve('.local/s04-fixtures.json');
  // This UI tenant is never used by API stress tests. Repeated setup is read-only after validation.
  const tenantId='c4000000-0000-4000-8000-000000000001',tenantSlug='s04-synthetic-ui',serviceSlug='tu-van';
  const owner=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1,connectionTimeout:3});
  const previous=await Bun.file(path).exists()?JSON.parse(await readFile(path,'utf8')) as S04Fixtures:null;
  try {
    if(previous) {
      if(previous.tenantId!==tenantId||previous.tenantSlug!==tenantSlug||previous.serviceSlug!==serviceSlug) throw new Error('Existing S04 manifest mismatch');
      const rows=await owner.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');return tx`SELECT t.name,p.snapshot_id FROM gcms_s02.tenant t
        JOIN gcms_s02.publication_pointer p ON p.tenant_id=t.id WHERE t.id=${tenantId} AND p.service_id=${previous.serviceId}`;});
      if(rows[0]?.name!=='S04 Synthetic UI'||rows[0]?.snapshot_id!==previous.publicationId) throw new Error('Existing S04 source mismatch');
      console.info('S04 UI fixtures retained and validated; no counters or records reset.');return previous;
    }
    const prior=JSON.parse(await readFile('.local/s02-fixtures.json','utf8')) as S02Fixtures;
    await owner.begin(async tx=>{
      await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
      const collision=await tx`SELECT id FROM gcms_s02.tenant WHERE id=${tenantId}`;
      if(collision.length) throw new Error('S04 fixture collision without manifest; inspect before recovery');
      await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${tenantId},'S04 Synthetic UI')`;
      for(const label of ['A1','A2','multiAB']) {
        const identity=prior.identities.find(i=>i.label===label);if(!identity) throw new Error('Retained synthetic identity unavailable');
        await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${tenantId},${identity.userId})`;
      }
    });
    const runtime=await loadRuntimeEnvironment();const db=createS02Database({...process.env,...runtime.api});const identity=createS02Auth(db);
    try {
      const signed=await openFixtureSession(identity,'A1');const service=new PublicationServiceOperations(db,identity);
      
      const request:PrivateRequest={method:'PUT',originalUrl:'',headers:{cookie:signed.headers.get('cookie')??'',origin:'http://127.0.0.1:5891',
        'content-type':'application/json','x-csrf-token':identity.csrfToken(signed.actor)}};
      const site=await service.saveSite(request,tenantId,{slug:tenantSlug,name:'Phòng khám minh họa S04',footer:{intro:'Nội dung thử nghiệm tổng hợp.',body:legacyDocument('Liên hệ tư vấn')},expectedVersion:0});
      const draft=await service.create({...request,method:'POST'},tenantId,{slug:serviceSlug,title:'Tư vấn nha khoa',summary:'Thông tin dịch vụ minh họa cho kiểm chứng local.',
        body:legacyDocument('Tìm hiểu thông tin dịch vụ và gửi yêu cầu để phòng khám liên hệ tư vấn.'),seo:{title:'Tư vấn nha khoa',description:'Dịch vụ minh họa tổng hợp.'}});
      const published=await service.publish({...request,method:'POST'},tenantId,draft.id,{expectedDraftVersion:draft.draftVersion,expectedPublicationVersion:0,expectedSiteVersion:site.version,requestKey:randomUUID()});
      const fixtures:S04Fixtures={tenantId,tenantSlug,serviceId:draft.id,serviceSlug,publicationId:published.publicationId};
      await writeFile(path,JSON.stringify(fixtures,null,2)+'\n',{flag:'wx',mode:0o600});
      console.info('S04 new UI tenant and published synthetic VI source ready; API stress tests use separate new tenants.');return fixtures;
    } finally {await db.close();}
  } finally {await owner.close();}
}
if(import.meta.main) fixturesS04().catch(()=>{console.error('S04 fixture setup failed; details redacted, inspect owned rows before retry.');process.exitCode=1;});
