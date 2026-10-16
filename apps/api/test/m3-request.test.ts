import {expect,test} from 'bun:test';
import {isContentJsonRequest} from '../src/modules/content-request';
import {M3_LIMITS} from '../src/contracts/m3';
test('larger M3 JSON parser matches only content routes and supported JSON content type',()=>{
 const prefix='/api/tenants/11111111-1111-4111-8111-111111111111';
 expect(M3_LIMITS.requestBytes).toBe(524288);
 for(const suffix of ['/content/gallery','/content/gallery/22222222-2222-4222-8222-222222222222','/content/gallery?query=value'])expect(isContentJsonRequest({originalUrl:prefix+suffix,headers:{'content-type':'application/json; charset=utf-8'}})).toBe(true);
 for(const suffix of ['/publication/services','/leads','/media','/content-other/gallery'])expect(isContentJsonRequest({originalUrl:prefix+suffix,headers:{'content-type':'application/json'}})).toBe(false);
 expect(isContentJsonRequest({originalUrl:prefix+'/content/gallery',headers:{'content-type':'multipart/form-data'}})).toBe(false);
 expect(isContentJsonRequest({originalUrl:prefix+'/content/gallery',headers:{'content-type':['application/json']}})).toBe(false);
});
