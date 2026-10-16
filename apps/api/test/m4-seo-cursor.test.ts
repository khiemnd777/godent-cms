import {describe,expect,test} from 'bun:test';
import {BuilderService} from '../src/modules/builder.service';
import type {S02Database} from '../src/database';
import type {S02Auth} from '../src/auth';
import {decodePageCursor,encodePageCursor,type PrivateRequest} from '../src/modules/request-security';
import {decodeM4SeoCursor,encodeM4SeoCursor} from '../src/modules/builder-seo-cursor';
import {M4_KINDS,M4_LOCALES} from '../src/contracts/m4';

describe('M4 SEO continuation cursor',()=>{
 const tenant='synthetic-seo',scope=tenant+':m4-seo',id='11111111-1111-4111-8111-111111111111';
 test('SEO service accepts its own issued50-row continuation',async()=>{
  const items=Array.from({length:51},(_,index)=>({kind:'page',id:`11111111-1111-4111-8111-${index.toString().padStart(12,'0')}`,locale:'vi'})),database={verifyRoles:async()=>{},tenantDb:{transaction:async(action:(tx:{execute:()=>Promise<{result:typeof items}[]>})=>Promise<unknown>)=>action({execute:async()=>[{result:items}]})}} as unknown as S02Database,service=new BuilderService(database,{} as S02Auth),request:PrivateRequest={headers:{host:'127.0.0.1:5890'},method:'GET',originalUrl:'/api/public/builder/synthetic-seo/seo'};
  const first=await service.seo(request,'synthetic-seo',{});expect(first.items).toHaveLength(50);expect(first.nextCursor).toBeString();await expect(service.seo(request,'synthetic-seo',{cursor:first.nextCursor})).resolves.toMatchObject({items:first.items});
 });
 test('every known kind and locale roundtrips through a tenant-bound opaque token',()=>{
  expect(decodeM4SeoCursor(undefined,tenant)).toBeNull();for(const kind of M4_KINDS)for(const locale of M4_LOCALES){const cursor=encodeM4SeoCursor(tenant,{kind,id,locale});expect(decodeM4SeoCursor(cursor,tenant)).toBe(`${kind}:${id}:${locale}`);expect(decodePageCursor(cursor,scope)).toMatch(/^[A-Za-z0-9_-]{1,128}$/);expect(()=>decodeM4SeoCursor(cursor,'other-tenant')).toThrow();}
 });
 test('rejects malformed composite keys, unrelated contexts and the old raw-colon representation',()=>{
  const inner=(after:string)=>Buffer.from(after).toString('base64url');for(const after of [`config:${id}:vi`,`invented:${id}:en`,`page:${id}:fr`,`page:${id}:vi:extra`,'page:invalid:vi',`PAGE:${id}:vi`,'',`page:${id}:VI`])expect(()=>decodeM4SeoCursor(encodePageCursor(scope,inner(after)),tenant)).toThrow();
  const valid=encodeM4SeoCursor(tenant,{kind:'page',id,locale:'vi'});for(const input of [null,[],{},123,valid+'=',valid.slice(0,-1),'x'.repeat(601),encodePageCursor(tenant+':services',inner(`page:${id}:vi`))])expect(()=>decodeM4SeoCursor(input,tenant)).toThrow();
  const old=encodePageCursor(scope,`page:${id}:vi`);expect(()=>decodeM4SeoCursor(old,tenant)).toThrow();expect(()=>decodePageCursor(old,scope)).toThrow();
 });
 test('rejects noncanonical inner bits and outer payloads without relaxing generic cursors',()=>{
  const inner=Buffer.from(`page:${id}:vi`).toString('base64url'),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',noncanonical=inner.slice(0,-1)+alphabet[alphabet.indexOf(inner.at(-1)!)+1];expect(Buffer.from(noncanonical,'base64url')).toEqual(Buffer.from(inner,'base64url'));expect(()=>decodeM4SeoCursor(encodePageCursor(scope,noncanonical),tenant)).toThrow();
  for(const payload of [{after:inner,scope},{scope,after:inner,extra:true}])expect(()=>decodeM4SeoCursor(Buffer.from(JSON.stringify(payload)).toString('base64url'),tenant)).toThrow();
  const ordinary=encodePageCursor('synthetic:services',id);expect(decodePageCursor(ordinary,'synthetic:services')).toBe(id);expect(()=>decodeM4SeoCursor(ordinary,tenant)).toThrow();
 });
});
