import { beforeAll, afterAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { M5Harness } from './m5-support';
import { readM5Demo, type M5Demo } from '../../../scripts/m5-demo';
import { M5_DOMAIN_ROUTES, type M5DomainsView, type M5DomainCommandResult } from '../src/contracts/m5-domains';
import { m4PublicPath } from '../src/contracts/m4';

describe.skipIf(process.env.M5_INTEGRATION !== '1')('M5 actual built website HTTP and SEO entry contracts', () => {
 const h=new M5Harness();let d:M5Demo,host:string;
 beforeAll(async()=>{d=await readM5Demo();expect(d.status).toBe('complete');await h.setup(['A1']);host=d.tenantSlug+'.localhost:5892';},30000);
 afterAll(async()=>{await h.close();});
 const request=(authority:string,path:string,method='GET',extra:Record<string,string>={})=>fetch('http://127.0.0.1:5892'+path,{method,redirect:'manual',headers:{host:authority,...extra},signal:AbortSignal.timeout(20000)});
 async function view(){const r=await h.call<M5DomainsView>(M5_DOMAIN_ROUTES.list(d.tenantId));expect(r.status).toBe(200);return r.value;}
 async function primary(mode:'custom'|'godent'){const v=await view(),b=v.bindings.find(b=>b.host===d.tenantSlug+'.localhost')!;const body={operationId:randomUUID(),expectedPrimaryVersion:v.primary.version,mode,reason:'Explicit local HTTP entry test',...(mode==='custom'?{bindingId:b.id,expectedBindingVersion:b.version}:{acknowledgeCachedRedirects:true})};const r=await h.call<M5DomainCommandResult>(M5_DOMAIN_ROUTES.primary(d.tenantId),'POST',body);expect(r.status).toBe(200);return r.value;}
 test('GET/HEAD Godent aliases directly 301 to the same published page and actual language',async()=>{
  await primary('custom');
  for(const entry of d.entries.filter(e=>e.key!=='viOnly'))for(const locale of entry.locales){const path=m4PublicPath(d.tenantSlug,locale,entry.kind,entry.kind==='home'?undefined:entry.slug),target='http://'+host+(path.slice(d.tenantSlug.length+1)||'/');
   for(const method of ['GET','HEAD']){const r=await request('localhost:5892',path,method);expect(r.status).toBe(301);expect(r.headers.get('location')).toBe(target);expect(r.headers.get('set-cookie')).toBeNull();expect(r.headers.get('cache-control')).toContain('no-store');if(method==='HEAD')expect(await r.text()).toBe('');}
   const rendered=await request(host,new URL(target).pathname);expect(rendered.status).toBe(200);const html=await rendered.text();expect(html).toContain(`<html lang="${locale}"`);expect(html).toContain(`rel="canonical" href="${target}"`);
  }
 },60000);
 test('missing EN directly302 to primaryVI, absent pages404, methods/intake keep dedicated contracts',async()=>{
  const entry=d.entries.find(e=>e.key==='viOnly')!,path=m4PublicPath(d.tenantSlug,'en','page',entry.slug),target='http://'+host+'/'+entry.slug;
  for(const method of ['GET','HEAD']){const r=await request('localhost:5892',path,method);expect(r.status).toBe(302);expect(r.headers.get('location')).toBe(target);if(method==='HEAD')expect(await r.text()).toBe('');}
  expect((await request('localhost:5892',`/${d.tenantSlug}/missing-${h.run}`)).status).toBe(404);
  expect((await request(host,'/missing-'+h.run)).status).toBe(404);
  expect((await request('localhost:5892',path,'POST')).status).toBe(405);
  expect((await h.public('/api/public/sites/'+d.tenantSlug+'/services/'+h.tenant().serviceSlug)).status).toBe(200);
 });
 test('tracking allowlist and functional listing query survive a direct redirect',async()=>{
  const r=await request('localhost:5892',`/${d.tenantSlug}/dich-vu?q=M5&utm_source=local&utm_medium=case&utm_campaign=m5&utm_term=drop&unknown=drop`);expect(r.status).toBe(301);const target=new URL(r.headers.get('location')!);expect(target.host).toBe(host);expect(target.pathname).toBe('/dich-vu');expect(Object.fromEntries(target.searchParams)).toEqual({q:'M5',utm_campaign:'m5',utm_medium:'case',utm_source:'local'});
 });
 test('sitemap and robots pass exact metadata routes on each valid entry',async()=>{
  for(const [authority,path]of [['localhost:5892','/'+d.tenantSlug+'/sitemap.xml'],[host,'/sitemap.xml']]){const r=await request(authority,path);expect(r.status).toBe(200);const xml=await r.text();expect(xml).toContain('http://'+host+'/en/');expect(xml).toContain('hreflang="en"');}
  for(const [authority,path]of [['localhost:5892','/robots.txt'],['localhost:5892','/'+d.tenantSlug+'/robots.txt'],[host,'/robots.txt']]){const r=await request(authority,path);expect(r.status).toBe(200);expect(await r.text()).toContain('Disallow: /');}
 });
 test('return to Godent keeps old custom200 with correct canonical and working absolute navigation',async()=>{
  await primary('godent');try{const r=await request(host,'/');expect(r.status).toBe(200);const html=await r.text(),home='http://localhost:5892/'+d.tenantSlug;expect(html).toContain(`rel="canonical" href="${home}"`);const page=d.entries.find(e=>e.key==='page')!;expect(html).toContain(`href="${home}/${page.slug}"`);expect((await request('localhost:5892','/'+d.tenantSlug)).status).toBe(200);
  }finally{await primary('custom');}
 });
 test('untrusted forwarded context and credentials cannot change tenant, language or publication',async()=>{
  const entry=d.entries.find(e=>e.key==='page')!,r=await request(host,'/en/'+entry.slug,'GET',{'x-gcms-entry':JSON.stringify({tenantId:h.tenant('B').id}),'x-gcms-locale':'vi','x-gcms-primary-version':'0','x-gcms-expected-publication':randomUUID(),authorization:'Bearer ignored-synthetic',cookie:'ignored_synthetic=1','x-forwarded-host':'evil.example'});expect(r.status).toBe(200);expect(r.headers.get('set-cookie')).toBeNull();expect(await r.text()).toContain('<html lang="en"');
 });
});
