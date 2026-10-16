import {M3Harness} from './m3-support';
import {permissionHistory} from './m3-permission-support';
import type {SiteDraft} from '../src/contracts/s03';
import {M3_ROUTES,type PublicContentPage} from '../src/contracts/m3';

async function main(){
 if(process.env.M3_INTEGRATION!=='1'||process.argv.slice(2).join(' ')!=='--m3-permission-browser-fixture')throw new Error('Explicit owned M3 browser fixture opt-in required');
 const h=new M3Harness();try{
  await h.setup();const t=h.tenant(),site=await h.call<SiteDraft>(`/api/tenants/${t.id}/publication/site`);if(site.status!==200)throw new Error('Owned site unavailable');
  const fixture=await permissionHistory(h,{id:t.id,slug:t.slug,siteVersion:site.value.version},'browser');
  const live=await h.public<PublicContentPage>(M3_ROUTES.publicDetail(t.slug,'case',fixture.draft.content.slug));if(live.status!==200||live.value.publicationId!==fixture.publicationId||live.value.content.title!=='M3 permission history browser V1'||!fixture.draft.activePublication)throw new Error('Published first revision must remain active');
  const handoff={kind:'browser_permission_handoff',tenantId:t.id,resourceId:fixture.draft.id,oldestPermissionId:fixture.grants[0].id,publicationId:fixture.publicationId,grantCount:fixture.grants.length,draftVersion:fixture.draft.version,cmsPath:`/cms/cases/${fixture.draft.id}`,apiPath:fixture.path,manifest:h.manifest,active:true};await h.recordOwned(handoff);console.info(JSON.stringify(handoff));
 }finally{await h.close();}
}
void main().catch(()=>{console.error('Owned M3 permission browser fixture refused or failed; no credentials exported.');process.exitCode=1;});
