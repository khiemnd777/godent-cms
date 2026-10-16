import {describe,expect,test} from 'bun:test';
import {normalizeDomainHost,parseDomainCommand,parseEntryInput,SyntheticLocalDomainVerifier} from '../src/modules/m5-domains-input';
import {apiSecurity} from '../src/modules/http-security';
import {configurePublicIntakeOrigins} from '../src/modules/intake-security';
import type {IncomingMessage,ServerResponse} from 'node:http';

const id='b5603b10-7418-4cc2-8553-d9eca5ebfc51';
describe('M5 exact domain boundary',()=>{
 test('normalizes ASCII case while www remains a different exact host',()=>{
  expect(normalizeDomainHost('Clinic.Example')).toBe('clinic.example');
  expect(normalizeDomainHost('www.clinic.example')).not.toBe(normalizeDomainHost('clinic.example'));
 });
 test('rejects schemes, ports, credentials, IPs, encoded hosts and internal/reserved names',()=>{
  for(const host of ['https://clinic.example','clinic.example:5892','user@clinic.example','127.0.0.1','[::1]','localhost','godent.vn','www.godent.vn','api.godent.vn','clinic..example','clinic.example.','clínic.example','xn--clinic.example','clinic%2eexample','-clinic.example','clinic_.example'])expect(()=>normalizeDomainHost(host)).toThrow();
 });
 test('rejects client verification and stale command fields',()=>{
  expect(parseDomainCommand('register',{operationId:id,host:'Clinic.Example'})).toEqual({action:'register',operationId:id,host:'clinic.example'});
  for(const command of [{operationId:id,host:'clinic.example',verified:true},{operationId:id,host:'clinic.example',tls:'valid'}])expect(()=>parseDomainCommand('register',command)).toThrow();
  expect(()=>parseDomainCommand('primary',{operationId:id,mode:'godent',expectedPrimaryVersion:2,reason:'Migration'})).toThrow();
 });
 test('validates local entry authority and does not decode ambiguous paths',()=>{
  expect(parseEntryInput({host:'clinic.localhost:5892',path:'/en/dich-vu/check-up'})).toEqual({host:'clinic.localhost:5892',path:'/en/dich-vu/check-up'});
  expect(parseEntryInput(Object.assign(Object.create(null),{host:'clinic.localhost:5892',path:'/'}))).toEqual({host:'clinic.localhost:5892',path:'/'});
  expect(()=>parseEntryInput(Object.assign(Object.create(null),{host:'clinic.localhost:5892',path:'/',tenantId:id}))).toThrow();
  expect(()=>parseEntryInput(Object.assign(Object.create({host:'clinic.localhost:5892'}),{path:'/'}))).toThrow();
  for(const path of ['//evil.test','/a/../b','/a%2fb','/a%252fb','/a?x=1','/a\\b'])expect(()=>parseEntryInput({host:'localhost:5892',path})).toThrow();
  expect(()=>parseEntryInput({host:'clinic.localhost:5892',path:'/',tenantId:id})).toThrow();
 });
 test('admits only the declared sitemap and robots metadata paths',()=>{
  for(const path of ['/sitemap.xml','/robots.txt'])expect(parseEntryInput({host:'clinic.localhost:5892',path}).path).toBe(path);
  for(const path of ['/tenant-a/sitemap.xml','/tenant-a/robots.txt','/robots.txt'])expect(parseEntryInput({host:'localhost:5892',path}).path).toBe(path);
  for(const [host,path] of [['clinic.localhost:5892','/tenant-a/sitemap.xml'],['clinic.localhost:5892','/sitemap.xml/'],['clinic.localhost:5892','/Sitemap.xml'],['clinic.localhost:5892','/sitemap%2exml'],['localhost:5892','/tenant-a/nested/sitemap.xml'],['localhost:5892','/tenant-a/data.json'],['localhost:5892','/tenant-a/robots.txt/extra']])expect(()=>parseEntryInput({host,path})).toThrow();
 });
 test('synthetic verification requires an exact server-owned manifest and local mode',async()=>{
  const input={id,tenantId:id,host:'clinic.localhost',generation:2};
  const verifier=new SyntheticLocalDomainVerifier({mode:'local-m5',bindings:[{tenantId:id,host:'clinic.localhost'}]});
  const proof=await verifier.verify(input);
  expect(proof).toMatchObject({bindingId:id,tenantId:id,siteId:id,host:'clinic.localhost',generation:2,adapter:'synthetic-local',tls:'valid',origin:'http://clinic.localhost:5892'});
  expect(Date.parse(proof.expiresAt)-Date.parse(proof.verifiedAt)).toBeGreaterThanOrEqual(3599000);
  await expect(verifier.verify({...input,generation:0})).rejects.toThrow();
  await expect(verifier.verify({...input,host:'www.clinic.localhost'})).rejects.toThrow();
  expect(()=>new SyntheticLocalDomainVerifier({mode:'production',bindings:[{tenantId:id,host:'clinic.localhost'}]})).toThrow();
 });
 test('custom intake CORS uses exact origin and routed tenant without admin credentials',async()=>{
  const route='/api/public/intake/sites/tenant-a/services/check-up';
  configurePublicIntakeOrigins(async(origin,path)=>origin==='http://clinic.localhost:5892'&&path===route);
  const check=(origin:string,path=route,extra:Record<string,string>={})=>new Promise<{status:number;passed:boolean;headers:Map<string,string>}>(resolve=>{
   const headers=new Map<string,string>(),req={originalUrl:path,url:path,method:'POST',headers:{host:'127.0.0.1:5890',origin,'content-type':'application/json',...extra}},res={statusCode:200,setHeader:(k:string,v:string)=>headers.set(k.toLowerCase(),v),end:()=>resolve({status:res.statusCode,passed:false,headers})};
   apiSecurity(req as unknown as IncomingMessage,res as unknown as ServerResponse,()=>resolve({status:res.statusCode,passed:true,headers}));
  });
  const allowed=await check('http://clinic.localhost:5892');expect(allowed.passed).toBe(true);expect(allowed.headers.get('access-control-allow-origin')).toBe('http://clinic.localhost:5892');expect(allowed.headers.has('access-control-allow-credentials')).toBe(false);
  for(const origin of ['http://www.clinic.localhost:5892','https://clinic.localhost','http://clinic.localhost:5893'])expect((await check(origin)).status).toBe(403);
  expect((await check('http://clinic.localhost:5892',route.replace('tenant-a','tenant-b'))).status).toBe(403);
  expect((await check('http://clinic.localhost:5892','/api/session')).status).toBe(403);
  expect((await check('http://clinic.localhost:5892',route,{cookie:'forged'})).status).toBe(403);
  configurePublicIntakeOrigins(async()=>false);
 });
});
