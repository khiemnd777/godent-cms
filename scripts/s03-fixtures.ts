import { SQL } from 'bun';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';
import type { S02Fixtures } from './s02-fixtures';

export interface S03Fixtures { tenants: {A:string;B:string;revocation:string}; legacyServiceId:string }
export async function fixturesS03() {
  if(!process.argv.includes('--local-s03')||!process.argv.includes('--synthetic-fixtures')||process.cwd()!==resolve(import.meta.dir,'..')) throw new Error('Explicit local S03 fixture scope required');
  const prior=JSON.parse(await readFile(resolve('.local/s02-fixtures.json'),'utf8')) as S02Fixtures;
  const fixtures:S03Fixtures={tenants:{A:'c3000000-0000-4000-8000-000000000001',B:'c3000000-0000-4000-8000-000000000002',
    revocation:'c3000000-0000-4000-8000-000000000003'},legacyServiceId:'c3000000-0000-4000-8000-000000000004'};
  const client=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1,connectionTimeout:3});
  try {
    await client.begin(async tx=>{
      await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
      for(const [label,tenant] of Object.entries(fixtures.tenants)) {
        const name=`S03 Synthetic ${label}`;
        await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${tenant},${name}) ON CONFLICT(id) DO NOTHING`;
        const existing=await tx`SELECT name FROM gcms_s02.tenant WHERE id=${tenant}`;
        if(existing[0]?.name!==name) throw new Error('S03 fixture tenant ownership mismatch');
        const labels=label==='B'?['B1','multiAB']:['A1','A2','multiAB'];
        for(const identityLabel of labels) {
          const user=prior.identities.find(item=>item.label===identityLabel);
          if(!user) throw new Error('Required retained synthetic identity absent');
          await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${tenant},${user.userId}) ON CONFLICT(tenant_id,user_id) DO NOTHING`;
        }
      }
      const admin=prior.identities.find(item=>item.label==='A1'); if(!admin) throw new Error('Synthetic actor absent');
      await tx`INSERT INTO gcms_s02.service_draft(tenant_id,id,title,body,updated_by)
        VALUES(${fixtures.tenants.A},${fixtures.legacyServiceId},'S03 retained plaintext example',${'<b>Literal markup</b>\nSecond line\n'},${admin.userId}) ON CONFLICT(tenant_id,id) DO NOTHING`;
    });
    const path=resolve('.local/s03-fixtures.json');
    if(await Bun.file(path).exists()) {
      if(JSON.stringify(JSON.parse(await readFile(path,'utf8')))!==JSON.stringify(fixtures)) throw new Error('Retained S03 manifest mismatch');
    } else await writeFile(path,JSON.stringify(fixtures,null,2)+'\n',{flag:'wx',mode:0o600});
    console.info('S03 owned synthetic tenants and legacy draft ready; S02 identities and resources retained.');
  } finally {await client.close();}
}
if(import.meta.main) fixturesS03().catch(()=>{console.error('S03 fixture setup failed; retained records preserved.');process.exitCode=1;});
