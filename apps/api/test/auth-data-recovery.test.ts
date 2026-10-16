import { SQL, type TransactionSQL } from 'bun';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { createS02Database } from '../src/database';
import { createS02Auth } from '../src/auth';
import { Auth001Harness } from './auth-001-support';
import { openPasswordSession } from '../../../scripts/s02-fixtures';

const integration = process.env.AUTH_001_INTEGRATION === '1' ? describe : describe.skip;
integration('AUTH-001 actual password recovery and session lifecycle', () => {
  let h: Auth001Harness;
  let db: ReturnType<typeof createS02Database>;
  let identity: ReturnType<typeof createS02Auth>;
  let owner: SQL;
  let signed: Awaited<ReturnType<typeof openPasswordSession>>;
  async function ownerAction<T>(action: (tx: TransactionSQL)=>Promise<T>) {
    return owner.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');return action(tx);});
  }
  beforeAll(async()=>{
    h=new Auth001Harness(); await h.ready(); db=h.db; identity=h.identity;
    owner=h.owner;
    signed=await h.signIn('recovery');
  },30000);
  afterAll(async()=>{await signed?.call('/sign-out',{}); await db?.close(); await owner?.close();});
  async function resetMail() {
    const directory=resolve(process.cwd(),'.local/s02-mail');
    const before=new Set(await readdir(directory).catch(()=>[]));
    const response=await signed.call('/request-password-reset',{email:signed.fixture.email,redirectTo:'http://127.0.0.1:5891/reset-password'});
    expect(response.status).toBe(200);
    const added=(await readdir(directory)).filter(name=>!before.has(name));
    for(const name of added) {
      const mail=JSON.parse(await readFile(resolve(directory,name),'utf8')) as {to:string;type:string;url:string};
      if(mail.to===signed.fixture.email && mail.type==='password-reset') return {token:new URL(mail.url).pathname.split('/').at(-1)!,body:await response.json()};
    }
    throw new Error('Expected private local reset capture missing');
  }
  it('uses a generic reset response, consumes one token atomically, revokes every session, and returns to password-only login',async()=>{
    const prior=new Headers(signed.headers);
    const second=await h.signIn('recovery');
    const unknown=await signed.call('/request-password-reset',{email:'unknown@s02.example.test',redirectTo:'http://127.0.0.1:5891/reset-password'});
    expect(unknown.status).toBe(200);
    const captured=await resetMail();
    expect(await unknown.json()).toEqual(captured.body);
    const expiry=await ownerAction(tx=>tx`select expires_at-created_at as ttl,extract(epoch from expires_at-created_at)::integer as seconds
      from gcms_s02_auth.verification where identifier=${`reset-password:${captured.token}`}`);
    expect(expiry[0].seconds).toBeGreaterThanOrEqual(1799); expect(expiry[0].seconds).toBeLessThanOrEqual(1800);
    const oldPassword=signed.fixture.password,newPassword=randomBytes(24).toString('base64url');
    const account=h.account('recovery') as typeof signed.fixture & { pendingPassword?: string };
    account.pendingPassword=newPassword;
    await writeFile('.local/auth-001-data-fixtures.json',JSON.stringify(h.fixtures,null,2)+'\n',{mode:0o600});
    const resets=await Promise.all([signed.call('/reset-password',{token:captured.token,newPassword}),
      second.call('/reset-password',{token:captured.token,newPassword})]);
    expect(resets.map(item=>item.status).sort()).toEqual([200,400]);
    account.password=newPassword;delete account.pendingPassword;
    await writeFile('.local/auth-001-data-fixtures.json',JSON.stringify(h.fixtures,null,2)+'\n',{mode:0o600});
    expect(await identity.currentSession(prior)).toBeNull();
    expect(await identity.currentSession(second.headers)).toBeNull();
    expect((await signed.call('/reset-password',{token:captured.token,newPassword:signed.fixture.password})).status).toBe(400);
    await Bun.sleep(11000); // Respect the unchanged built-in authentication budget.
    expect((await signed.call('/sign-in/email',{email:signed.fixture.email,password:oldPassword,rememberMe:false})).status).toBe(401);
    const login=await signed.call('/sign-in/email',{email:signed.fixture.email,password:newPassword,rememberMe:false});
    expect(login.status).toBe(200);
    expect((await login.json() as {twoFactorRedirect?:boolean}).twoFactorRedirect).toBeUndefined();
  },45000);
  it('rejects expired reset tokens without revoking an existing valid session',async()=>{
    const captured=await resetMail();
    await ownerAction(tx=>tx`update gcms_s02_auth.verification set expires_at=now()-interval '1 second' where identifier=${`reset-password:${captured.token}`}`);
    expect((await signed.call('/reset-password',{token:captured.token,newPassword:signed.fixture.password})).status).toBe(400);
    expect(await identity.currentSession(signed.currentHeaders())).not.toBeNull();
  });
  it('rejects wrong passwords and all obsolete reauthentication fields',async()=>{
    signed=await h.signIn('recovery');
    await expect(identity.reauthenticate(signed.headers,{password:'incorrect-password'})).rejects.toThrow();
    for(const extra of [{code:'123456'},{backupCode:'obsolete'}]) {
      await expect(identity.reauthenticate(signed.headers,{password:signed.fixture.password,...extra})).rejects.toThrow();
    }
  });
  it('requires reauthentication after five minutes and keeps the eight-hour absolute session boundary',async()=>{
    await Bun.sleep(11000);
    signed=await h.signIn('recovery');
    await ownerAction(tx=>tx`update gcms_s02_auth.session set created_at=now()-interval '6 minutes' where id=${signed.actor.sessionId}`);
    await expect(identity.requireRecent(signed.actor)).rejects.toThrow();
    const reauth=await identity.reauthenticate(signed.headers,{password:signed.fixture.password});
    expect(reauth.expiresAt.getTime()-Date.now()).toBeGreaterThan(290000);
    await expect(identity.requireRecent(signed.actor)).resolves.toBeUndefined();
    await ownerAction(tx=>tx`update gcms_s02_auth.reauth_grant set expires_at=now()-interval '1 second' where session_id=${signed.actor.sessionId}`);
    await expect(identity.requireRecent(signed.actor)).rejects.toThrow();
    await ownerAction(tx=>tx`update gcms_s02_auth.session set created_at=now()-interval '8 hours 1 minute',expires_at=now()+interval '1 hour' where id=${signed.actor.sessionId}`);
    expect(await identity.currentSession(signed.headers)).toBeNull();
    await expect(db.withActor(signed.actor,async()=>true)).rejects.toThrow();
  },30000);
});
