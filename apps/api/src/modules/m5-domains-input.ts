import {isIP} from 'node:net';
import {exactObject,boundedText} from '../contracts/content';
import {m3Id} from '../contracts/m3-validation';
import type {M5DomainBinding,M5LocalVerifierConfig,M5VerificationEvidence} from '../contracts/m5-domains';

/** One ASCII registry rule; no IDNA, trailing-dot, URL or port coercion. */
export function normalizeDomainHost(value:unknown):string {
 if(typeof value!=='string'||value.length<3||value.length>253||!/^[A-Za-z0-9.-]+$/.test(value))throw new Error('Invalid hostname');
 const host=value.toLowerCase(),labels=host.split('.');
 if(labels.length<2||labels.some(label=>label.length>63||!/^([a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])$/.test(label)||label.startsWith('xn--'))||isIP(host)||/^\d+(?:\.\d+)+$/.test(host)||host==='godent.vn'||host.endsWith('.godent.vn')||['local','internal','invalid'].includes(labels.at(-1)!))throw new Error('Invalid hostname');
 return host;
}
function version(value:unknown,zero=false){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<(zero?0:1)||value>2147483647)throw new Error('Invalid version');return value;}
export function parseDomainCommand(action:string,input:unknown):Record<string,unknown>{
 const keys=action==='register'?['operationId','host']:action==='verify-local'?['operationId','expectedVersion']:action==='primary'?['operationId','mode','expectedPrimaryVersion','bindingId','expectedBindingVersion','reason','acknowledgeCachedRedirects']:['operationId','expectedVersion','expectedPrimaryVersion','reason'];
 if(!['register','verify-local','primary','deactivate','remove','reverify'].includes(action))throw new Error('Invalid action');
 const c=exactObject(input,keys),operationId=m3Id(c.operationId);
 if(action==='register')return {action,operationId,host:normalizeDomainHost(c.host)};
 if(action==='verify-local')return {action,operationId,expectedVersion:version(c.expectedVersion)};
 const expectedPrimaryVersion=version(c.expectedPrimaryVersion,true),reason=boundedText(c.reason,500,true).trim();
 if(action!=='primary')return {action,operationId,expectedVersion:version(c.expectedVersion),expectedPrimaryVersion,reason};
 if(c.mode==='godent'&&c.acknowledgeCachedRedirects===true&&c.bindingId===undefined&&c.expectedBindingVersion===undefined)return {action,operationId,mode:'godent',expectedPrimaryVersion,reason,acknowledgeCachedRedirects:true};
 if(c.mode==='custom'&&c.acknowledgeCachedRedirects===undefined)return {action,operationId,mode:'custom',expectedPrimaryVersion,bindingId:m3Id(c.bindingId),expectedBindingVersion:version(c.expectedBindingVersion),reason};
 throw new Error('Invalid primary command');
}
export function parseEntryInput(input:unknown):{host:string;path:string}{
 // Express query records have a null prototype. Normalize only this transport boundary.
 if(!input||typeof input!=='object'||Array.isArray(input)||![null,Object.prototype].includes(Object.getPrototypeOf(input)))throw new Error('Invalid entry query');
 const c=exactObject({...input},['host','path']);
 if(typeof c.host!=='string'||c.host.length>259||c.host!==c.host.toLowerCase())throw new Error('Invalid entry');
 if(c.host!=='localhost:5892'){if(!c.host.endsWith(':5892'))throw new Error('Invalid entry');normalizeDomainHost(c.host.slice(0,-5));}
 if(typeof c.path!=='string'||c.path.length>2048||c.path.includes('//'))throw new Error('Invalid path');
 const metadata=c.host==='localhost:5892'?(c.path==='/robots.txt'||/^\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:sitemap\.xml|robots\.txt)$/.test(c.path)):['/sitemap.xml','/robots.txt'].includes(c.path);
 if(!metadata&&!/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?\/?$/.test(c.path))throw new Error('Invalid path');
 return {host:c.host,path:c.path};
}
export interface DomainVerifier {verify(binding:Pick<M5DomainBinding,'id'|'tenantId'|'host'|'generation'>):Promise<M5VerificationEvidence>}
export class SyntheticLocalDomainVerifier implements DomainVerifier {
 private readonly manifest:Set<string>;
 constructor(config:M5LocalVerifierConfig){
  if(config.mode!=='local-m5'||!Array.isArray(config.bindings)||config.bindings.length>1000)throw new Error('Synthetic verifier requires explicit local M5 configuration');
  this.manifest=new Set(config.bindings.map(binding=>{const host=normalizeDomainHost(binding.host);m3Id(binding.tenantId);if(!host.endsWith('.localhost'))throw new Error('Local loopback hostname required');return `${binding.tenantId}:${host}`;}));
 }
 async verify(binding:Pick<M5DomainBinding,'id'|'tenantId'|'host'|'generation'>):Promise<M5VerificationEvidence>{
  if(!this.manifest.has(`${binding.tenantId}:${binding.host}`)||!Number.isSafeInteger(binding.generation)||binding.generation<1)throw new Error('Host not enrolled in local verifier');
  return {bindingId:binding.id,tenantId:binding.tenantId,siteId:binding.tenantId,host:binding.host,generation:binding.generation,adapter:'synthetic-local',tls:'valid',origin:`http://${binding.host}:5892`,verifiedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()};
 }
}
