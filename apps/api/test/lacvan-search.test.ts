import {describe,expect,test} from 'bun:test';
import {parseBuilderSearch} from '../src/modules/builder-search-query';
import {encodeBuilderSearchCursor} from '../src/modules/builder-search-cursor';
const syntheticSecret='ab'.repeat(32);
const id='11111111-1111-4111-8111-111111111111';
describe('Published global search boundary',()=>{
 test('normalizes the query and bounds page size and family',()=>{expect(parseBuilderSearch({q:'  Dental  '},'lac-van','vi')).toMatchObject({q:'dental',size:10,kind:null,after:null});for(const q of [{q:'a'},{q:'hi',pageSize:'21'},{q:'hi',kind:'config'},{q:'hi',offset:'10'},{q:'hi',q2:['x']}])expect(()=>parseBuilderSearch(q,'lac-van','vi')).toThrow();});
 test('binds cursors to tenant, locale, query, kind and page size',()=>{const q={q:'care',kind:'doctor',pageSize:'2'},parsed=parseBuilderSearch(q,'lac-van','en'),cursor=encodeBuilderSearchCursor(parsed.key,'doctor:'+id,syntheticSecret);expect(parseBuilderSearch({...q,cursor},'lac-van','en',syntheticSecret).after).toBe('doctor:'+id);for(const [query,tenant,locale]of [[{...q,q:'smile'},'lac-van','en'],[q,'another','en'],[q,'lac-van','vi'],[{...q,kind:'service'},'lac-van','en'],[{...q,pageSize:'3'},'lac-van','en']] as const)expect(()=>parseBuilderSearch({...query,cursor},tenant,locale,syntheticSecret)).toThrow();expect(()=>parseBuilderSearch({...q,cursor:'malformed'},'lac-van','en')).toThrow();});
});
