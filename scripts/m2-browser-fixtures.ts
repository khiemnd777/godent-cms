import { randomBytes,randomUUID } from 'node:crypto';
import { lstat,readFile,writeFile } from 'node:fs/promises';
import { SQL } from 'bun';
import { createS02Database } from '../apps/api/src/database';
import { createS02Auth } from '../apps/api/src/auth';
import { loadRuntimeEnvironment } from '../apps/api/src/auth/runtime-environment';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

async function main() {
 if(!process.argv.includes('--local-m2')||!process.argv.includes('--synthetic-fixtures')||Bun.version!=='1.4.3')throw new Error('Explicit local fixtures required');
 const path='.local/m2-browser-identities.json',fixture=JSON.parse(await readFile('.local/m2-fixtures.json','utf8'));
 if(fixture.owner!=='GCMS-M2-UI-v1'||fixture.status!=='complete')throw new Error('Owned M2 fixtures required');
 if(!await Bun.file(path).exists()) {
  const identities=['A1','A2','B1'].map(label=>({label,userId:randomUUID(),email:`m2-${fixture.runId}-${label.toLowerCase()}@synthetic.example.test`,password:randomBytes(24).toString('base64url')}));
  identities.push(fixture.identities.find((i:{label:string})=>i.label==='PlatformOnly'));
  await writeFile(path,JSON.stringify({owner:'GCMS-M2-BROWSER-v1',runId:fixture.runId,identities},null,2)+'\n',{flag:'wx',mode:0o600});
 }
 const metadata=await lstat(path);if(!metadata.isFile()||metadata.isSymbolicLink()||(metadata.mode&0o777)!==0o600)throw new Error('Unsafe manifest');
 const manifest=JSON.parse(await readFile(path,'utf8'));if(manifest.owner!=='GCMS-M2-BROWSER-v1'||manifest.runId!==fixture.runId||manifest.identities.length!==4)throw new Error('Manifest mismatch');
 const runtime=await loadRuntimeEnvironment(),db=createS02Database(runtime.api),identity=createS02Auth(db,runtime.api);
 const owner=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1,connectionTimeout:3});
 try {
  const context=await identity.auth.$context;
  for(const item of manifest.identities.filter((i:{label:string})=>i.label!=='PlatformOnly')) {
   if(!/^m2-[a-f0-9-]{36}-(a1|a2|b1)@synthetic\.example\.test$/.test(item.email)||!item.email.includes(fixture.runId))throw new Error('Unexpected new actor');
   const existing=await context.internalAdapter.findUserByEmail(item.email,{includeAccounts:true});
   if(existing) {if(existing.user.id!==item.userId||!existing.accounts.some(a=>a.providerId==='credential'))throw new Error('Owned actor mismatch');}
   else {
    const password=await context.password.hash(item.password);
    const user=await context.internalAdapter.createUser({id:item.userId,name:`M2 Synthetic ${item.label}`,email:item.email,emailVerified:true,platformAdmin:false},{method:'email-password'});
    if(user.id!==item.userId)throw new Error('Owned identity mismatch');
    await context.internalAdapter.createAccount({userId:user.id,accountId:user.id,providerId:'credential',password});
   }
   const tenant=fixture.tenants.find((t:{label:string})=>t.label===(item.label==='B1'?'B':'A'));
   await owner.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${tenant.id},${item.userId}) ON CONFLICT DO NOTHING`;});
  }
  console.info(JSON.stringify({status:'PASS',runId:fixture.runId,newOwnedBrowserAccounts:3,retainedCredentialsChanged:false,manifest:path}));
 }finally{await db.close();await owner.close();}
}
if(import.meta.main)void main().catch(()=>{console.error('M2 browser fixture initialization failed; details redacted.');process.exitCode=1;});
