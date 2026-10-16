import {afterAll,beforeAll,describe,expect,test} from 'bun:test';
import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {createS02Database,postgresCode,type S02Database} from '../src/database';
import {createS02Auth} from '../src/auth';
import {loadRuntimeEnvironment} from '../src/auth/runtime-environment';
import {readM5Fixtures} from '../../../scripts/m5-fixtures';
import {openPasswordSession} from '../../../scripts/s02-fixtures';

describe.skipIf(process.env.M5_INTEGRATION!=='1')('M5 direct restricted-role domain attestation boundary',()=>{
 let db:S02Database,session:Awaited<ReturnType<typeof openPasswordSession>>,tenant:string;
 beforeAll(async()=>{
  const fixtures=await readM5Fixtures();if(fixtures.status!=='complete')throw new Error('Complete positively owned M5 fixtures required');
  const current=fixtures.tenants.find(t=>t.label==='A')!,identity=fixtures.identities.find(i=>i.label==='A1')!;
  const env=(await loadRuntimeEnvironment()).api;db=createS02Database(env);const auth=createS02Auth(db,env);session=await openPasswordSession(auth,identity);tenant=current.id;
  await db.withTenant(session.actor,tenant,async tx=>{const rows=await tx.execute(sql`SELECT name,status FROM gcms_s02.tenant WHERE id=${tenant}`);expect(rows[0]).toMatchObject({name:current.name,status:'active'});});
 },30000);
 afterAll(async()=>{await db?.close();});
 async function denied(action:Parameters<S02Database['withTenant']>[2]){
  let code:string|undefined;
  try{await db.withTenant(session.actor,tenant,async(tx,current)=>{await action(tx,current);throw new Error('RESTRICTED_ROLE_ACCEPTED');});}
  catch(error){code=postgresCode(error)??(error instanceof Error?error.message:'UNKNOWN');}
  expect(code).toBe('42501');
 }
 test('matching forged synthetic JSON cannot verify an unlisted host',async()=>{
  const bindingId=randomUUID(),host=`unattested-${bindingId}.localhost`;
  await denied(async tx=>{
   await tx.execute(sql`SELECT gcms_m5.domain_command(${tenant},NULL,${JSON.stringify({action:'register',operationId:bindingId,host})}::text::jsonb,NULL)`);
   const proof={bindingId,tenantId:tenant,siteId:tenant,host,generation:1,adapter:'synthetic-local',tls:'valid',origin:`http://${host}:5892`,verifiedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()};
   await tx.execute(sql`SELECT gcms_m5.domain_command(${tenant},${bindingId},${JSON.stringify({action:'verify-local',operationId:randomUUID(),expectedVersion:1})}::text::jsonb,${JSON.stringify(proof)}::text::jsonb)`);
  });
 });
 test('omitting JSON evidence cannot mint proof without owner enrollment',async()=>{
  const bindingId=randomUUID(),host=`unattested-${bindingId}.localhost`;
  await denied(async tx=>{
   await tx.execute(sql`SELECT gcms_m5.domain_command(${tenant},NULL,${JSON.stringify({action:'register',operationId:bindingId,host})}::text::jsonb,NULL)`);
   await tx.execute(sql`SELECT gcms_m5.domain_command(${tenant},${bindingId},${JSON.stringify({action:'verify-local',operationId:randomUUID(),expectedVersion:1})}::text::jsonb,NULL)`);
  });
 });
 test('old defaulted command body is not an executable bypass',async()=>{
  await denied(tx=>tx.execute(sql`SELECT gcms_m5.domain_command_before_attestation(${tenant},NULL,${JSON.stringify({action:'register',operationId:randomUUID(),host:'forged.localhost'})}::text::jsonb)`));
 });
 test('runtime role cannot read or enroll the owner attestation capability',async()=>{
  await denied(tx=>tx.execute(sql`SELECT id FROM gcms_m5.local_domain_attestation WHERE tenant_id=${tenant}`));
  await denied(tx=>tx.execute(sql`SELECT gcms_m5.enroll_local_domain(${tenant},'forged.localhost',clock_timestamp()+interval '2 hours')`));
 });
});
