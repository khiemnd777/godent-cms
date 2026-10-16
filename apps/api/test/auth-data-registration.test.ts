import { SQL } from 'bun';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { createS02Database } from '../src/database';
import { createS02Auth } from '../src/auth';
import { validateDatabaseUrl } from '../src/auth/policy';

const integration=process.env.S02_INTEGRATION==='1'?describe:describe.skip;
integration('S02 invited identity registration and email ownership',()=>{
  let db:ReturnType<typeof createS02Database>; let identity:ReturnType<typeof createS02Auth>; let owner:SQL;
  const runId=crypto.randomUUID(); const tenantId=crypto.randomUUID(); const email=`register-${runId}@s02.example.test`;
  const token=randomBytes(32).toString('base64url'); const password=randomBytes(24).toString('base64url');
  const request=(path:string,body?:unknown)=>identity.handler(new Request(`http://127.0.0.1:5890/api/auth${path}`,{
    method:body===undefined?'GET':'POST',headers:{origin:'http://127.0.0.1:5891',...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)}));
  beforeAll(async()=>{
    db=createS02Database();identity=createS02Auth(db);owner=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1});
    await owner.begin(async tx=>{
      await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
      await tx`insert into gcms_s02.tenant(id,name) values(${tenantId},${`S02 registration ${runId}`})`;
      await tx`insert into gcms_s02.invitation(id,tenant_id,email,token_hash,expires_at,created_by)
        values(${crypto.randomUUID()},${tenantId},${email},${createHash('sha256').update(token).digest('hex')},now()+interval '24 hours','10000000-0000-4000-8000-000000000005')`;
    });
  });
  afterAll(async()=>{await db?.close();await owner?.close();});
  it('rejects public signup, invalid invitation and client-supplied identity/role substitution',async()=>{
    expect((await request('/sign-up/email',{email,password,name:'Synthetic'})).status).toBe(404);
    expect((await request('/invitation-register',{token:randomBytes(32).toString('base64url'),password,name:'Synthetic'})).status).toBe(400);
    expect((await request('/invitation-register',{token,password,name:'Synthetic',email:'other@s02.example.test',platformAdmin:true})).status).toBe(400);
    expect((await request('/invitation-register',null)).status).toBe(400);
    expect((await request('/invitation-register',{token,password,name:'x'.repeat(70000)})).status).toBe(413);
  });
  it('creates an unverified credential identity, denies login before verification, and verifies only the captured address',async()=>{
    const directory=resolve('.local/s02-mail'); const before=new Set(await readdir(directory).catch(()=>[]));
    expect((await request('/invitation-register',{token,password,name:'Invited synthetic identity'})).status).toBe(200);
    const users=await db.authDb.execute(sql`select id,email,email_verified,platform_admin from gcms_s02_auth."user" where email=${email}`);
    expect(users).toHaveLength(1); expect(users[0].email_verified).toBe(false); expect(users[0].platform_admin).toBe(false);
    const signIn=await request('/sign-in/email',{email,password,rememberMe:false}); expect(signIn.status).toBe(403);
    let captured:string|undefined;
    for(const file of (await readdir(directory)).filter(file=>!before.has(file))) {
      const value=JSON.parse(await readFile(resolve(directory,file),'utf8')) as {to:string;type:string;url:string};
      if(value.to===email && value.type==='email-verification') captured=value.url;
    }
    expect(captured).toBeDefined();
    const verified=await identity.handler(new Request(captured!));
    expect(verified.status).toBe(302);
    const after=await db.authDb.execute(sql`select email_verified from gcms_s02_auth."user" where email=${email}`);
    expect(after[0].email_verified).toBe(true);
    const loggedIn=await request('/sign-in/email',{email,password,rememberMe:false});expect(loggedIn.status).toBe(200);
    expect((await loggedIn.json() as {token?:unknown}).token).toBeUndefined();
    const memberships=await owner.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');return tx`select * from gcms_s02.membership where user_id=${String(users[0].id)}`;});
    expect(memberships).toHaveLength(0); // Registration never accepts or grants the invitation.
  });
});
