import {expect} from 'bun:test';
import {randomUUID} from 'node:crypto';
import {M3_ROUTES,type ContentCommandResult,type ContentDraft,type ContentPermission,type ContentPermissionCommandResult,type PublicContentPage} from '../src/contracts/m3';
import type {M3Harness} from './m3-support';

/** Genuine APIs only: the first published revision keeps its original text grant. */
export async function permissionHistory(h:M3Harness,tenant:{id:string;slug:string;siteVersion:number},label:string,count=205){
 const operationId=randomUUID(),content=h.content('case',{title:`M3 permission history ${label} V1`});
 await h.recordOwned({kind:'permission_history',tenantId:tenant.id,id:operationId,slug:content.slug,plannedGrants:count,label});
 const created=await h.call<ContentCommandResult>(M3_ROUTES.resources(tenant.id,'case'),'POST',{operationId,content});expect(created.status).toBe(201);let draft:ContentDraft=created.value.draft;
 const path=M3_ROUTES.resource(tenant.id,'case',draft.id),grants:ContentPermission[]=[];let publicationId='';
 for(let revision=1;revision<=count;revision++){
  if(revision>1){const saved=await h.call<ContentCommandResult>(path,'PUT',{operationId:randomUUID(),expectedVersion:draft.version,content:{...draft.content,title:`M3 permission history ${label} V${revision}`}});expect(saved.status).toBe(200);draft=saved.value.draft;}
  const grantOperation=randomUUID();await h.recordOwned({kind:'permission_grant_command',tenantId:tenant.id,resourceId:draft.id,operationId:grantOperation,revision:draft.version});
  const grant=await h.call<ContentPermissionCommandResult>(path+'/permissions','POST',{operationId:grantOperation,expectedVersion:draft.version,revision:draft.version,scope:{type:'text'},evidenceReference:`Synthetic permission revision ${revision}`});expect(grant.status).toBe(200);expect(grant.value.operationId).toBe(grantOperation);expect(grant.value.permission.revision).toBe(revision);grants.push(grant.value.permission);
  await h.recordOwned({kind:'permission',tenantId:tenant.id,resourceId:draft.id,id:grant.value.permission.id,revision});
  if(revision===1){const published=await h.call<ContentCommandResult>(path+'/publish','POST',{operationId:randomUUID(),expectedVersion:draft.version,expectedPublicationVersion:draft.publicationVersion,expectedPublicationRevision:draft.publicationRevision,expectedSiteVersion:tenant.siteVersion});expect(published.status).toBe(200);draft=published.value.draft;const page=await h.public<PublicContentPage>(M3_ROUTES.publicDetail(tenant.slug,'case',draft.content.slug));expect(page.status).toBe(200);publicationId=page.value.publicationId;}
 }
 return {draft,grants,publicationId,path};
}
