import {beforeAll,afterAll,describe,expect,test} from 'bun:test';
import {randomUUID} from 'node:crypto';
import {writeFile,rename} from 'node:fs/promises';
import {M5Harness} from './m5-support';
describe.skipIf(process.env.M5_INTEGRATION!=='1')('M5 real new-tenant policy before invitation handoff',()=>{
 const h=new M5Harness();beforeAll(async()=>{await h.setup(['PlatformOnly']);},30000);afterAll(async()=>{await h.close();});
 test('explicit zero quota is committed atomically with the new synthetic tenant and invitation',async()=>{
  const run=randomUUID(),name='M5 Provision Synthetic '+run,email=h.fixtures.identities.find(i=>i.label==='B1')!.email,manifest='.local/m5-provision-'+run+'.json';
  const ownership={owner:'GCMS-M5-PROVISION-v1',fixtureRun:h.fixtures.runId,run,name,stage:'intent-recorded',tenantId:null as string|null};
  await writeFile(manifest,JSON.stringify(ownership)+'\n',{mode:0o600,flag:'wx'});
  const r=await h.call<{tenant:{id:string;name:string};invitation:{id:string}}>('/api/platform/tenants','POST',{name,initialAdminEmail:email,initialQuotaPolicy:{mode:'enforced',contentItemsLimit:0,mediaBytesLimit:null}},'PlatformOnly');expect(r.status).toBe(201);expect(r.value.tenant.name).toBe(name);ownership.tenantId=r.value.tenant.id;ownership.stage='created';const tmp=manifest+'.tmp';await writeFile(tmp,JSON.stringify(ownership)+'\n',{mode:0o600,flag:'wx'});await rename(tmp,manifest);
  const rows=await h.owned(tx=>tx`SELECT t.name,s.mode,s.content_limit::integer AS content_limit,s.media_limit,s.version,(SELECT count(*)::integer FROM gcms_s02.invitation i WHERE i.tenant_id=t.id AND i.email=${email}) AS invitations FROM gcms_s02.tenant t JOIN gcms_m5.tenant_state s ON s.tenant_id=t.id WHERE t.id=${r.value.tenant.id}`);expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({name,mode:'enforced',content_limit:0,media_limit:null,version:1,invitations:1});
  expect((await h.call(`/api/platform/tenants/${r.value.tenant.id}/m5`,'GET',undefined,'PlatformOnly')).status).toBe(200);
  expect((await h.call(`/api/cms/tenants/${r.value.tenant.id}/m5/platform/export`,'GET',undefined,'PlatformOnly')).status).toBe(403);
  await h.record({kind:'provisioned-owned-tenant',id:r.value.tenant.id,name,quotaBeforeHandoff:true,commercialDefaultSelected:false,invitationId:r.value.invitation.id});
 });
});
