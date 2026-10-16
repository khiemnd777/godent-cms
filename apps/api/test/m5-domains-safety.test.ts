import {describe,expect,test} from 'bun:test';
import {isM5SafetyCommand} from '../src/modules/m5-domains-safety';
import {parseM4Command} from '../src/contracts/m4-validation';
import {signM5PreviewReferences} from '../src/modules/m5-domains-preview';
import type {M4PublicReference} from '../src/contracts/m4';
const operationId='b5603b10-7418-4cc2-8553-d9eca5ebfc51',permissionId='c5603b10-7418-4cc2-8553-d9eca5ebfc51';
describe('M5 suspended safety classification',()=>{
 test('admits only complete unpublish and withdrawal shapes',()=>{
  expect(isM5SafetyCommand('m3',{type:'unpublish',operationId,expectedVersion:1,expectedPublicationRevision:1})).toBe(true);
  expect(isM5SafetyCommand('m4',{type:'withdraw',operationId,expectedVersion:0,permissionId,reason:'Withdraw publication permission'})).toBe(true);
  expect(isM5SafetyCommand('media',{type:'withdrawal',reason:'Withdraw asset'})).toBe(true);
 });
 test('spoofed selectors, nested commands, extra writes and malformed versions stay denied',()=>{
  for(const family of ['m3','m4','media'] as const)for(const command of [null,[],{operation:'unpublish'},{action:'withdraw'},{type:'save',safety:true},{type:'purge_retry'},{type:'withdrawal',reason:'x',scope:'service_cover'},{type:'unpublish',operationId,expectedVersion:1,expectedPublicationRevision:1,content:{}},{type:'withdraw',operationId,expectedVersion:1,permissionId,reason:''},{type:'withdraw',operationId,expectedVersion:'1',permissionId,reason:'x'},{type:'withdraw',operationId,expectedVersion:1,permissionId,reason:'x',command:{type:'save'}}])expect(isM5SafetyCommand(family,command)).toBe(false);
 });
 test('HTTP command parser owns type; caller cannot relabel a save as safety',()=>{
  expect(()=>parseM4Command('save',{operationId,expectedVersion:1,content:{},type:'unpublish'},'page')).toThrow();
  const command=parseM4Command('unpublish',{operationId,expectedVersion:1,expectedPublicationRevision:1},'page');
  expect(isM5SafetyCommand('m4',command)).toBe(true);
  expect(isM5SafetyCommand('m3',{...command,expectedVersion:0})).toBe(false);
 });
 test('private referenced images use read capabilities and incomplete gallery pairs disappear together',async()=>{
  const image={assetId:permissionId,revision:1,alt:'Synthetic image'},before={...image,caption:'Before'},after={...image,assetId:operationId,caption:'After'};
  const refs=[{id:operationId,kind:'doctor',publicationId:permissionId,publicationVersion:1,locale:'vi',title:'Synthetic doctor',slug:'synthetic-doctor',path:'/tenant/bac-si/synthetic-doctor',content:{image},references:[],media:[{slot:'image',media:{...image,path:'/api/public/media/old'}}]}, {id:permissionId,kind:'gallery',publicationId:operationId,publicationVersion:1,locale:'vi',title:'Synthetic gallery',slug:'synthetic-gallery',path:'/tenant/truoc-sau/synthetic-gallery',content:{kind:'gallery',pairs:[{before,after}]},references:[],media:[]}] as unknown as M4PublicReference[];
  const result=await signM5PreviewReferences(refs,async ref=>ref.assetId===operationId?null:{...ref,width:100,height:80,path:'http://127.0.0.1:5890/api/media/access?token=synthetic',profile:'cover'});
  expect(result[0].media[0].media.path).toBe('http://127.0.0.1:5890/api/media/access?token=synthetic');
  expect(result[1].media).toEqual([]);expect(refs[0].media[0].media.path).toBe('/api/public/media/old');
 });
});
