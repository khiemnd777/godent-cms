import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { SQL } from 'bun';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { createS02Database, postgresCode } from '../src/database';
import { createS02Auth } from '../src/auth';
import { loadRuntimeEnvironment } from '../src/auth/runtime-environment';
import { validateDatabaseUrl } from '../src/auth/policy';
import { legacyDocument } from '../src/contracts/content';
import { normalizeIntakeInput } from '../src/contracts/intake';
import { S04_ACK, S04_ROUTES, type IntakeChallenge, type IntakeInput, type LeadDetail, type LeadPage } from '../src/contracts/s04';
import type { CurrentSession } from '../src/contracts/s02';
import type { PublicationResult, PublicationService, SiteDraft } from '../src/contracts/s03';
import { IntakeFailure, IntakeService } from '../src/modules/intake.service';
import { openFixtureSession, type S02Fixtures } from '../../../scripts/s02-fixtures';

type Signed=Awaited<ReturnType<typeof openFixtureSession>>;
interface Client {signed:Signed;csrf:string}
interface Source {tenantId:string;tenantSlug:string;serviceId:string;serviceSlug:string;publicationId:string;admin:'A1'|'B1'}
const clients=new Map<string,Client>();const run=randomUUID();
let app:INestApplication;let base='';let db:ReturnType<typeof createS02Database>;let identity:ReturnType<typeof createS02Auth>;let owner:SQL;
let prior:S02Fixtures;let runtime:Awaited<ReturnType<typeof loadRuntimeEnvironment>>;
function client(label='A1') {const c=clients.get(label);if(!c) throw new Error('Synthetic client absent');return c;}
async function admin<T>(path:string,method='GET',body?:unknown,label='A1') {
  const c=client(label);const r=await fetch(base+path,{method,headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891',cookie:c.signed.headers.get('cookie')??'',
    ...(method==='GET'?{}:{'content-type':'application/json','x-csrf-token':c.csrf})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  return {status:r.status,value:await r.json() as T,headers:r.headers};
}
async function publicPost<T=Record<string,unknown>>(source:Source,input:unknown,headers:Record<string,string>={},challenge=false,origin=base) {
  const r=await fetch(origin+(challenge?S04_ROUTES.challenge(source.tenantSlug,source.serviceSlug):S04_ROUTES.intake(source.tenantSlug,source.serviceSlug)),{
    method:'POST',headers:{host:'127.0.0.1:5890',origin:'http://localhost:5892','content-type':'application/json',...headers},body:JSON.stringify(input),signal:AbortSignal.timeout(12000)});
  return {status:r.status,value:await r.json() as T,headers:r.headers};
}
function input(source:Source,extra:Record<string,unknown>={}):IntakeInput {
  return {requestKey:randomUUID(),sourcePublicationId:source.publicationId,phone:'0900123456',preferredLanguage:'vi',preferredChannel:'phone',consent:true,...extra} as IntakeInput;
}
function digest(purpose:string,value:string) {return createHmac('sha256',process.env.S04_HMAC_SECRET!).update(`${purpose}:${value}`).digest('hex');}
function answer(challenge:IntakeChallenge) {const values=challenge.prompt.match(/\d+/g);if(!values||values.length!==2) throw new Error('Unexpected local challenge');return String(Number(values[0])+Number(values[1]));}
async function solve(source:Source,key:string) {const r=await publicPost<IntakeChallenge>(source,{requestKey:key},{},true);expect(r.status).toBe(200);return {token:r.value.token,answer:answer(r.value)};}
async function ownerAction<T>(action:(tx:SQL)=>Promise<T>) {return owner.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');return action(tx as unknown as SQL);});}
async function source(label:string,adminLabel:'A1'|'B1'='A1'):Promise<Source> {
  const tenantId=randomUUID(),tenantSlug=`s04-${run.slice(0,8)}-${label}`;
  await ownerAction(async tx=>{
    await tx`INSERT INTO gcms_s02.tenant(id,name) VALUES(${tenantId},${`S04 Test ${run} ${label}`})`;
    for(const who of adminLabel==='A1'?['A1','A2']:['B1']) {const id=prior.identities.find(i=>i.label===who)!.userId;
      await tx`INSERT INTO gcms_s02.membership(tenant_id,user_id) VALUES(${tenantId},${id})`;}
  });
  const prefix=`/api/tenants/${tenantId}/publication`;
  const site=await admin<SiteDraft>(prefix+'/site','PUT',{slug:tenantSlug,name:'S04 Synthetic API',footer:{intro:'',body:legacyDocument('Synthetic footer')},expectedVersion:0},adminLabel);
  expect(site.status).toBe(200);
  const draft=await admin<PublicationService>(prefix+'/services','POST',{slug:'consultation',title:'Published source title',summary:'Synthetic',body:legacyDocument('Published safe text'),seo:{title:'Synthetic',description:''}},adminLabel);
  expect(draft.status).toBe(201);
  const published=await admin<PublicationResult>(prefix+`/services/${draft.value.id}/publish`,'POST',{
    expectedDraftVersion:1,expectedSiteVersion:site.value.version,expectedPublicationVersion:0,requestKey:randomUUID()},adminLabel);
  expect(published.status).toBe(200);
  return {tenantId,tenantSlug,serviceId:draft.value.id,serviceSlug:'consultation',publicationId:published.value.publicationId,admin:adminLabel};
}
async function counts(s:Source) {return ownerAction(async tx=>{
  const rows=await tx`SELECT (SELECT count(*) FROM gcms_s04.lead WHERE tenant_id=${s.tenantId})::int AS leads,
    (SELECT count(*) FROM gcms_s04.notification_intent WHERE tenant_id=${s.tenantId})::int AS intents,
    (SELECT count(*) FROM gcms_s04.accepted_request WHERE tenant_id=${s.tenantId})::int AS requests,
    (SELECT count(*) FROM gcms_s04.audit_event WHERE tenant_id=${s.tenantId})::int AS audits`;
  return rows[0];
});}
async function raw(command:unknown) {return db.intakeSql!.begin(async tx=>{const rows=await tx`SELECT gcms_s04.intake(${JSON.stringify(command)}::text::jsonb) AS result`;return rows[0]?.result as Record<string,unknown>;});}
async function spawnServer() {
  const child=Bun.spawn([process.execPath,'--no-env-file','apps/api/test/s04-restart-server.ts'],{env:runtime.api,stdout:'pipe',stderr:'pipe'});
  const reader=child.stdout.getReader();let line='';
  try {
    const deadline=Date.now()+12000;
    while(!line.includes('\n')) {
      if(Date.now()>deadline) throw new Error('Owned child readiness timeout');
      const next=await Promise.race([reader.read(),Bun.sleep(12000).then(()=>{throw new Error('Owned child readiness timeout');})]);
      if(next.done) throw new Error('Owned child ended before readiness');line+=new TextDecoder().decode(next.value);
    }
    const parsed=JSON.parse(line.split('\n').find(v=>v.startsWith('{'))??'{}') as {url?:string};
    if(!parsed.url||!/^http:\/\/127\.0\.0\.1:\d+$/.test(parsed.url)) throw new Error('Unexpected owned child URL');
    return {child,url:parsed.url};
  } catch(error) {child.kill('SIGTERM');await child.exited;throw error;} finally {reader.releaseLock();}
}

describe.skipIf(process.env.S04_INTEGRATION!=='1')('S04 real anonymous HTTP and restricted PostgreSQL integrity',()=>{
  beforeAll(async()=>{
    runtime=await loadRuntimeEnvironment();Object.assign(process.env,runtime.api);
    prior=JSON.parse(await readFile('.local/s02-fixtures.json','utf8')) as S02Fixtures;
    db=createS02Database();identity=createS02Auth(db);
    owner=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:2,connectionTimeout:3});
    const compiled=await import('../dist/app.js' as string) as {createApp():Promise<INestApplication>};
    app=await compiled.createApp();await app.listen(0,'127.0.0.1');base=await app.getUrl();
    const transport=(r:Request)=>fetch(base+new URL(r.url).pathname,{method:r.method,headers:{...Object.fromEntries(r.headers),host:'127.0.0.1:5890'},body:r.body,redirect:'manual',signal:AbortSignal.timeout(12000)});
    for(const [index,label] of (['A1','A2','B1','PlatformOnly'] as const).entries()) {
      if(index===2) await Bun.sleep(11000);
      const signed=await openFixtureSession(identity,label,transport);
      const response=await fetch(base+'/api/session',{headers:{host:'127.0.0.1:5890',cookie:signed.headers.get('cookie')??''}});
      expect(response.status).toBe(200);clients.set(label,{signed,csrf:(await response.json() as CurrentSession).csrfToken});
    }
  },120000);
  afterAll(async()=>{await app?.close();await db?.close();await owner?.close();});

  test('phone/email acceptance is minimal and both tenant admins read masked list/full detail',async()=>{
    const s=await source('minimal');const phone=input(s,{name:'Synthetic person',phone:'+84 (900) 123-456',message:'<script>literal</script>',interestServiceSlug:s.serviceSlug});
    const accepted=await publicPost(s,phone);expect(accepted.status).toBe(200);expect(accepted.value).toEqual(S04_ACK);
    expect(accepted.headers.get('access-control-allow-origin')).toBe('http://localhost:5892');expect(accepted.headers.get('access-control-allow-credentials')).toBeNull();
    const mail=await publicPost(s,input(s,{phone:undefined,email:'  SYNTHETIC@EXAMPLE.INVALID ',preferredChannel:'email',preferredLanguage:'en'}));
    expect(mail.status).toBe(200);expect(mail.value).toEqual(S04_ACK);
    for(const label of ['A1','A2']) {
      const list=await admin<LeadPage>(S04_ROUTES.leads(s.tenantId),'GET',undefined,label);expect(list.status).toBe(200);expect(list.value.items).toHaveLength(2);
      expect(list.value.items.every(i=>i.status==='new')).toBe(true);expect(JSON.stringify(list.value)).not.toContain('84900123456');
      const detail=await admin<LeadDetail>(S04_ROUTES.lead(s.tenantId,list.value.items.find(i=>i.name==='Synthetic person')!.id),'GET',undefined,label);
      expect(detail.status).toBe(200);expect(detail.value.phone).toBe('84900123456');expect(detail.value.message).toBe('<script>literal</script>');
      expect(detail.value.source.publicationId).toBe(s.publicationId);expect(detail.value.interest?.serviceSlug).toBe(s.serviceSlug);
      expect(detail.value.consent.version).toBe('consultation-vi-v1');expect(new Date(detail.value.expiresAt).getTime()-new Date(detail.value.lastActivityAt).getTime()).toBe(180*86400000);
    }
    expect(await counts(s)).toMatchObject({leads:2,intents:2,requests:2,audits:2});
    const safe=await ownerAction(tx=>tx`SELECT column_name FROM information_schema.columns WHERE table_schema='gcms_s04' AND table_name IN ('notification_intent','audit_event')`);
    expect(safe.some((r:{column_name:unknown})=>/phone|email|message|recipient|ip_hash/.test(String(r.column_name)))).toBe(false);
  });

  test('normalization boundaries reject invalid contact/consent/extra fields; NFC500 accepts and501 rejects',async()=>{
    const s=await source('input');
    for(const change of [{phone:undefined},{phone:'bad'},{email:'bad'},{email:'a<b@example.invalid'},{email:'a@example..invalid'},{email:'a@-example.invalid'},
      {email:'a@example.invalid>'},{preferredChannel:'email'},{consent:false},{tenantId:s.tenantId},
      {locationId:randomUUID()},{assignee:client().signed.actor.userId},{message:'😀'.repeat(501)}]) {
      const r=await publicPost(s,input(s,change));expect(r.status).toBe(400);expect(r.value.code).toBe('INVALID_INPUT');
    }
    expect((await publicPost(s,input(s,{message:'a\u0301'.repeat(500)}))).status).toBe(200);
    const row=await ownerAction(tx=>tx`SELECT length(message)::int AS points,message FROM gcms_s04.lead WHERE tenant_id=${s.tenantId}`);
    expect(row[0]?.points).toBe(500);expect(row[0]?.message).toBe('á'.repeat(500));
    for(const email of ['a<b@example.invalid','a@example..invalid','a@-example.invalid','a@example.invalid>','é@example.invalid']) {
      const check=await ownerAction(tx=>tx`SELECT gcms_s04.valid_email(${email}) AS valid`);expect(check[0]?.valid).toBe(false);
    }
    for(const email of ["o'connor+consultation@example.invalid",'a.b@example.invalid','person@xn--bcher-kva.invalid']) {
      const check=await ownerAction(tx=>tx`SELECT gcms_s04.valid_email(${email}) AS valid`);expect(check[0]?.valid).toBe(true);
    }
  });

  test('pending draft never changes authoritative source; unknown/draft/forged source and Origins fail closed',async()=>{
    const s=await source('source');const prefix=`/api/tenants/${s.tenantId}/publication/services`;
    const pending=await admin<PublicationService>(prefix+`/${s.serviceId}`,'PUT',{slug:s.serviceSlug,title:'Unpublished private title',summary:'Private',body:legacyDocument('Private draft'),seo:{title:'Private',description:''},expectedDraftVersion:1});expect(pending.status).toBe(200);
    expect((await publicPost(s,input(s))).status).toBe(200);
    const row=await ownerAction(tx=>tx`SELECT source_service_title FROM gcms_s04.lead WHERE tenant_id=${s.tenantId}`);expect(row[0]?.source_service_title).toBe('Published source title');
    const draft=await admin<PublicationService>(prefix,'POST',{slug:'private-draft',title:'Private only',summary:'',body:legacyDocument('private'),seo:{title:'',description:''}});expect(draft.status).toBe(201);
    expect((await publicPost({...s,serviceSlug:'private-draft'},input(s))).status).toBe(404);
    expect((await publicPost({...s,tenantSlug:'unknown-s04'},input(s))).status).toBe(404);
    expect((await publicPost(s,input(s,{sourcePublicationId:randomUUID()}))).status).toBe(404);
    expect((await publicPost(s,input(s,{interestServiceSlug:'private-draft'}))).status).toBe(404);
    for(const headers of [{origin:'http://evil.invalid'},{origin:'null'},{cookie:'session=forged'},{authorization:'Bearer forged'},{'x-forwarded-host':'other.invalid'}] as Record<string,string>[]) expect((await publicPost(s,input(s),headers)).status).not.toBe(200);
  });

  test('same-key concurrent retries commit one lead/intent/result and changed semantic payload rejects',async()=>{
    const s=await source('concurrent');const payload=input(s,{phone:'+84 900 123 456',name:'a\u0301'});
    const retries=await Promise.all(Array.from({length:8},()=>publicPost(s,payload)));expect(retries.map(r=>r.status)).toEqual(Array(8).fill(200));
    expect(retries.every(r=>JSON.stringify(r.value)===JSON.stringify(S04_ACK))).toBe(true);
    expect((await publicPost(s,{...payload,phone:'84900123456',name:'á'})).status).toBe(200);
    const conflict=await publicPost(s,{...payload,message:'Different intent'});expect(conflict.status).toBe(409);expect(conflict.value.code).toBe('REQUEST_CONFLICT');
    expect(await counts(s)).toMatchObject({leads:1,intents:1,requests:1,audits:1});
    expect((await publicPost(s,{...payload,requestKey:randomUUID()})).status).toBe(200);
    expect(await counts(s)).toMatchObject({leads:2,intents:2});
  });

  test('24-hour expiry permits a fresh accepted intent without deleting or merging the old lead',async()=>{
    const s=await source('key-expiry');const payload=input(s);expect((await publicPost(s,payload)).status).toBe(200);
    await ownerAction(tx=>tx`UPDATE gcms_s04.accepted_request SET accepted_at=now()-interval '25 hours',expires_at=now()-interval '1 hour' WHERE tenant_id=${s.tenantId}`);
    expect((await publicPost(s,payload)).status).toBe(200);expect(await counts(s)).toMatchObject({leads:2,intents:2,requests:1,audits:2});
  });

  test('matching accepted retry survives suspension/unpublish while NEW intake denies and active tenant-admin reads remain',async()=>{
    const s=await source('suspended');const payload=input(s);expect((await publicPost(s,payload)).status).toBe(200);
    const before=await ownerAction(tx=>tx`SELECT last_activity_at,expires_at FROM gcms_s04.lead WHERE tenant_id=${s.tenantId}`);
    await ownerAction(async tx=>{await tx`UPDATE gcms_s02.tenant SET status='suspended' WHERE id=${s.tenantId}`;
      await tx`UPDATE gcms_s02.site_draft SET public_enabled=false WHERE tenant_id=${s.tenantId}`;
      await tx`DELETE FROM gcms_s02.publication_pointer WHERE tenant_id=${s.tenantId}`;});
    expect((await publicPost(s,payload)).value).toEqual(S04_ACK);expect((await publicPost(s,input(s))).status).toBe(404);
    expect((await admin<LeadPage>(S04_ROUTES.leads(s.tenantId))).value.items).toHaveLength(1);
    expect((await admin<LeadPage>(S04_ROUTES.leads(s.tenantId),'GET',undefined,'A2')).status).toBe(200);
    expect((await admin(`/api/tenants/${s.tenantId}/publication/services`,'POST',{slug:'forbidden',title:'x',summary:'',body:legacyDocument('x'),seo:{title:'',description:''}})).status).toBe(403);
    const after=await ownerAction(tx=>tx`SELECT last_activity_at,expires_at FROM gcms_s04.lead WHERE tenant_id=${s.tenantId}`);expect(after).toEqual(before);
    expect(await counts(s)).toMatchObject({leads:1,intents:1,requests:1,audits:1});
  });

  test('third NEW requires one-use local challenge; wrong/expired/replayed answers fail and XFF cannot reset peer quota',async()=>{
    const s=await source('challenge');expect((await publicPost(s,input(s))).status).toBe(200);expect((await publicPost(s,input(s))).status).toBe(200);
    const third=input(s);expect((await publicPost(s,third,{'x-forwarded-for':'8.8.8.8'})).value.code).toBe('CAPTCHA_REQUIRED');
    const wrong=await solve(s,third.requestKey);expect((await publicPost(s,{...third,challenge:{...wrong,answer:'999'}})).value.code).toBe('CAPTCHA_INVALID');
    expect((await publicPost(s,{...third,challenge:wrong})).value.code).toBe('CAPTCHA_INVALID');
    const correct=await solve(s,third.requestKey);expect((await publicPost(s,{...third,challenge:correct})).status).toBe(200);
    expect((await publicPost(s,{...third,challenge:correct})).status).toBe(200);
    const fourth=input(s);expect((await publicPost(s,{...fourth,challenge:correct})).value.code).toBe('CAPTCHA_INVALID');
    const expired=await solve(s,fourth.requestKey);
    await ownerAction(tx=>tx`UPDATE gcms_s04.challenge SET expires_at=clock_timestamp()-interval '1 second' WHERE tenant_id=${s.tenantId} AND token_hash=${digest('token-v1',expired.token)}`);
    expect((await publicPost(s,{...fourth,challenge:expired})).value.code).toBe('CAPTCHA_INVALID');
    expect((await publicPost(s,{...fourth,challenge:await solve(s,fourth.requestKey)})).status).toBe(200);
    const fifth=input(s);expect((await publicPost(s,{...fifth,challenge:await solve(s,fifth.requestKey)})).status).toBe(200);
    const sixth=await publicPost(s,input(s),{'x-forwarded-for':'1.1.1.1'});expect(sixth.status).toBe(429);expect(sixth.value.code).toBe('RATE_LIMITED');
    expect(await counts(s)).toMatchObject({leads:5,intents:5,requests:5,audits:5});
    const unavailable=new IntakeService(db,identity,process.env.S04_HMAC_SECRET,{generate(){throw new Error('Synthetic unavailable adapter');}});
    await expect(unavailable.challenge({method:'POST',originalUrl:S04_ROUTES.challenge(s.tenantSlug,s.serviceSlug),headers:{origin:'http://localhost:5892','content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}},s.tenantSlug,s.serviceSlug,{requestKey:randomUUID()})).rejects.toBeInstanceOf(IntakeFailure);
  });

  test('technical role rejects SQL JSON null/type/pair challenge bypass and cannot supply a fingerprint',async()=>{
    const s=await source('sql-guards');expect((await publicPost(s,input(s))).status).toBe(200);expect((await publicPost(s,input(s))).status).toBe(200);
    const third=input(s);const challenge=await solve(s,third.requestKey);const {requestKey:_,challenge:__,...payload}=normalizeIntakeInput(third);void _;void __;
    const command={operation:'accept',tenantSlug:s.tenantSlug,serviceSlug:s.serviceSlug,requestKey:third.requestKey,ipHash:digest('ip-v1','127.0.0.1'),payload,tokenHash:digest('token-v1',challenge.token),answerHash:digest('answer-v1',`${challenge.token}:${challenge.answer}`)};
    for(const change of [{answerHash:null},{answerHash:0},{answerHash:[]},{answerHash:{}},{tokenHash:null},{tokenHash:0},{answerHash:undefined}]) expect((await raw({...command,...change})).code).toBe('INVALID_INPUT');
    expect((await raw({...command,fingerprint:'a'.repeat(64),payload:{...payload,message:'forged'}})).code).toBe('INVALID_INPUT');
    for(const change of [{consent:null},{preferredLanguage:null},{preferredChannel:0},{phone:null},{name:[]},{email:1},{email:'a<b@example.invalid'},
      {email:'a@example..invalid'},{email:'a@-example.invalid'},{email:'a@example.invalid>'},{sourcePublicationId:null},{message:'😀'.repeat(501)}]) expect((await raw({...command,payload:{...payload,...change}})).code).toBe('INVALID_INPUT');
    expect(await counts(s)).toMatchObject({leads:2,intents:2});
    expect(await raw(command)).toEqual(S04_ACK);expect((await raw({...command,payload:{...payload,message:'changed'}})).code).toBe('REQUEST_CONFLICT');
    expect(await counts(s)).toMatchObject({leads:3,intents:3});
  });

  test('tenant request budget also counts accepted retries without growing NEW quota',async()=>{
    const s=await source('request-limit');const payload=input(s);expect((await publicPost(s,payload)).status).toBe(200);
    const retries=await Promise.all(Array.from({length:59},()=>publicPost(s,payload)));expect(retries.every(r=>r.status===200)).toBe(true);
    const limited=await publicPost(s,payload);expect(limited.status).toBe(429);expect(limited.value.code).toBe('RATE_LIMITED');
    expect(await counts(s)).toMatchObject({leads:1,intents:1,requests:1,audits:1});
  },30000);

  test('restricted roles, cross-tenant and pooled concurrent access cannot disclose leads or counts',async()=>{
    const a=await source('isolation-a'),b=await source('isolation-b','B1');expect((await publicPost(a,input(a))).status).toBe(200);expect((await publicPost(b,input(b))).status).toBe(200);
    const list=await admin<LeadPage>(S04_ROUTES.leads(a.tenantId));const id=list.value.items[0].id;
    for(const label of ['B1','PlatformOnly']) {
      expect((await admin(S04_ROUTES.leads(a.tenantId),'GET',undefined,label)).status).toBe(403);
      expect((await admin(S04_ROUTES.lead(a.tenantId,id),'GET',undefined,label)).status).toBe(403);
    }
    const anon=await fetch(base+S04_ROUTES.leads(a.tenantId),{headers:{host:'127.0.0.1:5890'}});expect(anon.status).toBe(401);
    for(const role of ['auth','platform','intake'] as const) {
      const url=role==='intake'?process.env.S04_INTAKE_DATABASE_URL:process.env[`S02_${role.toUpperCase()}_DATABASE_URL`];const c=new SQL(url!,{max:1,connectionTimeout:3});
      try {let error:unknown;try {await c`SELECT count(*) FROM gcms_s04.lead`;} catch(e){error=e;}expect(postgresCode(error)).toBe('42501');
        if(role==='intake') for(const statement of ['SELECT * FROM gcms_s02_auth."user"','SELECT * FROM gcms_s02.service_draft','INSERT INTO gcms_s04.lead(tenant_id,id) VALUES(\'x\',\'x\')']) {
          let denied:unknown;try {await c.unsafe(statement);} catch(error) {denied=error;}
          expect(postgresCode(denied)).toBe('42501');
        }
      } finally {await c.close();}
    }
    const pooled=await Promise.all(Array.from({length:12},(_,i)=>admin<LeadPage>(S04_ROUTES.leads(i%2?a.tenantId:b.tenantId),'GET',undefined,i%2?'A1':'B1')));
    expect(pooled.every(r=>r.status===200&&r.value.items.length===1)).toBe(true);
    const direct=await db.tenantDb.execute(sql`SELECT count(*)::int AS count FROM gcms_s04.lead`);expect(direct[0]?.count).toBe(0);
    const forged=await db.withLeadTenant(client('B1').signed.actor,b.tenantId,async tx=>{
      await tx.execute(sql`SELECT set_config('gcms.tenant_id',${a.tenantId},true)`);return tx.execute(sql`SELECT count(*)::int AS count FROM gcms_s04.lead`);});expect(forged[0]?.count).toBe(0);
    expect((await admin(S04_ROUTES.lead(b.tenantId,id),'GET',undefined,'B1')).status).toBe(404);
  });

  test('stable keyset pagination is tenant-bound, capped, expiry-filtered and does not expose totals',async()=>{
    const s=await source('pagination');const first=input(s),second=input(s);await publicPost(s,first);await publicPost(s,second);
    const page1=await admin<LeadPage>(S04_ROUTES.leads(s.tenantId)+'?pageSize=1');expect(page1.value.items).toHaveLength(1);expect(page1.value.nextCursor).not.toBeNull();
    const page2=await admin<LeadPage>(S04_ROUTES.leads(s.tenantId)+'?pageSize=1&cursor='+page1.value.nextCursor);expect(page2.value.items).toHaveLength(1);expect(page2.value.items[0].id).not.toBe(page1.value.items[0].id);expect(page2.value.nextCursor).toBeNull();
    expect(page1.value).not.toHaveProperty('total');expect((await admin(S04_ROUTES.leads(s.tenantId)+'?pageSize=51')).status).toBe(400);
    const other=await source('cursor-other');expect((await admin(S04_ROUTES.leads(other.tenantId)+'?cursor='+page1.value.nextCursor)).status).toBe(400);
    expect((await admin(S04_ROUTES.leads(s.tenantId)+'?status=new')).status).toBe(400);
  });

  test('expired lead is denied by list/detail/count; views and replay never renew activity/deadline',async()=>{
    const s=await source('lead-expiry'),payload=input(s);await publicPost(s,payload);
    const list=await admin<LeadPage>(S04_ROUTES.leads(s.tenantId));const id=list.value.items[0].id;
    await ownerAction(tx=>tx`UPDATE gcms_s04.lead SET created_at=now()-interval '181 days',last_activity_at=now()-interval '181 days',consent_at=now()-interval '181 days',expires_at=now()-interval '1 day' WHERE tenant_id=${s.tenantId}`);
    const before=await ownerAction(tx=>tx`SELECT created_at,last_activity_at,expires_at FROM gcms_s04.lead WHERE tenant_id=${s.tenantId}`);
    expect((await admin<LeadPage>(S04_ROUTES.leads(s.tenantId))).value.items).toHaveLength(0);expect((await admin(S04_ROUTES.lead(s.tenantId,id))).status).toBe(404);
    const count=await db.withLeadTenant(client().signed.actor,s.tenantId,tx=>tx.execute(sql`SELECT count(*)::int AS count FROM gcms_s04.lead`));expect(count[0]?.count).toBe(0);
    expect((await publicPost(s,payload)).status).toBe(200);const after=await ownerAction(tx=>tx`SELECT created_at,last_activity_at,expires_at FROM gcms_s04.lead WHERE tenant_id=${s.tenantId}`);expect(after).toEqual(before);
  });

  test('precommit fault rolls lead/intent/result/audit back, then retry accepts exactly once',async()=>{
    const s=await source('rollback'),payload=input(s),name=`s04_fault_${run.replace(/-/g,'')}`;
    await ownerAction(async tx=>{await tx.unsafe(`CREATE FUNCTION gcms_s04.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${s.tenantId}' THEN RAISE EXCEPTION 'Synthetic intake transaction fault' USING ERRCODE='23514'; END IF; RETURN NEW; END $$`);
      await tx.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON gcms_s04.notification_intent FOR EACH ROW EXECUTE FUNCTION gcms_s04.${name}()`);});
    try {const failed=await publicPost(s,payload);expect(failed.status).toBe(409);expect(failed.value).not.toHaveProperty('message');expect(await counts(s)).toMatchObject({leads:0,intents:0,requests:0,audits:0});}
    finally {await ownerAction(async tx=>{await tx.unsafe(`DROP TRIGGER ${name} ON gcms_s04.notification_intent`);await tx.unsafe(`DROP FUNCTION gcms_s04.${name}()`);});}
    expect((await publicPost(s,payload)).status).toBe(200);expect(await counts(s)).toMatchObject({leads:1,intents:1,requests:1,audits:1});
  });

  test('cancelled ACK body and actual owned API process restart preserve one durable acceptance',async()=>{
    const s=await source('restart'),payload=input(s);let worker=await spawnServer();
    try {
      const response=await fetch(worker.url+S04_ROUTES.intake(s.tenantSlug,s.serviceSlug),{method:'POST',headers:{host:'127.0.0.1:5890',origin:'http://localhost:5892','content-type':'application/json'},body:JSON.stringify(payload)});
      // Deliberately discard the accepted response before parsing its acknowledgement.
      await response.body?.cancel();worker.child.kill('SIGTERM');await worker.child.exited;
      worker=await spawnServer();const replay=await publicPost(s,payload,{},false,worker.url);expect(replay.status).toBe(200);expect(replay.value).toEqual(S04_ACK);
      expect(await counts(s)).toMatchObject({leads:1,intents:1,requests:1,audits:1});
    } finally {worker.child.kill('SIGTERM');await worker.child.exited;}
  },40000);

  test('current membership and session revocation defeat cached actor access',async()=>{
    const s=await source('current-access');await publicPost(s,input(s));const actor=client('A2').signed.actor;
    await ownerAction(tx=>tx`UPDATE gcms_s02.membership SET status='revoked' WHERE tenant_id=${s.tenantId} AND user_id=${actor.userId}`);
    expect((await admin(S04_ROUTES.leads(s.tenantId),'GET',undefined,'A2')).status).toBe(403);
    await expect(db.withLeadTenant(actor,s.tenantId,tx=>tx.execute(sql`SELECT count(*) FROM gcms_s04.lead`))).rejects.toThrow();
    expect((await admin(S04_ROUTES.leads(s.tenantId))).status).toBe(200);
    const a1=client().signed.actor;await ownerAction(tx=>tx`DELETE FROM gcms_s02_auth.session WHERE id=${a1.sessionId}`);
    expect((await admin(S04_ROUTES.leads(s.tenantId))).status).toBe(401);
  });
});
