import {describe,expect,test} from 'bun:test';
import {m3QueryObject,parseDentalContent,parseContentReferences,parseContentPrice,parsePermissionCursorValue,permissionCursorValue} from '../src/contracts/m3-validation';
import {normalizeIntakeInput} from '../src/contracts/intake';
const body={type:'doc',version:1,blocks:[]} as const;
const base={kind:'specialty',title:'Synthetic specialty',slug:'synthetic-specialty',summary:'',body,seo:{title:'',description:''},references:[]};
describe('M3 content rules',()=>{
  test('accepts null-prototype transport query without weakening content validation',()=>{
    const query=Object.assign(Object.create(null),{pageSize:'20',q:'sample'});expect(m3QueryObject(query)).toEqual({pageSize:'20',q:'sample'});
    expect(Object.getPrototypeOf(m3QueryObject(query))).toBe(Object.prototype);expect(()=>m3QueryObject([])).toThrow();expect(()=>m3QueryObject(new Date())).toThrow();
    expect(()=>parseDentalContent(Object.assign(Object.create(null),base))).toThrow();
  });
  test('accepts allowlisted content and rejects executable/unknown data',()=>{
    expect(parseDentalContent(base).kind).toBe('specialty');
    expect(()=>parseDentalContent({...base,html:'<script>x</script>'})).toThrow();
    expect(()=>parseDentalContent({...base,body:{...body,blocks:[{type:'html',html:'<b>x</b>'}]}})).toThrow();
  });
  test('keeps exact decimal strings including large and equal range values',()=>{
    const price={type:'range',minimum:'999999999999999999999999.123456',maximum:'999999999999999999999999.123456',currency:'VND',unit:'răng'} as const;
    expect(parseContentPrice(price)).toEqual(price);
    expect(parseContentPrice({type:'exact',amount:'0',currency:'VND',unit:'răng'}).type).toBe('exact');
    for(const invalid of [1,-1,'-1','01','1e3','1.1234567','1000000000000000000000000']) expect(()=>parseContentPrice({type:'from',amount:invalid,currency:'VND',unit:'răng'})).toThrow();
    expect(()=>parseContentPrice({...price,minimum:'20',maximum:'2'})).toThrow();
    expect(()=>parseContentPrice({type:'range',minimum:'2',currency:'VND',unit:'răng'})).toThrow();
  });
  test('rejects duplicate and self references before persistence',()=>{
    const ref={kind:'faq',id:'11111111-1111-4111-8111-111111111111',publicationId:'22222222-2222-4222-8222-222222222222'};
    expect(()=>parseContentReferences([ref,ref])).toThrow();
    expect(()=>parseContentReferences([ref],ref.id)).toThrow();
  });
  test('permission cursor anchors retain all six PostgreSQL fractional digits and reject invalid instants',()=>{
    const id='11111111-1111-4111-8111-111111111111',first='2026-10-16T11:23:38.825123Z',second='2026-10-16T11:23:38.825124Z';
    expect(parsePermissionCursorValue(permissionCursorValue(first,id))).toEqual({grantedAt:first,id});expect(parsePermissionCursorValue(permissionCursorValue(second,id))).toEqual({grantedAt:second,id});expect(permissionCursorValue(first,id)).not.toBe(permissionCursorValue(second,id));
    for(const invalid of ['20260230T112338825123Z_'+id,'20261016T242338825123Z_'+id,'20261016T112338825Z_'+id,'00001016T112338825123Z_'+id,'20261016T112338825123Z_wrong'])expect(()=>parsePermissionCursorValue(invalid)).toThrow();
  });
  test('validates days, closed days and nonoverlapping opening intervals',()=>{
    const location={...base,kind:'location',address:'Synthetic address',phone:'',email:'',mapUrl:'',openingHours:[{day:1,closed:false,intervals:[{opens:'08:00',closes:'12:00'},{opens:'13:00',closes:'17:00'}]}]};
    expect(parseDentalContent(location).kind).toBe('location');
    expect(()=>parseDentalContent({...location,openingHours:[{day:1,closed:true,intervals:[{opens:'08:00',closes:'12:00'}]}]})).toThrow();
    expect(()=>parseDentalContent({...location,openingHours:[{day:1,closed:false,intervals:[{opens:'12:00',closes:'08:00'}]}]})).toThrow();
    expect(()=>parseDentalContent({...location,mapUrl:'javascript:alert(1)'})).toThrow();
  });
  test('requires complete ordered distinct gallery pairs',()=>{
    const before={assetId:'11111111-1111-4111-8111-111111111111',revision:1,alt:'Before',caption:''};
    const after={...before,assetId:'22222222-2222-4222-8222-222222222222',alt:'After'};
    expect(parseDentalContent({...base,kind:'gallery',pairs:[{before,after}]}).kind).toBe('gallery');
    expect(()=>parseDentalContent({...base,kind:'gallery',pairs:[{before,after:before}]})).toThrow();
    expect(()=>parseDentalContent({...base,kind:'gallery',pairs:[{before}]})).toThrow();
  });
  test('optional location is normalized without adding a field to legacy accepted semantics',()=>{
    const input={requestKey:'11111111-1111-4111-8111-111111111111',sourcePublicationId:'22222222-2222-4222-8222-222222222222',phone:'0900789123',preferredLanguage:'vi',preferredChannel:'phone',consent:true} as const;
    expect(normalizeIntakeInput(input)).toEqual(input);const locationId='33333333-3333-4333-8333-333333333333';expect(normalizeIntakeInput({...input,locationId}).locationId).toBe(locationId);
    expect(()=>normalizeIntakeInput({...input,locationId:'forged'})).toThrow();expect(()=>normalizeIntakeInput({...input,location:{id:locationId}})).toThrow();
  });
});
