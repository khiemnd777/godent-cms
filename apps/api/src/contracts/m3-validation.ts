import {boundedText,exactObject,parseRichText,parseSlug,safeLink} from './content';
import {M3_KINDS,M3_LIMITS,M3_REFERENCE_RULES,type ContentKind,type ContentPrice,type ContentReference,type DentalContent,type GalleryImage,type OpeningDay,type ReferenceKind} from './m3';
import type {ServiceMediaReference} from './s07';
export function m3Id(value:unknown):string {if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)) throw new TypeError('Invalid identifier');return value;}
export function m3Version(value:unknown,zero=false):number {if(!Number.isSafeInteger(value)||Number(value)<(zero?0:1)||Number(value)>=2147483647) throw new TypeError('Invalid version');return Number(value);}
export function contentKind(value:unknown):ContentKind {if(!(M3_KINDS as readonly unknown[]).includes(value)) throw new TypeError('Invalid content kind');return value as ContentKind;}
export function referenceKind(value:unknown):ReferenceKind {return value==='service'?'service':contentKind(value);}
/** Express query dictionaries can have a null prototype. Keep content objects strict. */
export function m3QueryObject(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||![null,Object.prototype].includes(Object.getPrototypeOf(value)))throw new TypeError('Invalid query');
  return Object.fromEntries(Object.entries(value));
}
/** Preserve PostgreSQL microseconds. A JavaScript Date must never form this anchor. */
export function parsePermissionCursorValue(value:string):{grantedAt:string;id:string}{
  const m=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{6})Z_([a-f0-9-]{36})$/.exec(value);
  if(!m)throw new TypeError('Invalid permission cursor');
  const grantedAt=`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7]}Z`,date=new Date(grantedAt);
  if(m[1]==='0000'||!Number.isFinite(date.valueOf())||date.toISOString()!==grantedAt.slice(0,23)+'Z')throw new TypeError('Invalid permission cursor instant');
  return {grantedAt,id:m3Id(m[8])};
}
export function permissionCursorValue(grantedAt:string,id:string):string{
  const value=grantedAt.replace(/[-:.]/g,'')+'_'+id;parsePermissionCursorValue(value);return value;
}
const text=(value:unknown,max:number,required=false)=>boundedText(value,max,required).normalize('NFC').trim();
export function parseContentReferences(value:unknown,self?:string):ContentReference[] {
  if(!Array.isArray(value)||value.length>M3_LIMITS.references) throw new TypeError('Invalid references');
  const seen=new Set<string>();return value.map(input=>{const v=exactObject(input,['kind','id','publicationId']);const r={kind:referenceKind(v.kind),id:m3Id(v.id),publicationId:m3Id(v.publicationId)};
    if(r.id===self||seen.has(`${r.kind}:${r.id}`)) throw new TypeError('Duplicate/self reference');seen.add(`${r.kind}:${r.id}`);return r;});
}
export function decimalString(value:unknown):string {if(typeof value!=='string'||!/^(?:0|[1-9][0-9]{0,23})(?:\.[0-9]{1,6})?$/.test(value)) throw new TypeError('Invalid decimal');return value;}
function decimalUnits(value:string):bigint {const [whole,part='']=value.split('.');return BigInt(whole)*1000000n+BigInt(part.padEnd(6,'0'));}
export function parseContentPrice(input:unknown):ContentPrice {
  const v=exactObject(input,['type','amount','minimum','maximum','currency','unit']);
  if(typeof v.currency!=='string'||!/^[A-Z]{3}$/.test(v.currency)) throw new TypeError('Invalid currency');const unit=text(v.unit,80,true);
  if(v.type==='exact'||v.type==='from') {if(v.minimum!==undefined||v.maximum!==undefined) throw new TypeError('Invalid price shape');return {type:v.type,amount:decimalString(v.amount),currency:v.currency,unit};}
  if(v.type==='range') {if(v.amount!==undefined) throw new TypeError('Invalid price shape');const minimum=decimalString(v.minimum),maximum=decimalString(v.maximum);
    if(decimalUnits(minimum)>decimalUnits(maximum)) throw new TypeError('Reversed range');return {type:'range',minimum,maximum,currency:v.currency,unit};}
  throw new TypeError('Invalid price type');
}
export function parseContentImage(input:unknown):ServiceMediaReference|null {
  if(input===null) return null;const v=exactObject(input,['assetId','revision','alt']);return {assetId:m3Id(v.assetId),revision:m3Version(v.revision),alt:text(v.alt,500,true)};
}
function strings(input:unknown,max:number,length:number):string[] {if(!Array.isArray(input)||input.length>max) throw new TypeError('Invalid list');return input.map(v=>text(v,length,true));}
function openingHours(input:unknown):OpeningDay[] {
  if(!Array.isArray(input)||input.length>7) throw new TypeError('Invalid opening hours');const days=new Set<number>();
  return input.map(item=>{const v=exactObject(item,['day','closed','intervals']);if(!Number.isInteger(v.day)||Number(v.day)<0||Number(v.day)>6||days.has(Number(v.day))||typeof v.closed!=='boolean'||!Array.isArray(v.intervals)||v.intervals.length>4) throw new TypeError('Invalid day');
    days.add(Number(v.day));let previous='';const intervals=v.intervals.map(item=>{const i=exactObject(item,['opens','closes']);if(typeof i.opens!=='string'||typeof i.closes!=='string'||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(i.opens)||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(i.closes)||i.opens>=i.closes||i.opens<previous) throw new TypeError('Invalid interval');previous=i.closes;return {opens:i.opens,closes:i.closes};});
    if((v.closed&&intervals.length)||(!v.closed&&!intervals.length)) throw new TypeError('Invalid closed day');return {day:Number(v.day),closed:v.closed,intervals};});
}
export function parseDentalContent(input:unknown,self?:string):DentalContent {
  if(!input||typeof input!=='object') throw new TypeError('Invalid content');const kind=contentKind((input as {kind?:unknown}).kind);
  const extra:Record<ContentKind,string[]>={specialty:[],service_group:[],category:[],faq:[],location:['address','phone','email','openingHours','mapUrl'],doctor:['professionalTitle','credentials','languages','image'],price:['price','inclusions','notes'],case:['image'],gallery:['pairs'],testimonial:['quote','displayName','attribution','image'],article:['attribution','image']};
  const v=exactObject(input,['kind','slug','title','summary','body','seo','references',...extra[kind]]),seo=exactObject(v.seo,['title','description']);
  const references=parseContentReferences(v.references,self);if(references.some(ref=>!M3_REFERENCE_RULES[kind].includes(ref.kind))) throw new TypeError('Invalid reference kind');
  if(kind==='price'&&references.filter(r=>r.kind==='service').length!==1) throw new TypeError('Price requires one service');
  const base={kind,slug:parseSlug(v.slug),title:text(v.title,160,true),summary:text(v.summary,320),body:parseRichText(v.body),seo:{title:text(seo.title,160),description:text(seo.description,320)},references};
  switch(kind) {
    case 'location': {const phone=text(v.phone,80),email=text(v.email,254),mapUrl=text(v.mapUrl,2048);if(phone&&!/^\+?[0-9 ().-]+$/.test(phone)) throw new TypeError('Invalid phone');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TypeError('Invalid email');return {...base,kind,address:text(v.address,1000,true),phone,email,openingHours:openingHours(v.openingHours),mapUrl:mapUrl?safeLink(mapUrl):''};}
    case 'doctor':return {...base,kind,professionalTitle:text(v.professionalTitle,160),credentials:strings(v.credentials,30,300),languages:strings(v.languages,20,80),image:parseContentImage(v.image)};
    case 'price':return {...base,kind,price:parseContentPrice(v.price),inclusions:text(v.inclusions,2000),notes:text(v.notes,2000)};
    case 'case':return {...base,kind,image:parseContentImage(v.image)};
    case 'article':return {...base,kind,attribution:text(v.attribution,500),image:parseContentImage(v.image)};
    case 'testimonial':return {...base,kind,quote:text(v.quote,5000,true),displayName:text(v.displayName,160,true),attribution:text(v.attribution,500),image:parseContentImage(v.image)};
    case 'gallery': {if(!Array.isArray(v.pairs)||!v.pairs.length||v.pairs.length>20) throw new TypeError('Invalid gallery');const seen=new Set<string>();const image=(input:unknown):GalleryImage=>{const i=exactObject(input,['assetId','revision','alt','caption']);const {caption,...ref}=i;const parsed=parseContentImage(ref)!;if(seen.has(parsed.assetId)) throw new TypeError('Duplicate gallery asset');seen.add(parsed.assetId);return {...parsed,caption:text(caption,1000)};};
      return {...base,kind,pairs:v.pairs.map(item=>{const pair=exactObject(item,['before','after']);return {before:image(pair.before),after:image(pair.after)};})};}
    default:return {...base,kind};
  }
}
