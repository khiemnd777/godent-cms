import {describe,expect,test} from 'bun:test';
import type {BuilderContent,SitePresentation,PromotionContent,M4IntakeInput} from '../src/contracts/m4';
import type {RichTextDocument} from '../src/contracts/s03';
import {parseBuilderContent,parseSitePresentation,parsePromotion,parseM4Command,parseM4Locale,parseM4Path,normalizeM4Intake} from '../src/contracts/m4-validation';
const id='11111111-1111-4111-8111-111111111111';
const body:RichTextDocument={type:'doc',version:1,blocks:[]};
const page:BuilderContent={kind:'home',slug:'home',title:'Synthetic home',summary:'',seo:{title:'',description:''},sections:[{id:'hero-1',type:'hero',hidden:false,title:'Welcome',text:'',image:null,action:null},{id:'body-1',type:'rich_text',hidden:false,body}]};
describe('M4 strict boundary contracts',()=>{
 test('accepts typed builder content and rejects scripts, unknown keys, duplicate sections and reserved routes',()=>{
  expect(parseBuilderContent(page)).toEqual(page);
  expect(()=>parseBuilderContent({...page,css:'body{}'})).toThrow();
  expect(()=>parseBuilderContent({...page,sections:[...page.sections,page.sections[0]]})).toThrow();
  for(const slug of ['api','en','dich-vu','bac-si','bai-viet','preview'])expect(()=>parseM4Path(slug)).toThrow();
  expect(parseM4Path('about-us')).toBe('about-us');
 });
 test('limits style and menu to safe presets and resource identities',()=>{
  const config:SitePresentation={name:'Synthetic site',logo:null,theme:'clarity',themeVersion:1,palette:'teal',font:'system',layout:'comfortable',footer:{intro:'',body},menu:[{id:'main',label:'Home',target:{kind:'home',id,locale:'vi'},allowViFallback:false}]};
  expect(parseSitePresentation(config)).toEqual(config);
  expect(()=>parseSitePresentation({...config,font:'https://fonts.invalid/font'})).toThrow();
  expect(()=>parseSitePresentation({...config,menu:[{...config.menu[0],target:{href:'https://outside.invalid'}}]})).toThrow();
 });
 test('keeps promotion instants absolute with half-open boundaries and real timezone',()=>{
  const promotion:PromotionContent={kind:'promotion',slug:'synthetic-promo',title:'Synthetic promotion',summary:'',body,seo:{title:'',description:''},startAt:'2026-10-16T00:00:00.000Z',endAt:'2026-10-17T00:00:00.000Z',authoredTimezone:'Asia/Ho_Chi_Minh',conditions:'Terms',references:[]};
  expect(parsePromotion(promotion)).toEqual(promotion);
  expect(()=>parsePromotion({...promotion,endAt:promotion.startAt})).toThrow();
  expect(()=>parsePromotion({...promotion,authoredTimezone:'invented/timezone'})).toThrow();
  expect(()=>parsePromotion({...promotion,startAt:'2026-10-16'})).toThrow();
 });
 test('commands bind locale and publication/config versions and reject omitted expected versions',()=>{
  const command={operationId:id,expectedVersion:1,expectedPublicationVersion:0,expectedPublicationRevision:0,expectedConfigPublicationId:null};
  expect(parseM4Command('publish',command)).toEqual({...command,type:'publish'});
  expect(()=>parseM4Command('publish',{...command,expectedVersion:undefined})).toThrow();
  expect(()=>parseM4Locale('fr')).toThrow();
  const retry={operationId:id,expectedVersion:1,permissionId:id};expect(parseM4Command('purge_retry',retry)).toEqual({...retry,type:'purge_retry'});expect(()=>parseM4Command('purge_retry',{...retry,reason:'unused'})).toThrow();expect(()=>parseM4Command('purge_retry',{...retry,permissionId:null})).toThrow();
 });
 test('intake separates actual form locale from contact language and rejects raw tracking/unknown fields',()=>{
  const input:M4IntakeInput={requestKey:id,sourcePublicationId:id,sourceConfigPublicationId:null,formLocale:'vi',phone:'0900789123',preferredLanguage:'en',preferredChannel:'phone',consent:true};
  expect(normalizeM4Intake(input)).toEqual(input);
  expect(()=>normalizeM4Intake({...input,tracking:{referrer:'https://example.invalid/?phone=123'}})).toThrow();
  expect(()=>normalizeM4Intake({...input,tracking:{campaign:'patient@example.com'}})).toThrow();
 });
});
