import { SQL } from 'bun';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl, ADMIN_ORIGIN, API_ORIGIN } from '../apps/api/src/auth/policy';
import { createS02Database } from '../apps/api/src/database';
import { createS02Auth } from '../apps/api/src/auth';
import { DomainService } from '../apps/api/src/modules/domain.service';
import { openPasswordSession } from './s02-fixtures';
import type { Auth001Fixtures } from '../apps/api/test/auth-001-support';

interface UiResources {
  package: string; tenantIds: { A: string; B: string | null };
  identities: Array<{ label: string; name: string; email: string; password: string; userId: string | null; registered: boolean; verified: boolean }>;
}
async function main() {
  if (!process.argv.includes('--local-auth-001') || !process.argv.includes('--ui-checkpoint-released') ||
    process.cwd() !== resolve(import.meta.dir, '..')) throw new Error('Explicit released AUTH UI checkpoint required');
  const ui = JSON.parse(await readFile('.local/auth-001-ui-resources.json', 'utf8')) as UiResources;
  if (ui.package !== 'GCMS-AUTH-001' || !ui.tenantIds.A || !ui.tenantIds.B || ui.identities.length !== 3) throw new Error('UI checkpoint incomplete');
  const browserOwner = ui.identities.find(item => item.label === 'browserOwner');
  if (!browserOwner?.userId || !browserOwner.registered || !browserOwner.verified) throw new Error('Verified UI owner absent');
  const path = '.local/auth-001-data-fixtures.json';
  let fixtures: Auth001Fixtures;
  if (await Bun.file(path).exists()) {
    fixtures = JSON.parse(await readFile(path, 'utf8')) as Auth001Fixtures;
    if (fixtures.tenantIds.A !== ui.tenantIds.A || fixtures.tenantIds.B !== ui.tenantIds.B) throw new Error('AUTH fixture tenant mismatch');
  } else {
    fixtures = { tenantIds: { A: ui.tenantIds.A, B: ui.tenantIds.B }, identities: [
      ...ui.identities.map(item => ({ label: item.label, userId: item.userId ?? '', email: item.email, password: item.password, purpose: 'browser' })),
      ...['apiRecovery', 'apiDisable'].map((label, index) => ({ label, userId: '', email: `${label.toLowerCase()}-${randomUUID()}@auth-001.example.test`,
        password: randomBytes(24).toString('base64url'), purpose: index === 0 ? 'recovery' : 'disable' })),
    ] };
    await writeFile(path, JSON.stringify(fixtures, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  if (fixtures.identities.length > 5) throw new Error('AUTH account budget exceeded');
  const persist = async () => { await writeFile(path, JSON.stringify(fixtures, null, 2) + '\n', { mode: 0o600 }); await chmod(path, 0o600); };
  const db = createS02Database(), identity = createS02Auth(db), service = new DomainService(db, identity);
  let owner: Awaited<ReturnType<typeof openPasswordSession>> | undefined;
  const receipts: Array<Record<string, unknown>> = [];
  async function mail(email: string, type: string) {
    const directory = '.local/s02-mail';
    for (const name of (await readdir(directory)).sort().reverse()) {
      const value = JSON.parse(await readFile(resolve(directory, name), 'utf8')) as { to: string; type: string; url: string };
      if (value.to === email && value.type === type) return value.url;
    }
    throw new Error('Owned local capture absent');
  }
  const privateRequest = (signed: Awaited<ReturnType<typeof openPasswordSession>>) => ({ method: 'POST', originalUrl: '', headers: {
    host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891', 'content-type': 'application/json',
    cookie: signed.headers.get('cookie') ?? '', 'x-csrf-token': identity.csrfToken(signed.actor) } });
  const raw = async (path: string, body: unknown) => identity.handler(new Request(`http://127.0.0.1:5890/api/auth${path}`, {
    method: 'POST', headers: { origin: 'http://127.0.0.1:5891', 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  try {
    owner = await openPasswordSession(identity, { userId: browserOwner.userId, email: browserOwner.email, password: browserOwner.password });
    for (const label of ['apiRecovery', 'apiDisable']) {
      const account = fixtures.identities.find(item => item.label === label)!;
      if (!account || !account.email.endsWith('@auth-001.example.test')) throw new Error('Owned API identity absent');
      let users = await db.authSql`SELECT id,email_verified FROM gcms_s02_auth."user" WHERE email=${account.email}`;
      let signed: Awaited<ReturnType<typeof openPasswordSession>> | undefined;
      try {
        for (const tenant of label === 'apiRecovery' ? [fixtures.tenantIds.A] : Object.values(fixtures.tenantIds)) {
          if (users[0]?.email_verified) {
            signed ??= await openPasswordSession(identity, { ...account, userId: String(users[0].id) });
            const current = await service.currentSession({ ...privateRequest(signed), method: 'GET' });
            if (current.tenantMemberships.some(member => member.tenantId === tenant)) continue;
          }
          await service.inviteMember(privateRequest(owner), tenant, { email: account.email });
          const token = new URL(await mail(account.email, 'invitation')).hash.slice('#token='.length);
          if (!users.length) {
            if ((await raw('/invitation-register', { token, name: label, password: account.password })).status !== 200) throw new Error('Owned registration failed');
            if ((await raw('/sign-in/email', { email: account.email, password: account.password, rememberMe: false })).status !== 403) throw new Error('Unverified login was not denied');
            const verification = await mail(account.email, 'email-verification');
            if ((await identity.handler(new Request(verification))).status !== 302) throw new Error('Owned email verification failed');
            users = await db.authSql`SELECT id,email_verified FROM gcms_s02_auth."user" WHERE email=${account.email}`;
            account.userId = String(users[0].id); await persist();
          }
          if (!users[0]?.email_verified) throw new Error('Resume requires existing owned verification capture');
          account.userId = String(users[0].id); await persist();
          signed ??= await openPasswordSession(identity, account);
          await service.acceptInvitation(privateRequest(signed), { token });
          receipts.push({ label, membershipAccepted: true, emailVerification: 'PASS', unverifiedLogin: 'DENIED', passwordOnly: true });
        }
      } finally { await signed?.call('/sign-out', {}); }
    }
    await persist();
    await mkdir('docs/evidence/auth-001/api', { recursive: true });
    await writeFile('docs/evidence/auth-001/api/fixture-setup.json', JSON.stringify({ recordedAtUtc: new Date().toISOString(), status: 'PASS',
      totalNewAccounts: fixtures.identities.length, newApiAccounts: 2, additionalTenantsCreated: 0, receipts, privateManifestMode: '0600', secretsPrinted: false,
    }, null, 2) + '\n');
    console.info(JSON.stringify({ status: 'PASS', newApiAccounts: 2, totalNewAccounts: fixtures.identities.length, additionalTenantsCreated: 0, secretsPrinted: false }));
  } finally { await owner?.call('/sign-out', {}); await db.close(); }
}
(process.argv.includes('--resume-existing-apiDisable') ? resumeExistingDisable() : main()).catch(() => { console.error('AUTH bounded fixture setup failed; details redacted.'); process.exitCode = 1; });

async function resumeExistingDisable() {
  const path='.local/auth-001-data-fixtures.json', events:Array<Record<string,unknown>>=[];
  let phase='resume-preflight';
  const fixtures=await Bun.file(path).json(),ui=await Bun.file('.local/auth-001-ui-resources.json').json();
  const account=fixtures.identities.find((row:{label:string})=>row.label==='apiDisable'),browserOwner=ui.identities.find((row:{label:string})=>row.label==='browserOwner');
  if(!process.argv.includes('--local-auth-001')||!process.argv.includes('--ui-checkpoint-released')||fixtures.identities.length!==5||!account||!browserOwner?.verified)throw new Error('Exact resume scope required');
  const reportPath='docs/evidence/auth-001/api/fixture-setup-resume.json';
  const persist=async(status='IN_PROGRESS')=>{fixtures.setupProgress={phase,status,events};await writeFile(path,JSON.stringify(fixtures,null,2)+'\n',{mode:0o600});await chmod(path,0o600);
    await mkdir('docs/evidence/auth-001/api',{recursive:true});await writeFile(reportPath,JSON.stringify({recordedAtUtc:new Date().toISOString(),status,phase,events,
      priorAttempt:'FAIL_GENERIC_REPORTED_BY_COORDINATOR',scope:'Resume exact existing unverified apiDisable, then accept A and invite/accept B; no registration/reset/new identity.',secretsPrinted:false},null,2)+'\n');};
  const record=async(event:Record<string,unknown>)=>{events.push({phase,...event});await persist();};
  const readonly=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1,connection:{default_transaction_read_only:'on'}});
  const owned=<T>(action:(tx:SQL)=>Promise<T>)=>readonly.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');return action(tx as unknown as SQL);});
  const db=createS02Database(),identity=createS02Auth(db),service=new DomainService(db,identity);
  let owner:Awaited<ReturnType<typeof openPasswordSession>>|undefined,signed:Awaited<ReturnType<typeof openPasswordSession>>|undefined;
  const request=(session:Awaited<ReturnType<typeof openPasswordSession>>)=>({method:'POST',originalUrl:'',headers:{host:'127.0.0.1:5890',origin:ADMIN_ORIGIN,'content-type':'application/json',cookie:session.headers.get('cookie')??'','x-csrf-token':identity.csrfToken(session.actor)}});
  const capture=async(type:string,before?:Set<string>)=>{const found=[];for(const name of await readdir('.local/s02-mail')){if(before?.has(name))continue;const item=JSON.parse(await readFile(resolve('.local/s02-mail',name),'utf8'));if(item.to===account.email&&item.type===type)found.push(item);}if(found.length!==1)throw new Error('Exact owned capture absent');return found[0].url as string;};
  try{
    const [user]=await owned(tx=>tx`SELECT id,active,email_verified FROM gcms_s02_auth."user" WHERE email=${account.email}`);
    const initialMembers=await owned(tx=>tx`SELECT tenant_id FROM gcms_s02.membership WHERE user_id=${user?.id}`);
    if(!user?.active||user.email_verified||initialMembers.length||account.userId&&account.userId!==user.id)throw new Error('Existing unverified actor state differs');
    account.userId=user.id;phase='existing-unverified-actor-bound';await record({existing:true,verified:false,memberships:0,registrationsAttempted:0});
    const invitationUrl=await capture('invitation'),verificationUrl=await capture('email-verification'),inviteUrl=new URL(invitationUrl),verifyUrl=new URL(verificationUrl);
    if(inviteUrl.origin!==ADMIN_ORIGIN||inviteUrl.pathname!=='/invitations'||verifyUrl.origin!==API_ORIGIN||verifyUrl.pathname!=='/api/auth/verify-email')throw new Error('Capture origin mismatch');
    const token=decodeURIComponent(inviteUrl.hash.slice('#token='.length));
    const invites=await owned(tx=>tx`SELECT id FROM gcms_s02.invitation WHERE tenant_id=${fixtures.tenantIds.A} AND email=${account.email}
      AND token_hash=${createHash('sha256').update(token).digest('hex')} AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()`);
    if(invites.length!==1)throw new Error('Exact A invitation mismatch');
    phase='unverified-password-denial';await Bun.sleep(11000);
    const denied=await identity.handler(new Request(`${API_ORIGIN}/api/auth/sign-in/email`,{method:'POST',headers:{origin:ADMIN_ORIGIN,'content-type':'application/json'},body:JSON.stringify({email:account.email,password:account.password,rememberMe:false})}));
    await record({status:denied.status});if(denied.status!==403)throw new Error('Unverified denial missing');
    phase='existing-local-verification-GET';const verification=await identity.handler(new Request(verificationUrl));await record({status:verification.status});
    const [verified]=await owned(tx=>tx`SELECT email_verified FROM gcms_s02_auth."user" WHERE id=${account.userId}`);
    if(verification.status!==302||!verified?.email_verified)throw new Error('Existing verification did not complete');
    phase='owner-password-login';owner=await openPasswordSession(identity,browserOwner);await record({result:'SUCCESS'});
    phase='existing-apiDisable-password-login';signed=await openPasswordSession(identity,account);await record({result:'SUCCESS'});
    phase='accept-existing-A-invitation';const acceptedA=await service.acceptInvitation(request(signed),{token});await record({acceptedTenantA:acceptedA.tenantId===fixtures.tenantIds.A});if(acceptedA.tenantId!==fixtures.tenantIds.A)throw new Error('A accept mismatch');
    phase='invite-only-new-B-membership';const before=new Set(await readdir('.local/s02-mail'));await service.inviteMember(request(owner),fixtures.tenantIds.B,{email:account.email});await record({result:'INVITATION_CREATED'});
    const bUrl=new URL(await capture('invitation',before)),bToken=decodeURIComponent(bUrl.hash.slice('#token='.length));
    const bInvites=await owned(tx=>tx`SELECT id FROM gcms_s02.invitation WHERE tenant_id=${fixtures.tenantIds.B} AND email=${account.email}
      AND token_hash=${createHash('sha256').update(bToken).digest('hex')} AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()`);
    if(bInvites.length!==1)throw new Error('Exact B invitation mismatch');
    phase='accept-new-B-invitation';const acceptedB=await service.acceptInvitation(request(signed),{token:bToken});await record({acceptedTenantB:acceptedB.tenantId===fixtures.tenantIds.B});if(acceptedB.tenantId!==fixtures.tenantIds.B)throw new Error('B accept mismatch');
    phase='final-exact-five-actor-memberships';const rows=await owned(tx=>tx`SELECT tenant_id,status FROM gcms_s02.membership WHERE user_id=${account.userId}`);
    if(rows.length!==2||!rows.every((row:{tenant_id:string;status:string})=>[fixtures.tenantIds.A,fixtures.tenantIds.B].includes(row.tenant_id)&&row.status==='active'))throw new Error('Final A/B memberships differ');
    await record({totalCanonicalIdentities:5,apiRecoveryMemberships:['A'],apiDisableMemberships:['A','B'],newRegistrations:0});await persist('PASS');
    await writeFile('docs/evidence/auth-001/api/fixture-setup.json',JSON.stringify({recordedAtUtc:new Date().toISOString(),status:'PASS',totalNewAccounts:5,newApiAccounts:2,additionalTenantsCreated:0,
      resumeArtifact:reportPath,retainedPasswordsUnchanged:true,secretsPrinted:false},null,2)+'\n');console.info(JSON.stringify({status:'PASS',phase,totalCanonicalIdentities:5,newRegistrations:0,secretsPrinted:false}));
  }catch(error){await persist('FAIL');throw error;}
  finally{await signed?.call('/sign-out',{});await owner?.call('/sign-out',{});await db.close();await readonly.close();}
}
