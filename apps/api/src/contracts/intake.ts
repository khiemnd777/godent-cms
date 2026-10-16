import { RESERVED_SLUGS } from './s03';
import { S04_LIMITS, type IntakeInput } from './s04';

// Browser-safe normalization shared by the form and API. No contact data belongs in a URL or cursor.
export function codePointLength(value: string) { return Array.from(value.normalize('NFC')).length; }
/** Supported local intake grammar: unquoted ASCII mailbox, including plus/apostrophe and punycode domains. */
export function validConsultationEmail(email:string) {
  if(email.length>S04_LIMITS.email||email!==email.toLowerCase()) return false;
  const parts=email.split('@');if(parts.length!==2) return false;
  const [local,domain]=parts;
  if(!local||local.length>64||!domain||!local.split('.').every(atom=>/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+$/.test(atom))) return false;
  const labels=domain.split('.');return labels.length>=2&&labels.every(label=>label.length<=63&&/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}
function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Invalid input');
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error('Invalid text');
  const result=value.normalize('NFC').trim();
  if (codePointLength(result)>limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ud800-\udfff]/u.test(result)) throw new Error('Invalid text');
  return result || undefined;
}
export function intakeUuid(value: unknown): string {
  if (typeof value!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)) throw new Error('Invalid identifier');
  return value;
}
export function intakeSlug(value: unknown): string {
  if (typeof value!=='string' || value.length>63 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) ||
    (RESERVED_SLUGS as readonly string[]).includes(value)) throw new Error('Invalid slug');
  return value;
}
export function normalizeIntakeInput(input: unknown): IntakeInput {
  const v=object(input,['requestKey','sourcePublicationId','name','phone','email','preferredLanguage','preferredChannel','message','consent','interestServiceSlug','challenge']);
  const name=text(v.name,S04_LIMITS.name),message=text(v.message,S04_LIMITS.message);
  let phone=text(v.phone,80); const email=text(v.email,S04_LIMITS.email)?.toLowerCase();
  if (phone) {
    if (!/^\+?[0-9 ().-]+$/.test(phone)) throw new Error('Invalid phone');
    phone=phone.replace(/\D/g,'');
    if (!/^[0-9]{7,15}$/.test(phone)) throw new Error('Invalid phone');
  }
  if (email && !validConsultationEmail(email)) throw new Error('Invalid email');
  if (!phone && !email) throw new Error('Contact required');
  if (!['vi','en'].includes(String(v.preferredLanguage)) || !['phone','email'].includes(String(v.preferredChannel)) ||
    (v.preferredChannel==='phone'&&!phone) || (v.preferredChannel==='email'&&!email) || v.consent!==true) throw new Error('Invalid preferences');
  let challenge: IntakeInput['challenge'];
  if (v.challenge!==undefined) {
    const c=object(v.challenge,['token','answer']);
    if (typeof c.answer!=='string' || !/^\d{1,3}$/.test(c.answer)) throw new Error('Invalid challenge');
    challenge={token:intakeUuid(c.token),answer:c.answer};
  }
  return {requestKey:intakeUuid(v.requestKey),sourcePublicationId:intakeUuid(v.sourcePublicationId),
    ...(name?{name}:{}),...(phone?{phone}:{}),...(email?{email}:{}),preferredLanguage:v.preferredLanguage as 'vi'|'en',
    preferredChannel:v.preferredChannel as 'phone'|'email',...(message?{message}:{}),consent:true,
    ...(v.interestServiceSlug===undefined?{}:{interestServiceSlug:intakeSlug(v.interestServiceSlug)}),...(challenge?{challenge}:{})};
}
export function normalizeChallengeInput(input: unknown) {const v=object(input,['requestKey']);return {requestKey:intakeUuid(v.requestKey)};}

export interface LeadCursor { createdAt: string; id: string }
const SORT='created_at_desc,id_desc';
export function encodeLeadCursor(tenant: string, after: LeadCursor) {
  // btoa/atob are available in the browser and Bun. The serialized value contains only ASCII identifiers/timestamps.
  return btoa(JSON.stringify({tenant,sort:SORT,...after})).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
export function decodeLeadCursor(value: unknown, tenant: string): LeadCursor | null {
  if (value===undefined) return null;
  if (typeof value!=='string'||value.length>600||!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid cursor');
  try {
    const v=object(JSON.parse(atob(value.replace(/-/g,'+').replace(/_/g,'/'))),['tenant','sort','createdAt','id']);
    if (v.tenant!==tenant||v.sort!==SORT||typeof v.createdAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{1,6}Z$/.test(v.createdAt)||!Number.isFinite(Date.parse(v.createdAt))) throw new Error();
    return {createdAt:v.createdAt,id:intakeUuid(v.id)};
  } catch {throw new Error('Invalid cursor');}
}
