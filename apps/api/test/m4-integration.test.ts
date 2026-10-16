import {afterAll,beforeAll,describe,expect,test} from 'bun:test';
import {randomUUID} from 'node:crypto';
import {M4Harness} from './m4-support';
import {M4_ROUTES,type M4CommandResult,type M4Resolution} from '../src/contracts/m4';
const enabled=process.env.M4_INTEGRATION==='1';
(enabled?describe:describe.skip)('M4 isolated API/SQL publication',()=>{
 const h=new M4Harness();beforeAll(()=>h.setup(),60000);afterAll(()=>h.close());
 test('config and home save/preview/publish keep pending content private and config updates all adopted pages',async()=>{
  const config=await h.config();expect(config.publicationId).toBeString();let home=await h.create('home',h.content('home'));
  const privatePage=await h.public(M4_ROUTES.publicPage(h.tenantSlug,'vi','home','home'));expect(privatePage.status).toBe(404);
  const preview=await h.call(h.path(home)+'/preview');expect(preview.status).toBe(200);expect(preview.value.issues).toEqual([]);
  home=await h.publish(home);const live=await h.public<M4Resolution>(M4_ROUTES.publicPage(h.tenantSlug,'vi','home','home'));expect(live.status).toBe(200);expect(live.value.resolution).toBe('page');if(live.value.resolution!=='page')throw new Error('Expected page');const p=live.value.page;expect(p.configPublicationId).toBe(config.publicationId);expect(p.sections).toHaveLength(2);expect(p.sections[0].action).toBeNull();
  home=await h.save(home,{...home.content,title:'Private pending V2'});const unchanged=await h.public<M4Resolution>(M4_ROUTES.publicPage(h.tenantSlug,'vi','home','home'));expect(unchanged.value.resolution).toBe('page');if(unchanged.value.resolution==='page')expect((unchanged.value.page.content as {title:string}).title).toBe('Synthetic page');
  const editedConfig=await h.save(config,{...config.content,name:'New published brand'});const published=await h.publish(editedConfig);const updated=await h.public<M4Resolution>(M4_ROUTES.publicPage(h.tenantSlug,'vi','home','home'));expect(updated.status).toBe(200);if(updated.value.resolution==='page'){expect(updated.value.page.publicationId).toBe(p.publicationId);expect(updated.value.page.configPublicationId).toBe(published.publicationId);expect((updated.value.page.content as {title:string}).title).toBe('Synthetic page');}
  const denied=await h.call(h.path(home),'GET',undefined,'B1');expect(denied.status).toBe(403);const platform=await h.call(h.path(home),'GET',undefined,'PlatformOnly');expect(platform.status).toBe(403);
 },60000);
 test('receipts, stale saves, restores, locale heads and fallback remain independent',async()=>{
  await h.config('en');let page=await h.create('page',h.content('page'));page=await h.publish(page);const body={operationId:randomUUID(),expectedVersion:page.version,content:{...page.content,title:'Saved once'}};
  const first=await h.call<M4CommandResult>(h.path(page),'PUT',body),replay=await h.call<M4CommandResult>(h.path(page),'PUT',body);expect(first.status).toBe(200);expect(replay.status).toBe(200);expect(replay.value.replayed).toBe(true);expect(replay.value.draft.version).toBe(first.value.draft.version);
  const mismatch=await h.call(h.path(page),'PUT',{...body,content:{...page.content,title:'Changed payload'}});expect(mismatch.status).toBe(409);
  const stale=await h.call(h.path(page),'PUT',{operationId:randomUUID(),expectedVersion:page.version,content:page.content});expect(stale.status).toBe(409);
  const history=await h.call<{items:{id:string;version:number}[]}>(h.path(page)+'/history');expect(history.status).toBe(200);expect(history.value.items).toHaveLength(2);const source=history.value.items.find(i=>i.version===1)!;const restored=await h.call<M4CommandResult>(h.path(page)+'/restore','POST',{operationId:randomUUID(),expectedVersion:first.value.draft.version,sourceRevisionId:source.id});expect(restored.status).toBe(200);expect(restored.value.draft.version).toBe(3);expect(restored.value.draft.publicationId).toBe(page.publicationId);expect((restored.value.draft.content as {title:string}).title).toBe((page.content as {title:string}).title);
  const slug=(page.content as {slug:string}).slug;const fallback=await h.public<M4Resolution>(M4_ROUTES.publicPage(h.tenantSlug,'en','page',slug));expect(fallback.status).toBe(200);expect(fallback.value.resolution).toBe('fallback');
  const enPath=M4_ROUTES.resource(h.tenantId,'page',page.id,'en');const en=await h.call<M4CommandResult>(enPath,'PUT',{operationId:randomUUID(),expectedVersion:0,content:{...page.content,title:'English page'}});expect(en.status).toBe(200);const publishedEn=await h.publish(en.value.draft);const english=await h.public<M4Resolution>(M4_ROUTES.publicPage(h.tenantSlug,'en','page',slug));expect(english.status).toBe(200);if(english.value.resolution==='page'){expect(english.value.actualLocale).toBe('en');expect((english.value.page.content as {title:string}).title).toBe('English page');expect(english.value.page.alternates).toHaveLength(2);}else throw new Error('EN missing');
  const unpublish=await h.call(h.path(publishedEn)+'/unpublish','POST',{operationId:randomUUID(),expectedVersion:publishedEn.version,expectedPublicationRevision:publishedEn.publicationRevision});expect(unpublish.status).toBe(200);const again=await h.public<M4Resolution>(M4_ROUTES.publicPage(h.tenantSlug,'en','page',slug));expect(again.value.resolution).toBe('fallback');
 },60000);
});
