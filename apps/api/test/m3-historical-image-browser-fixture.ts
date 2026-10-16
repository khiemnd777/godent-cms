import {M3Harness} from './m3-support';
import {historicalImages} from './m3-historical-image-support';

async function main(){
 if(process.env.M3_INTEGRATION!=='1'||process.argv.slice(2).join(' ')!=='--m3-historical-image-browser-fixture')throw new Error('Explicit owned M3 image-history fixture opt-in required');
 const h=new M3Harness();try{
  await h.setup();const fixture=await historicalImages(h,'browser'),handoff={kind:'historical_image_browser_handoff',tenantId:fixture.tenantId,tenantSlug:fixture.tenantSlug,assetId:fixture.asset.id,manifest:h.manifest,active:true,resources:fixture.resources.map(r=>({kind:r.draft.kind,id:r.draft.id,permissionId:r.permission.id,publicationId:r.publicationId,draftVersion:r.draft.version,publishedVersion:r.draft.publishedVersion,cmsPath:r.cmsPath,publicPath:r.publicPath,mediaPath:r.mediaPath}))};await h.recordOwned(handoff);console.info(JSON.stringify(handoff));
 }finally{await h.close();}
}
void main().catch(()=>{console.error('Owned M3 image-history browser fixture refused or failed; no credentials exported.');process.exitCode=1;});
