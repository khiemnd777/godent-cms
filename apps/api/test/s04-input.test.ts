import { describe, expect, test } from 'bun:test';
import { normalizeIntakeInput, codePointLength, decodeLeadCursor, encodeLeadCursor } from '../src/contracts/intake';
const key='a4000000-0000-4000-8000-000000000001';
const publication='a4000000-0000-4000-8000-000000000002';
const phone={requestKey:key,sourcePublicationId:publication,phone:'+84 (900) 123-456',preferredLanguage:'vi',preferredChannel:'phone',consent:true};
describe('S04 validated semantic consultation input',()=>{
  test('normalizes presentation phone and NFC text without country coercion',()=>{
    expect(normalizeIntakeInput({...phone,name:'  Nguyễn  ',message:'  a\u0301  '})).toMatchObject({phone:'84900123456',name:'Nguyễn',message:'á'});
    expect(normalizeIntakeInput({...phone,phone:'0900123456'}).phone).toBe('0900123456');
  });
  test('accepts email-only but validates every provided contact and selected channel',()=>{
    expect(normalizeIntakeInput({...phone,phone:undefined,email:'  SYNTHETIC@EXAMPLE.INVALID ',preferredChannel:'email'}).email).toBe('synthetic@example.invalid');
    for(const change of [{phone:undefined},{email:'bad'}, {phone:'call0900123456'},{phone:'123456'},{phone:'1'.repeat(16)},
      {preferredChannel:'email'},{preferredLanguage:'fr'}, {consent:false},{consent:undefined}]) expect(()=>normalizeIntakeInput({...phone,...change})).toThrow();
  });
  test('rejects malformed unquoted mailboxes and accepts supported plus/apostrophe addresses',()=>{
    for(const email of ['a<b@example.invalid','a@example..invalid','a@-example.invalid','a@example.invalid>','a..b@example.invalid',
      '.a@example.invalid','a.@example.invalid','a@example-.invalid','a@'+ 'a'.repeat(64)+'.invalid','a'.repeat(65)+'@example.invalid','a@localhost','é@example.invalid']) {
      expect(()=>normalizeIntakeInput({...phone,phone:undefined,email,preferredChannel:'email'})).toThrow();
    }
    for(const email of ["o'connor+consultation@example.invalid",'a.b@example.invalid','person@xn--bcher-kva.invalid']) {
      expect(normalizeIntakeInput({...phone,phone:undefined,email,preferredChannel:'email'}).email).toBe(email);
    }
  });
  test('counts 500/501 NFC Unicode code points, including supplementary characters',()=>{
    expect(codePointLength('😀')).toBe(1);
    expect(normalizeIntakeInput({...phone,message:'😀'.repeat(500)}).message).toHaveLength(1000);
    expect(normalizeIntakeInput({...phone,message:'a\u0301'.repeat(500)}).message).toBe('á'.repeat(500));
    expect(()=>normalizeIntakeInput({...phone,message:'😀'.repeat(501)})).toThrow();
    expect(()=>normalizeIntakeInput({...phone,name:'😀'.repeat(121)})).toThrow();
  });
  test('rejects extra tenant/host/location/clinical fields and malformed identities',()=>{
    for(const extra of ['tenantId','assignee','host','locationId','attachments','clinicalRecord']) expect(()=>normalizeIntakeInput({...phone,[extra]:'forged'})).toThrow();
    expect(()=>normalizeIntakeInput({...phone,sourcePublicationId:'unknown'})).toThrow();
    expect(()=>normalizeIntakeInput({...phone,requestKey:'predictable'})).toThrow();
    expect(()=>normalizeIntakeInput({...phone,message:'bad\u0000value'})).toThrow();
    expect(()=>normalizeIntakeInput({...phone,message:'\ud800'})).toThrow();
    expect(()=>normalizeIntakeInput({...phone,challenge:{token:key,answer:'1',bypass:true}})).toThrow();
  });
  test('keyset cursor is bound to tenant and exact sort without contact data',()=>{
    const c=encodeLeadCursor(key,{createdAt:'2026-10-16T00:00:00.123456Z',id:publication});
    expect(decodeLeadCursor(c,key)).toEqual({createdAt:'2026-10-16T00:00:00.123456Z',id:publication});
    expect(()=>decodeLeadCursor(c,publication)).toThrow();
    expect(()=>decodeLeadCursor(c+'!',key)).toThrow();
  });
});
