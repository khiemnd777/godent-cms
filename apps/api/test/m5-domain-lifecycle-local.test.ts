import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { M5Harness } from './m5-support';
import { readM5Demo, type M5Demo } from '../../../scripts/m5-demo';
import { M5_DOMAIN_ROUTES, type M5DomainsView, type M5DomainBinding, type M5DomainCommandResult } from '../src/contracts/m5-domains';
import { M4_ROUTES } from '../src/contracts/m4';
describe.skipIf(process.env.M5_INTEGRATION!=='1')('M5 controlled domain lifecycle and URL-context races',()=>{
 const h=new M5Harness();let d:M5Demo,primary:M5DomainBinding,www:M5DomainBinding,registration:{operationId:string;host:string},activation:Record<string,unknown>;
 beforeAll(async()=>{await h.setup(['A1','B1']);d=await readM5Demo();const v=await view();primary=v.bindings.find(b=>b.id===v.primary.bindingId)!;expect(primary.host).toBe(d.tenantSlug+'.localhost');},30000);
 afterAll(async()=>{await h.close();});
 async function view(){const r=await h.call<M5DomainsView>(M5_DOMAIN_ROUTES.list(h.tenant().id));expect(r.status).toBe(200);return r.value;}
 async function change(binding:M5DomainBinding,action:'reverify'|'deactivate'|'remove'){const v=await view();const r=await h.call<M5DomainCommandResult>(M5_DOMAIN_ROUTES.change(h.tenant().id,binding.id,action),'POST',{operationId:randomUUID(),expectedVersion:binding.version,expectedPrimaryVersion:v.primary.version,reason:'Explicit owned M5 '+action});expect(r.status).toBe(200);return r.value;}
 async function verify(binding:M5DomainBinding){const r=await h.call<M5DomainCommandResult>(M5_DOMAIN_ROUTES.verify(h.tenant().id,binding.id),'POST',{operationId:randomUUID(),expectedVersion:binding.version});expect(r.status).toBe(200);const current=await view();expect(r.value.readiness).toEqual(current.readiness);expect(r.value.primary).toEqual(current.primary);return r.value.bindings.find(b=>b.id===binding.id)!;}
 async function activate(binding:M5DomainBinding){const v=await view(),command={operationId:randomUUID(),expectedPrimaryVersion:v.primary.version,mode:'custom',bindingId:binding.id,expectedBindingVersion:binding.version,reason:'Controlled M5 replacement'};const r=await h.call<M5DomainCommandResult>(M5_DOMAIN_ROUTES.primary(h.tenant().id),'POST',command);expect(r.status).toBe(200);return{command,result:r.value};}
 async function website(host:string,path:string,method='GET'){return fetch('http://127.0.0.1:5892'+path,{method,redirect:'manual',headers:{host:host+':5892'},signal:AbortSignal.timeout(15000)});}
 test('www is a distinct exact binding; another tenant cannot claim the registered host',async()=>{
  const host='www.'+primary.host;const existing=(await view()).bindings.find(b=>b.host===host&&b.state!=='removed');if(existing)await change(existing,'remove');registration={operationId:randomUUID(),host};const r=await h.call<M5DomainCommandResult>(M5_DOMAIN_ROUTES.register(h.tenant().id),'POST',registration);expect(r.status).toBe(201);www=r.value.bindings.find(b=>b.id===r.value.bindingId)!;expect(www.host).not.toBe(primary.host);const conflict=await h.call(M5_DOMAIN_ROUTES.register(h.tenant('B').id),'POST',{operationId:randomUUID(),host},'B1');expect(conflict.status).toBe(409);www=await verify(www);
 });
 test('replacement sends both previous entries directly to the new primary; deactivation denies only the old alias',async()=>{
  const a=await activate(www);activation=a.command;const page=d.entries.find(e=>e.key==='page')!,suffix='/en/'+page.slug,target='http://'+www.host+':5892'+suffix;
  for(const [host,path]of [['localhost','/'+d.tenantSlug+suffix],[primary.host,suffix]])for(const method of ['GET','HEAD']){const r=await website(host,path,method);expect(r.status).toBe(301);expect(r.headers.get('location')).toBe(target);if(method==='HEAD')expect(await r.text()).toBe('');}
  await activate(primary);const v=await change(www,'deactivate');www=v.bindings.find(b=>b.id===www.id)!;expect((await website(www.host,suffix)).status).toBe(421);expect((await website(primary.host,suffix)).status).toBe(200);
 });
 test('remove and re-register allocate a new identity/generation; old receipts cannot resurrect the removed binding',async()=>{
  const removed=await change(www,'remove'),old=removed.bindings.find(b=>b.id===www.id)!;expect(old.state).toBe('removed');const created=await h.call<M5DomainCommandResult>(M5_DOMAIN_ROUTES.register(h.tenant().id),'POST',{operationId:randomUUID(),host:www.host});expect(created.status).toBe(201);const next=created.value.bindings.find(b=>b.id===created.value.bindingId)!;expect(next.id).not.toBe(old.id);expect(next.id+':'+next.generation).not.toBe(old.id+':'+old.generation);expect(next.generation).toBeGreaterThanOrEqual(1);expect(next.state).toBe('pending');
  const replay=await h.call<M5DomainCommandResult>(M5_DOMAIN_ROUTES.register(h.tenant().id),'POST',registration);expect(replay.status).toBe(201);expect(replay.value.replayed).toBe(true);expect(replay.value.bindings.find(b=>b.id===old.id)?.state).toBe('removed');const reactivation=await h.call<M5DomainCommandResult>(M5_DOMAIN_ROUTES.primary(h.tenant().id),'POST',activation);expect(reactivation.status).toBe(200);expect(reactivation.value.replayed).toBe(true);expect(reactivation.value.primary.bindingId).toBe(primary.id);expect((await website(next.host,'/')).status).toBe(421);www=await verify(next);await change(www,'remove');
 });
 test('primary reverify keeps its identity while denying stale entry pins until explicit fresh verification',async()=>{
  const before=await view(),old=before.bindings.find(b=>b.id===primary.id)!,entry=await h.public(M5_DOMAIN_ROUTES.entry(primary.host+':5892','/'));expect(entry.status).toBe(200);const changed=await change(old,'reverify'),pending=changed.bindings.find(b=>b.id===primary.id)!;expect(changed.primary.bindingId).toBe(primary.id);expect(pending.generation).toBe(old.generation+1);
  try{expect(changed.readiness.ready).toBe(false);expect(typeof changed.primary.origin).toBe('string');expect((await website(primary.host,'/')).status).toBe(421);expect((await h.public(M5_DOMAIN_ROUTES.entry('localhost:5892','/'+d.tenantSlug))).status).toBe(404);
  }finally{primary=await verify(pending);}
  const page=d.entries.find(e=>e.key==='page')!;const stale=await h.public(M4_ROUTES.publicPage(d.tenantSlug,'vi','page',page.slug),'GET',undefined,'http://localhost:5892',{'x-gcms-primary-version':String(before.primary.version),'x-gcms-entry-binding':old.id,'x-gcms-entry-generation':String(old.generation)});expect(stale.status).toBe(409);expect(stale.value).not.toHaveProperty('page');expect((await website(primary.host,'/'+page.slug)).status).toBe(200);
 });
});
