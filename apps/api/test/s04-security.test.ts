import { describe, expect, test } from 'bun:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { apiSecurity } from '../src/modules/http-security';
import { peerIp } from '../src/modules/intake-security';
import { selectRuntimeEnvironment } from '../src/auth/runtime-environment';
const route='/api/public/intake/sites/synthetic-a/services/consultation';
function security(path:string,method='POST',extra:Record<string,string>={}) {
  const headers=new Map<string,string>();let body='';let passed=false;
  const req={originalUrl:path,url:path,method,headers:{host:'127.0.0.1:5890',origin:'http://localhost:5892','content-type':'application/json',...extra}};
  const res={statusCode:200,setHeader:(k:string,v:string)=>headers.set(k.toLowerCase(),v),end:(v:string)=>{body=v;}};
  apiSecurity(req as unknown as IncomingMessage,res as unknown as ServerResponse,()=>{passed=true;});
  return {headers,body,passed,status:res.statusCode};
}
describe('S04 route-scoped public boundary',()=>{
  test('permits only exact anonymous intake POST and no credential CORS',()=>{
    const result=security(route);expect(result.passed).toBe(true);expect(result.headers.get('access-control-allow-origin')).toBe('http://localhost:5892');
    expect(result.headers.has('access-control-allow-credentials')).toBe(false);
    for(const path of [route+'?email=private',route.replace('synthetic-a','%73ynthetic-a'),'/api/session','/api/auth/sign-in/email','/api/public/sites/synthetic-a/services/consultation']) expect(security(path).passed).toBe(false);
    for(const headers of [{cookie:'session=forged'},{authorization:'Bearer forged'},{origin:'http://evil.invalid'},{origin:'http://127.0.0.1:5891'}] as Record<string,string>[]) expect(security(route,'POST',headers).passed).toBe(false);
  });
  test('preflights only POST and content-type without broadening admin policy',()=>{
    expect(security(route,'OPTIONS',{'access-control-request-method':'POST','access-control-request-headers':'content-type'}).status).toBe(204);
    expect(security(route,'OPTIONS',{'access-control-request-method':'GET'}).status).toBe(403);
    expect(security(route,'OPTIONS',{'access-control-request-method':'POST','access-control-request-headers':'x-csrf-token'}).status).toBe(403);
    expect(security(route,'GET').passed).toBe(false);
    expect(security(route,'POST',{'content-type':'text/plain'}).passed).toBe(false);
  });
  test('IP identity uses the socket and ignores forged forwarding headers',()=>{
    expect(peerIp({socket:{remoteAddress:'::ffff:127.0.0.1'},headers:{'x-forwarded-for':'8.8.8.8'}})).toBe('127.0.0.1');
    expect(()=>peerIp({socket:{},headers:{'x-forwarded-for':'8.8.8.8'}})).toThrow();
  });
  test('only API process receives the new credential and keyed hash secret',()=>{
    const db=Object.fromEntries(['AUTH','TENANT','PLATFORM'].map(role=>[`S02_${role}_DATABASE_URL`,`postgres://gcms_s02_${role.toLowerCase()}:synthetic@127.0.0.1:5888/gcms_s01`]));
    const result=selectRuntimeEnvironment(db,{REDIS_URL:'x',S3_ENDPOINT:'x',S3_REGION:'x',S3_ACCESS_KEY_ID:'x',S3_SECRET_ACCESS_KEY:'x',BETTER_AUTH_SECRET:'x'},
      {S04_INTAKE_DATABASE_URL:'postgres://gcms_s04_intake:synthetic@127.0.0.1:5888/gcms_s01',S04_HMAC_SECRET:'a'.repeat(64)});
    expect(result.api.S04_HMAC_SECRET).toHaveLength(64);expect(result.web).not.toHaveProperty('S04_HMAC_SECRET');expect(result.web).not.toHaveProperty('S04_INTAKE_DATABASE_URL');
  });
});
