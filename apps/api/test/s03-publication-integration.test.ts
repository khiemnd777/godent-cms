import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { createS02Database } from '../src/database';
import { createS02Auth } from '../src/auth';
import { loadRuntimeEnvironment } from '../src/auth/runtime-environment';
import { legacyDocument, richTextPlain } from '../src/contracts/content';
import type { CurrentSession } from '../src/contracts/s02';
import type { PublicationResult, PublicationService, PublicServicePage, ServiceContent, SiteDraft } from '../src/contracts/s03';
import { openFixtureSession } from '../../../scripts/s02-fixtures';
import type { S03Fixtures } from '../../../scripts/s03-fixtures';

type Signed=Awaited<ReturnType<typeof openFixtureSession>>;
interface Client { signed:Signed; csrf:string }
const clients=new Map<string,Client>();
let base='';let app:INestApplication|undefined;let db:ReturnType<typeof createS02Database>;let identity:ReturnType<typeof createS02Auth>;let fixtures:S03Fixtures;
let createApplication:()=>Promise<INestApplication>;
const run=randomUUID();
let draft:PublicationService;let site:SiteDraft;
const prefix=()=>`/api/tenants/${fixtures.tenants.A}/publication`;
const servicePath=()=>`${prefix()}/services/${draft.id}`;
const publicPath=()=>`/api/public/sites/${site.slug}/services/${draft.slug}`;
function client(label='A1'):Client {const found=clients.get(label);if(!found) throw new Error('Synthetic client absent');return found;}
async function request<T>(path:string,method='GET',body?:unknown,label='A1',extra:Record<string,string>={}) {
  const c=client(label);const headers:Record<string,string>={host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891',cookie:c.signed.headers.get('cookie')??''};
  if(method!=='GET') {headers['content-type']='application/json';headers['x-csrf-token']=c.csrf;}
  Object.assign(headers,extra);
  const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  return {status:response.status,headers:response.headers,value:await response.json() as T};
}
async function anonymous(path:string,extra:Record<string,string>={}) {
  const response=await fetch(base+path,{headers:{host:'127.0.0.1:5890',...extra},signal:AbortSignal.timeout(12000)});
  return {status:response.status,headers:response.headers,value:await response.json() as PublicServicePage};
}
function content(title:string,body:string):ServiceContent {return {slug:`care-${run}`,title,summary:'Synthetic VI summary',body:legacyDocument(body),seo:{title:`SEO ${title}`,description:'Synthetic description'}};}
function publishInput(key=randomUUID()) {return {expectedDraftVersion:draft.draftVersion,expectedPublicationVersion:draft.publicationVersion,expectedSiteVersion:site.version,requestKey:key};}

// Source/unit checks never open a database, enroll MFA or start HTTP listeners.
// Coordinator executes sequentially only after preservation preflight and 0004.
describe.skipIf(process.env.S03_INTEGRATION!=='1')('S03 actual HTTP and PostgreSQL publication integrity',()=>{
  beforeAll(async()=>{
    const runtime=await loadRuntimeEnvironment();Object.assign(process.env,runtime.api);
    fixtures=JSON.parse(await readFile('.local/s03-fixtures.json','utf8')) as S03Fixtures;
    db=createS02Database();identity=createS02Auth(db);
    const compiled=await import('../dist/app.js' as string) as {createApp():Promise<INestApplication>};
    createApplication=compiled.createApp;
    app=await compiled.createApp();await app.listen(0,'127.0.0.1');base=await app.getUrl();
    const transport=(incoming:Request)=>fetch(base+new URL(incoming.url).pathname,{method:incoming.method,
      headers:{...Object.fromEntries(incoming.headers),host:'127.0.0.1:5890'},body:incoming.body,redirect:'manual',signal:AbortSignal.timeout(12000)});
    for(const [index,label] of (['A1','B1','PlatformOnly'] as const).entries()) {
      if(index===2) await Bun.sleep(11000);
      const signed=await openFixtureSession(identity,label,transport);
      const response=await fetch(base+'/api/session',{headers:{host:'127.0.0.1:5890',cookie:signed.headers.get('cookie')??''}});
      if(response.status!==200) throw new Error('Synthetic current session unavailable');
      clients.set(label,{signed,csrf:(await response.json() as CurrentSession).csrfToken});
    }
    const current=await request<SiteDraft>(`${prefix()}/site`);expect(current.status).toBe(200);
    const saved=await request<SiteDraft>(`${prefix()}/site`,'PUT',{slug:current.value.slug??'s03-synthetic-a',name:'S03 Synthetic Clinic',
      footer:{intro:'Synthetic footer',body:legacyDocument('Owned local test content')},expectedVersion:current.value.version});
    expect(saved.status).toBe(200);site=saved.value;
    const created=await request<PublicationService>(`${prefix()}/services`,'POST',content('Version One','<script>literal</script>\nSafe VI text'));
    expect(created.status).toBe(201);draft=created.value;
  },120000);
  afterAll(async()=>{await app?.close();await db?.close();});

  test('Drizzle and Bun transport a serialized document as a JSON object through an explicit text cast',async()=>{
    const document=legacyDocument('Driver regression <b>literal</b>\nNext line');
    const result=await db.tenantDb.execute(sql`SELECT jsonb_typeof(${JSON.stringify(document)}::text::jsonb) AS shape,
      gcms_s02.valid_document(${JSON.stringify(document)}::text::jsonb,20000) AS valid,${JSON.stringify(document)}::text::jsonb AS document`);
    expect(result[0]?.shape).toBe('object');expect(result[0]?.valid).toBe(true);expect(result[0]?.document).toEqual(document);
  });
  test('SQL document guard rejects missing/extra keys and CHECK never accepts NULL',async()=>{
    for(const value of [{x:0,version:1,blocks:[]},{type:'doc',version:1,blocks:[{type:'paragraph',children:[{type:'text',x:'a'}]}]},
      {type:'doc',version:1,blocks:[{type:'paragraph',children:[{type:'text',text:null}]}]},
      {type:'doc',version:1,blocks:[],extra:'unsafe'},null]) {
      const result=await db.tenantDb.execute(sql`SELECT gcms_s02.valid_document(${JSON.stringify(value)}::text::jsonb,20000) AS valid`);
      expect(result[0]?.valid).toBe(false);
    }
    await expect(db.withTenant(client().signed.actor,fixtures.tenants.A,tx=>tx.execute(sql`UPDATE gcms_s02.service_draft
      SET body_document='{"x":0,"version":1,"blocks":[]}'::jsonb WHERE tenant_id=${fixtures.tenants.A} AND id=${draft.id}`))).rejects.toThrow();
  });
  test('legacy read preserves S02 body, newlines, title and version exactly',async()=>{
    const original=await request<{body:string;title:string;version:number}>(`/api/tenants/${fixtures.tenants.A}/services/${fixtures.legacyServiceId}`);
    const upgraded=await request<PublicationService>(`${prefix()}/services/${fixtures.legacyServiceId}`);
    expect(upgraded.status).toBe(200);expect(richTextPlain(upgraded.value.body)).toBe(original.value.body);
    expect(upgraded.value.title).toBe(original.value.title);expect(upgraded.value.draftVersion).toBe(original.value.version);
  });
  test('anonymous, wrong-tenant and platform-only actors cannot inspect or publish drafts',async()=>{
    expect((await anonymous(servicePath())).status).toBe(401);
    expect((await request(servicePath(),'GET',undefined,'B1')).status).toBe(403);
    expect((await request(servicePath(),'GET',undefined,'PlatformOnly')).status).toBe(403);
    expect((await request(servicePath()+'/publish','POST',publishInput(),'PlatformOnly')).status).toBe(403);
    expect((await request(servicePath()+'/preview','GET',undefined,'B1')).status).toBe(403);
    expect((await anonymous(publicPath())).status).toBe(404);
    expect((await request(servicePath(),'PUT',{...content('Bad','x'),expectedDraftVersion:draft.draftVersion},'A1',{'x-csrf-token':'wrong'})).status).toBe(403);
  });
  test('first explicit publication is anonymous, no-store and safely literal',async()=>{
    const input=publishInput();const sameKey=await Promise.all([1,2].map(()=>request<PublicationResult>(servicePath()+'/publish','POST',input)));
    expect(sameKey.map(result=>result.status)).toEqual([200,200]);
    expect(sameKey.map(result=>result.value.replayed).sort()).toEqual([false,true]);
    expect(sameKey[0].value.publicationId).toBe(sameKey[1].value.publicationId);
    const result=sameKey.find(result=>!result.value.replayed)!;
    const publicPage=await anonymous(publicPath());expect(publicPage.status).toBe(200);
    expect(publicPage.value.service.title).toBe('Version One');expect(publicPage.value.site.name).toBe(site.name);
    expect(richTextPlain(publicPage.value.service.body)).toBe('<script>literal</script>\nSafe VI text');
    expect(publicPage.value.canonicalUrl).toBe(`http://localhost:5892/${site.slug}/dich-vu/${draft.slug}`);
    expect(publicPage.headers.get('cache-control')).toContain('no-store');
    expect((await anonymous(publicPath(),{'x-forwarded-host':'other.test'})).status).toBe(400);
    expect((await anonymous(publicPath(),{origin:'http://localhost:5892'})).status).toBe(403);
    expect((await anonymous(publicPath().replace('/care-','/%63are-'))).status).toBe(400);
    const replay=await request<PublicationResult>(servicePath()+'/publish','POST',input);
    expect(replay.status).toBe(200);expect(replay.value.publicationId).toBe(result.value.publicationId);expect(replay.value.replayed).toBe(true);
    expect((await request(servicePath()+'/publish','POST',{...input,expectedDraftVersion:input.expectedDraftVersion+1})).status).toBe(409);
    draft=(await request<PublicationService>(servicePath())).value;
  });
  test('pending service and site drafts do not mutate the immutable public closure',async()=>{
    const saved=await request<PublicationService>(servicePath(),'PUT',{...content('Version Two','Pending body'),expectedDraftVersion:draft.draftVersion});
    expect(saved.status).toBe(200);draft=saved.value;
    const changed=await request<SiteDraft>(`${prefix()}/site`,'PUT',{slug:site.slug,name:'Pending Site Name',footer:site.footer,expectedVersion:site.version});
    expect(changed.status).toBe(200);site=changed.value;
    const page=await anonymous(publicPath());expect(page.value.service.title).toBe('Version One');expect(page.value.site.name).toBe('S03 Synthetic Clinic');
    const preview=await request<{service:PublicationService;site:SiteDraft}>(servicePath()+'/preview');
    expect(preview.value.service.title).toBe('Version Two');expect(preview.value.site.name).toBe('Pending Site Name');
    expect(draft.publishedDraftVersion).toBe(1);expect(draft.draftVersion).toBe(2);
    expect((await request(servicePath()+'/publish','POST',{...publishInput(),expectedDraftVersion:1})).status).toBe(409);
    const competing=await Promise.all([1,2].map(()=>request<PublicationResult>(servicePath()+'/publish','POST',publishInput())));
    expect(competing.map(result=>result.status).sort()).toEqual([200,409]);
    expect((await anonymous(publicPath())).value.service.title).toBe('Version Two');
    draft=(await request<PublicationService>(servicePath())).value;
  });
  test('legacy S02 save clears stale rich text, preserves publication, and locked slugs reject edits',async()=>{
    const updated=await request(`/api/tenants/${fixtures.tenants.A}/services/${draft.id}`,'PUT',{title:'Legacy edit',body:'<b>New literal</b>\nNew line',expectedVersion:draft.draftVersion});
    expect(updated.status).toBe(200);
    draft=(await request<PublicationService>(servicePath())).value;expect(richTextPlain(draft.body)).toBe('<b>New literal</b>\nNew line');
    expect((await anonymous(publicPath())).value.service.title).toBe('Version Two');
    expect((await request(servicePath(),'PUT',{...content('Changed','body'),slug:'different-slug',expectedDraftVersion:draft.draftVersion})).status).toBe(409);
    expect((await request(`${prefix()}/site`,'PUT',{slug:'different-site',name:site.name,footer:site.footer,expectedVersion:site.version})).status).toBe(409);
  });
  test('restricted roles see no ambient private rows and immutable snapshots cannot be changed',async()=>{
    expect((await db.tenantDb.execute(sql`SELECT id FROM gcms_s02.publication_snapshot`)).length).toBe(0);
    // PgRaw is a lazy thenable. Assimilate it so the matcher executes the query.
    await expect(Promise.resolve(db.platformDb.execute(sql`SELECT id FROM gcms_s02.publication_snapshot`))).rejects.toThrow();
    await expect(db.withTenant(client().signed.actor,fixtures.tenants.A,tx=>tx.execute(sql`UPDATE gcms_s02.publication_snapshot SET closure='{}'::jsonb WHERE tenant_id=${fixtures.tenants.A}`))).rejects.toThrow();
    await expect(db.withTenant(client().signed.actor,fixtures.tenants.A,tx=>tx.execute(sql`DELETE FROM gcms_s02.publication_intent WHERE tenant_id=${fixtures.tenants.A} AND service_id=${draft.id}`))).rejects.toThrow();
    await expect(db.withTenant(client().signed.actor,fixtures.tenants.A,tx=>tx.execute(sql`UPDATE gcms_s02.publication_pointer
      SET snapshot_id=(SELECT id FROM gcms_s02.publication_snapshot WHERE tenant_id=${fixtures.tenants.A} AND service_id=${draft.id} AND publication_version=1)
      WHERE tenant_id=${fixtures.tenants.A} AND service_id=${draft.id}`))).rejects.toThrow();
    const counts=await db.withTenant(client().signed.actor,fixtures.tenants.A,tx=>tx.execute(sql`SELECT
      (SELECT count(*) FROM gcms_s02.publication_snapshot WHERE tenant_id=${fixtures.tenants.A} AND service_id=${draft.id}) AS snapshots,
      (SELECT count(*) FROM gcms_s02.publication_intent WHERE tenant_id=${fixtures.tenants.A} AND service_id=${draft.id}) AS intents`));
    expect(Number(counts[0]?.snapshots)).toBe(2);expect(Number(counts[0]?.intents)).toBe(2);
  });
  test('precommit failure rolls snapshot, pointer and intent back without a partial publication',async()=>{
    const previous=await anonymous(publicPath());
    await expect(db.withTenant(client().signed.actor,fixtures.tenants.A,async tx=>{
      await tx.execute(sql`INSERT INTO gcms_s02.publication_snapshot(tenant_id,service_id,id,publication_version,draft_version,site_version,request_key,request_fingerprint,closure,published_by)
        SELECT d.tenant_id,d.id,${randomUUID()},3,d.version,s.version,${randomUUID()},${'0'.repeat(64)},gcms_s02.snapshot_closure(d,s),${client().signed.actor.userId}
        FROM gcms_s02.service_draft d JOIN gcms_s02.site_draft s ON s.tenant_id=d.tenant_id WHERE d.tenant_id=${fixtures.tenants.A} AND d.id=${draft.id}`);
      throw new Error('Synthetic precommit failure');
    })).rejects.toThrow('Synthetic precommit failure');
    expect((await anonymous(publicPath())).value.publicationId).toBe(previous.value.publicationId);
    const snapshots=await db.withTenant(client().signed.actor,fixtures.tenants.A,tx=>tx.execute(sql`SELECT id FROM gcms_s02.publication_snapshot WHERE tenant_id=${fixtures.tenants.A} AND service_id=${draft.id}`));
    expect(snapshots.length).toBe(2);
  });
  test('deferred SQL closure rejects a committed snapshot without its pointer and intent',async()=>{
    await expect(db.withTenant(client().signed.actor,fixtures.tenants.A,async tx=>{
      await tx.execute(sql`INSERT INTO gcms_s02.publication_snapshot(tenant_id,service_id,id,publication_version,draft_version,site_version,request_key,request_fingerprint,closure,published_by)
        SELECT d.tenant_id,d.id,${randomUUID()},3,d.version,s.version,${randomUUID()},${'1'.repeat(64)},gcms_s02.snapshot_closure(d,s),${client().signed.actor.userId}
        FROM gcms_s02.service_draft d JOIN gcms_s02.site_draft s ON s.tenant_id=d.tenant_id WHERE d.tenant_id=${fixtures.tenants.A} AND d.id=${draft.id}`);
    })).rejects.toThrow();
    const snapshots=await db.withTenant(client().signed.actor,fixtures.tenants.A,tx=>tx.execute(sql`SELECT id FROM gcms_s02.publication_snapshot WHERE tenant_id=${fixtures.tenants.A} AND service_id=${draft.id}`));
    expect(snapshots.length).toBe(2);
  });
  test('two tenants can publish the same service slug without crossing closures or registry ownership',async()=>{
    const otherPrefix=`/api/tenants/${fixtures.tenants.B}/publication`;
    const existing=await request<SiteDraft>(otherPrefix+'/site','GET',undefined,'B1');
    const otherSite=await request<SiteDraft>(otherPrefix+'/site','PUT',{slug:existing.value.slug??'s03-synthetic-b',name:'Other Tenant',
      footer:{intro:'Other footer',body:legacyDocument('Other tenant only')},expectedVersion:existing.value.version},'B1');
    expect(otherSite.status).toBe(200);
    const otherDraft=await request<PublicationService>(otherPrefix+'/services','POST',content('Tenant B Service','Only B content'),'B1');
    expect(otherDraft.status).toBe(201);expect(otherDraft.value.slug).toBe(draft.slug);
    const otherPublish=await request(otherPrefix+`/services/${otherDraft.value.id}/publish`,'POST',{expectedDraftVersion:1,
      expectedPublicationVersion:0,expectedSiteVersion:otherSite.value.version,requestKey:randomUUID()},'B1');
    expect(otherPublish.status).toBe(200);
    const publicB=await anonymous(`/api/public/sites/${otherSite.value.slug}/services/${draft.slug}`);
    expect(publicB.value.service.title).toBe('Tenant B Service');expect(publicB.value.site.name).toBe('Other Tenant');
    expect((await anonymous(publicPath())).value.service.title).toBe('Version Two');
    expect((await request(otherPrefix+'/site','PUT',{slug:site.slug,name:'Theft',footer:site.footer,expectedVersion:otherSite.value.version},'B1')).status).toBe(409);
  });
  test('current membership revocation denies later drafts and publication while retaining the last administrator',async()=>{
    const revocationPrefix=`/api/tenants/${fixtures.tenants.revocation}`;
    // A previous run may already have revoked A1. Do not restore a retained grant.
    const available=await request(revocationPrefix+'/publication/site');
    if(available.status===403) {
      expect((await request(revocationPrefix+'/publication/services')).status).toBe(403);return;
    }
    expect(available.status).toBe(200);
    const removed=await request(revocationPrefix+`/members/${client().signed.actor.userId}`,'DELETE',{});
    expect(removed.status).toBe(200);
    expect((await request(revocationPrefix+'/publication/services')).status).toBe(403);
    const denied=await request(revocationPrefix+`/publication/services/${draft.id}/publish`,'POST',publishInput());
    expect(denied.status).toBe(403);
    const retained=await db.withTenant(client().signed.actor,fixtures.tenants.A,tx=>tx.execute(sql`SELECT 1`));
    expect(retained.length).toBe(1);
  });
  test('recent reauthentication and current tenant suspension govern every publication and public read',async()=>{
    const signed=client().signed;
    await db.authSql`UPDATE gcms_s02_auth.session SET created_at=now()-interval '6 minutes' WHERE id=${signed.actor.sessionId}`;
    await db.authSql`DELETE FROM gcms_s02_auth.reauth_grant WHERE session_id=${signed.actor.sessionId}`;
    const denied=await request<{code:string}>(servicePath()+'/publish','POST',publishInput());
    expect(denied.status).toBe(403);expect(denied.value.code).toBe('REAUTH_REQUIRED');
    const reauthenticated=await request('/api/session/reauth','POST',{password:signed.fixture.password});
    expect(reauthenticated.status).toBe(200);
    const published=await request<PublicationResult>(servicePath()+'/publish','POST',publishInput());
    expect(published.status).toBe(200);
    draft=(await request<PublicationService>(servicePath())).value;
    await db.withPlatform(client('PlatformOnly').signed.actor,tx=>tx.execute(sql`UPDATE gcms_s02.tenant SET status='suspended' WHERE id=${fixtures.tenants.A}`));
    try {
      expect((await anonymous(publicPath())).status).toBe(404);
      expect((await request(servicePath()+'/publish','POST',publishInput())).status).toBe(403);
    } finally {
      await db.withPlatform(client('PlatformOnly').signed.actor,tx=>tx.execute(sql`UPDATE gcms_s02.tenant SET status='active' WHERE id=${fixtures.tenants.A}`));
    }
    expect((await anonymous(publicPath())).status).toBe(200);
  });
  test('a discarded postcommit response replays once and the durable intent survives application restart',async()=>{
    const loss=await request<PublicationService>(`${prefix()}/services`,'POST',{...content('Response loss service','Durable body'),slug:`loss-${run}`});
    expect(loss.status).toBe(201);
    const path=`${prefix()}/services/${loss.value.id}/publish`;
    const input={expectedDraftVersion:loss.value.draftVersion,expectedPublicationVersion:0,expectedSiteVersion:site.version,requestKey:randomUUID()};
    const c=client();
    const response=await fetch(base+path,{method:'POST',headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891',
      cookie:c.signed.headers.get('cookie')??'','content-type':'application/json','x-csrf-token':c.csrf},body:JSON.stringify(input),signal:AbortSignal.timeout(12000)});
    expect(response.status).toBe(200);
    // Deliberately discard the successful response body. The retry cannot rely on its publication ID.
    await response.body?.cancel();
    await app!.close();app=await createApplication();await app.listen(0,'127.0.0.1');base=await app.getUrl();
    const replay=await request<PublicationResult>(path,'POST',input);
    expect(replay.status).toBe(200);expect(replay.value.replayed).toBe(true);
    const rows=await db.withTenant(c.signed.actor,fixtures.tenants.A,tx=>tx.execute(sql`SELECT s.id,i.snapshot_id,p.snapshot_id AS active
      FROM gcms_s02.publication_snapshot s JOIN gcms_s02.publication_intent i ON i.tenant_id=s.tenant_id AND i.service_id=s.service_id AND i.snapshot_id=s.id
      JOIN gcms_s02.publication_pointer p ON p.tenant_id=s.tenant_id AND p.service_id=s.service_id
      WHERE s.tenant_id=${fixtures.tenants.A} AND s.service_id=${loss.value.id}`));
    expect(rows.length).toBe(1);expect(rows[0]?.id).toBe(replay.value.publicationId);
    expect(rows[0]?.snapshot_id).toBe(replay.value.publicationId);expect(rows[0]?.active).toBe(replay.value.publicationId);
    expect((await anonymous(`/api/public/sites/${site.slug}/services/${loss.value.slug}`)).value.service.title).toBe('Response loss service');
  });
});
