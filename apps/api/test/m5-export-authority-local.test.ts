import { beforeAll,afterAll,describe,expect,test } from 'bun:test';
import { M5Harness } from './m5-support';
import { M5PlatformService } from '../src/modules/m5-platform.service';
import { M5PlatformExport } from '../src/modules/m5-platform-export';
import { MediaStorage,readMediaStorageConfig } from '../src/media/storage';
import type { PrivateRequest } from '../src/modules/request-security';
import { safeError } from '../src/errors';
describe.skipIf(process.env.M5_INTEGRATION!=='1')('M5 actual SQL export authority across streamed batches',()=>{
 const h=new M5Harness();let storage:MediaStorage;
 beforeAll(async()=>{await h.setup(['A1','A2']);storage=new MediaStorage(readMediaStorageConfig());},30000);
 afterAll(async()=>{storage?.close();await h.close();});
 test('revoking the current exporter between datasets aborts without completion; regrant does not resume the old download',async()=>{
  const t=h.tenant(),a2=h.fixtures.identities.find(i=>i.label==='A2')!,client=h.clients.get('A2')!;
  const request:PrivateRequest={method:'GET',originalUrl:`/api/cms/tenants/${t.id}/m5/platform/export`,headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891',cookie:client.headers.get('cookie')!}},exporter=new M5PlatformExport(new M5PlatformService(h.db,h.identity),storage);
  const bytes=await exporter.create(request,t.id,{includeMedia:'true'}),iterator=bytes[Symbol.asyncIterator](),chunks:Buffer[]=[];let revoked=false,failure:unknown;
  try{
   for(let i=0;i<100;i++){const next=await iterator.next();if(next.done)throw new Error('Export completed before the controlled inter-batch revocation');chunks.push(Buffer.from(next.value));if(Buffer.concat(chunks).includes(Buffer.from('data/services.jsonl'))){expect((await h.call(`/api/tenants/${t.id}/members/${a2.userId}`,'DELETE')).status).toBe(200);revoked=true;break;}}
   expect(revoked).toBe(true);
   try{for await(const chunk of {[Symbol.asyncIterator]:()=>iterator})chunks.push(Buffer.from(chunk));}catch(error){failure=error;}
   expect(safeError(failure).statusCode).toBe(403);const prefix=Buffer.concat(chunks);expect(prefix.includes(Buffer.from('manifest.json'))).toBe(false);expect(prefix.includes(Buffer.from([0x50,0x4b,0x05,0x06]))).toBe(false);
   let freshFailure:unknown;try{await exporter.create(request,t.id,{});}catch(error){freshFailure=error;}expect(safeError(freshFailure).statusCode).toBe(403);
  }finally{
   await iterator.return?.();
   if(revoked)await h.owned(async tx=>{const actual=await tx`SELECT name,status FROM gcms_s02.tenant WHERE id=${t.id}`;if(actual[0]?.name!==t.name||actual[0]?.status!=='active')throw new Error('Only owned active M5 membership can be restored');await tx`UPDATE gcms_s02.membership SET status='active',updated_at=clock_timestamp() WHERE tenant_id=${t.id} AND user_id=${a2.userId} AND status='revoked'`;});
  }
  const restored=await exporter.create(request,t.id,{}),restoredIterator=restored[Symbol.asyncIterator]();expect((await restoredIterator.next()).done).toBe(false);await restoredIterator.return?.();
  await h.record({kind:'export-current-authority',revokedBetweenDatasets:true,deniedBeforeCompletion:true,finalManifestEmitted:false,oldDownloadResumed:false,newOwnedMembershipRestored:true});
 });
});
