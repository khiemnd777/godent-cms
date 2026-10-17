import {afterAll,beforeAll,describe,expect,test} from 'bun:test';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {PgDialect} from 'drizzle-orm/pg-core';
import type {SQL} from 'drizzle-orm';
import type {S02Database} from '../src/database';
import type {S02Auth} from '../src/auth';
import {M4_LOCALES,M4_ROUTES,type M4IntakeSourceKind} from '../src/contracts/m4';
import {apiSecurity} from '../src/modules/http-security';
import {configurePublicIntakeOrigins,isPublicIntakeRoute} from '../src/modules/intake-security';
import {M5DomainsService} from '../src/modules/m5-domains.service';
const tenant='synthetic-clinic',publicOrigin='http://localhost:5892',customOrigin='http://clinic.localhost:5892';
const sources:Record<M4IntakeSourceKind,string>={service:'care',landing:'campaign',home:'home',page:'contact'};
let lookups=0;
const dialect=new PgDialect(),db={verifyRoles:async()=>{},tenantDb:{execute:async(statement:SQL)=>{lookups++;const {params}=dialect.sqlToQuery(statement);return [{allowed:params[0]===customOrigin&&params[1]===tenant}];}}} as unknown as S02Database;
const domains=new M5DomainsService(db,{} as S02Auth);
function boundary(path:string,method='POST',extra:Record<string,string|undefined>={}) {return new Promise<{passed:boolean;status:number;headers:Map<string,string>}>(resolve=>{
 const headers=new Map<string,string>(),request={originalUrl:path,url:path,method,headers:{host:'127.0.0.1:5890',origin:publicOrigin,'content-type':'application/json',...extra}},response={statusCode:200,setHeader:(key:string,value:string)=>headers.set(key.toLowerCase(),value),end:()=>resolve({passed:false,status:response.statusCode,headers})};
 apiSecurity(request as unknown as IncomingMessage,response as unknown as ServerResponse,()=>resolve({passed:true,status:response.statusCode,headers}));
});}
describe('Signature intake exact anonymous transport boundary',()=>{
 beforeAll(()=>configurePublicIntakeOrigins((origin,path)=>domains.acceptsIntakeOrigin(origin,path)));afterAll(()=>configurePublicIntakeOrigins(async()=>false));
 test('all four source contracts admit VI/EN POST and challenge with exact preflight',async()=>{
  for(const locale of M4_LOCALES)for(const [kind,slug]of Object.entries(sources))for(const path of [M4_ROUTES.intake(tenant,locale,kind as M4IntakeSourceKind,slug),M4_ROUTES.challenge(tenant,locale,kind as M4IntakeSourceKind,slug)]){
   expect(isPublicIntakeRoute(path)).toBe(true);const post=await boundary(path);expect(post.passed).toBe(true);expect(post.headers.get('access-control-allow-origin')).toBe(publicOrigin);expect(post.headers.has('access-control-allow-credentials')).toBe(false);
   const options=await boundary(path,'OPTIONS',{'access-control-request-method':'POST','access-control-request-headers':'content-type'});expect(options.status).toBe(204);expect(options.passed).toBe(false);expect(options.headers.get('access-control-allow-origin')).toBe(publicOrigin);expect(options.headers.get('access-control-allow-methods')).toBe('POST');expect(options.headers.get('access-control-allow-headers')).toBe('Content-Type');expect(options.headers.has('access-control-allow-credentials')).toBe(false);
  }
  expect(isPublicIntakeRoute('/api/public/intake/sites/synthetic-clinic/services/care')).toBe(true);
 });
 test('unsupported paths never receive public intake classification or an M5 origin lookup',async()=>{
  const home=M4_ROUTES.intake(tenant,'vi','home','home'),paths=[...['?q=private','#fragment','/','/extra','/challenge/extra','%2f'].map(suffix=>home+suffix),home.replace('/home/home','/promotion/home'),home.replace('/vi/','/fr/'),home.replace('/vi/','/VI/'),home.replace('synthetic-clinic','synthetic_clinic'),home.replace('/home/home','/home//home'),'/api/tenants/11111111-1111-4111-8111-111111111111/site-builder/config/vi','/api/public/builder/synthetic-clinic/vi/home/home','/api/session'];
  for(const path of paths){expect(isPublicIntakeRoute(path)).toBe(false);expect((await boundary(path)).status).toBe(403);const before=lookups;expect(await domains.acceptsIntakeOrigin(customOrigin,path)).toBe(false);expect(lookups).toBe(before);}
 });
 test('home/page keep credential, origin, method, body and preflight-header denials',async()=>{
  for(const locale of M4_LOCALES)for(const kind of ['home','page'] as const){const path=M4_ROUTES.intake(tenant,locale,kind,sources[kind]);
   for(const extra of [{cookie:'session'},{cookie:''},{authorization:'Bearer forged'},{authorization:''},{origin:'http://127.0.0.1:5892'},{origin:'http://localhost:5892/'},{origin:'https://outside.invalid'},{origin:undefined}])expect((await boundary(path,'POST',extra)).status).toBe(403);
   for(const method of ['GET','HEAD','PUT','DELETE'])expect((await boundary(path,method)).status).toBe(403);
   expect((await boundary(path,'POST',{'content-type':'text/plain'})).status).toBe(415);
   for(const headers of ['authorization','x-csrf-token','content-type, authorization'])expect((await boundary(path,'OPTIONS',{'access-control-request-method':'POST','access-control-request-headers':headers})).status).toBe(403);
   expect((await boundary(path,'OPTIONS',{'access-control-request-method':'GET','access-control-request-headers':'content-type'})).status).toBe(403);
  }
 });
 test('custom-origin resolution uses the exact routed tenant and does not grant private/admin access',async()=>{
  for(const locale of M4_LOCALES)for(const kind of ['home','page'] as const){const path=M4_ROUTES.intake(tenant,locale,kind,sources[kind]);expect(await domains.acceptsIntakeOrigin(customOrigin,path)).toBe(true);expect(await domains.acceptsIntakeOrigin(customOrigin,path.replace(tenant,'other-clinic'))).toBe(false);expect(await domains.acceptsIntakeOrigin('http://other.localhost:5892',path)).toBe(false);const result=await boundary(path,'POST',{origin:customOrigin});expect(result.passed).toBe(true);expect(result.headers.get('access-control-allow-origin')).toBe(customOrigin);expect(result.headers.has('access-control-allow-credentials')).toBe(false);expect((await boundary(path,'POST',{origin:customOrigin,cookie:'session'})).status).toBe(403);}
  expect((await boundary('/api/session','POST',{origin:customOrigin})).status).toBe(403);
 });
});
