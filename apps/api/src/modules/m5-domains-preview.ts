import type {M4PublicReference} from '../contracts/m4';
import type {ContentPublicMedia} from '../contracts/m3';
import type {PublicMediaBlock,ServiceMediaReference} from '../contracts/s07';
/** Private references use session-bound reads; public derivative paths cannot serve suspension previews. */
export async function signM5PreviewReferences(refs:M4PublicReference[],sign:(ref:ServiceMediaReference)=>Promise<PublicMediaBlock|null>):Promise<M4PublicReference[]>{
 const out:M4PublicReference[]=[];
 for(const ref of refs){
  const content=ref.content,media:ContentPublicMedia[]=[];
  if('kind'in content&&content.kind==='gallery'){
   for(const [index,pair] of content.pairs.entries()){
    const before=await sign(pair.before),after=await sign(pair.after);
    if(before&&after)media.push({slot:'before',pairIndex:index,caption:pair.before.caption,media:before},{slot:'after',pairIndex:index,caption:pair.after.caption,media:after});
   }
  }else{
   const image='coverImage'in content?content.coverImage:'image'in content?content.image:null;
   if(image){const block=await sign(image);if(block)media.push({slot:'image',media:block});}
  }
  out.push({...ref,media,references:await signM5PreviewReferences(ref.references,sign)});
 }
 return out;
}
