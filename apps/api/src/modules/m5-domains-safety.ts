import {boundedText,exactObject} from '../contracts/content';
import {m3Id,m3Version} from '../contracts/m3-validation';
/** Only a parsed, complete command may select suspended safety authorization. */
export function isM5SafetyCommand(family:'m3'|'m4'|'media',input:unknown):boolean{
 try{
  if(!input||typeof input!=='object'||Array.isArray(input))return false;
  const type=(input as Record<string,unknown>).type;
  if(family==='media'){const c=exactObject(input,['type','reason']);return type==='withdrawal'&&boundedText(c.reason,500,true).trim().length>0;}
  if(type!=='unpublish'&&type!=='withdraw')return false;
  const c=exactObject(input,type==='unpublish'?['type','operationId','expectedVersion','expectedPublicationRevision']:['type','operationId','expectedVersion','permissionId','reason']);
  m3Id(c.operationId);m3Version(c.expectedVersion,family==='m4');
  if(type==='unpublish')m3Version(c.expectedPublicationRevision,true);else{m3Id(c.permissionId);boundedText(c.reason,500,true);}
  return true;
 }catch{return false;}
}
