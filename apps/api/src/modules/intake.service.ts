import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { BadRequestException, HttpException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { S02Auth } from '../auth';
import type { S02Database } from '../database';
import { decodeLeadCursor, encodeLeadCursor, intakeSlug, normalizeChallengeInput, normalizeIntakeInput } from '../contracts/intake';
import { S04_ACK, S04_LIMITS, S04_ROUTES, type IntakeChallenge, type IntakeErrorCode, type LeadDetail, type LeadListItem, type LeadPage } from '../contracts/s04';
import { assertPublicIntakeRequest, peerIp } from './intake-security';
import { nodeHeaders, parseIdentifier, type PrivateRequest, type RequestHeaders } from './request-security';

export interface IntakeRequest extends PrivateRequest { socket:{remoteAddress?:string} }
export class IntakeFailure extends HttpException {
  constructor(readonly code:IntakeErrorCode) {super({code},({INVALID_INPUT:400,SOURCE_UNAVAILABLE:404,REQUEST_CONFLICT:409,RATE_LIMITED:429,
    CAPTCHA_REQUIRED:428,CAPTCHA_INVALID:400,CAPTCHA_UNAVAILABLE:503} as const)[code]);}
}
export interface LocalChallengeAdapter { generate():{token:string;prompt:string;answer:string} }
const localChallenge:LocalChallengeAdapter={generate:()=>{const a=randomInt(1,10),b=randomInt(1,10);return {token:randomUUID(),prompt:`${a} + ${b} = ?`,answer:String(a+b)};}};
const codes=['INVALID_INPUT','SOURCE_UNAVAILABLE','REQUEST_CONFLICT','RATE_LIMITED','CAPTCHA_REQUIRED','CAPTCHA_INVALID','CAPTCHA_UNAVAILABLE'];
const listColumns=sql`id,name,CASE WHEN phone IS NULL THEN NULL ELSE repeat('•',greatest(length(phone)-3,0))||right(phone,3) END AS "phoneMasked",
  CASE WHEN email IS NULL THEN NULL ELSE left(email,1)||'***@'||split_part(email,'@',2) END AS "emailMasked",
  preferred_language AS "preferredLanguage",preferred_channel AS "preferredChannel",status,created_at AS "createdAt",
  to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorTime",
  jsonb_build_object('tenantSlug',source_tenant_slug,'serviceSlug',source_service_slug,'serviceTitle',source_service_title,
    'publicationId',source_publication_id,'path',source_path) AS source`;
function listItem(row:Record<string,unknown>):LeadListItem {
  const {cursorTime:_cursor,...value}=row;void _cursor;
  return {...value,createdAt:new Date(String(value.createdAt)).toISOString()} as unknown as LeadListItem;
}
export class IntakeService {
  constructor(private readonly db:S02Database,private readonly identity:S02Auth,private readonly secret=process.env.S04_HMAC_SECRET,
    private readonly challengeAdapter:LocalChallengeAdapter=localChallenge) {
    if(!secret||!/^[a-f0-9]{64}$/.test(secret)||!db.intakeSql) throw new Error('S04 private runtime configuration required');
  }
  private digest(purpose:string,value:string) {return createHmac('sha256',this.secret!).update(`${purpose}:${value}`).digest('hex');}
  private context(request:IntakeRequest,tenant:string,service:string,challenge=false) {
    assertPublicIntakeRequest(request.headers,request.method);
    let tenantSlug:string,serviceSlug:string;
    try {tenantSlug=intakeSlug(tenant);serviceSlug=intakeSlug(service);} catch {throw new IntakeFailure('SOURCE_UNAVAILABLE');}
    if(request.originalUrl!==(challenge?S04_ROUTES.challenge(tenantSlug,serviceSlug):S04_ROUTES.intake(tenantSlug,serviceSlug))) throw new IntakeFailure('INVALID_INPUT');
    return {tenantSlug,serviceSlug,ipHash:this.digest('ip-v1',peerIp(request))};
  }
  private async command(value:Record<string,unknown>):Promise<Record<string,unknown>> {
    await this.db.verifyRoles();
    const result=await this.db.intakeSql!.begin(async tx=>{
      await tx.unsafe("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='3s'");
      const result=await tx`SELECT gcms_s04.intake(${JSON.stringify(value)}::text::jsonb) AS result`;
      return result[0]?.result as Record<string,unknown>;
    });
    if(!result||typeof result!=='object') throw new Error('Invalid intake result');
    if(typeof result.code==='string'&&codes.includes(result.code)) throw new IntakeFailure(result.code as IntakeErrorCode);
    return result;
  }
  async accept(request:IntakeRequest,tenant:string,service:string,input:unknown) {
    const context=this.context(request,tenant,service);
    let parsed:ReturnType<typeof normalizeIntakeInput>;
    try {parsed=normalizeIntakeInput(input);} catch {
      // Invalid contact values are not sent to PostgreSQL/logs; count the routed attempt without storing them.
      await this.command({...context,operation:'accept',requestKey:randomUUID(),payload:{}});
      throw new IntakeFailure('INVALID_INPUT');
    }
    const {requestKey,challenge,...payload}=parsed;
    const result=await this.command({...context,operation:'accept',requestKey,payload,...(challenge?{
      tokenHash:this.digest('token-v1',challenge.token),answerHash:this.digest('answer-v1',`${challenge.token}:${challenge.answer}`)}:{})});
    if(JSON.stringify(result)!==JSON.stringify(S04_ACK)) throw new Error('Invalid acknowledgement');
    return S04_ACK;
  }
  async challenge(request:IntakeRequest,tenant:string,service:string,input:unknown):Promise<IntakeChallenge> {
    const context=this.context(request,tenant,service,true);
    let requestKey:string;
    try {requestKey=normalizeChallengeInput(input).requestKey;} catch {throw new IntakeFailure('INVALID_INPUT');}
    let challenge:ReturnType<LocalChallengeAdapter['generate']>;
    try {challenge=this.challengeAdapter.generate();} catch {throw new IntakeFailure('CAPTCHA_UNAVAILABLE');}
    const result=await this.command({...context,operation:'challenge',requestKey,tokenHash:this.digest('token-v1',challenge.token),
      answerHash:this.digest('answer-v1',`${challenge.token}:${challenge.answer}`)});
    if(typeof result.expiresAt!=='string'||!Number.isFinite(Date.parse(result.expiresAt))) throw new Error('Invalid challenge');
    return {token:challenge.token,prompt:challenge.prompt,expiresAt:new Date(result.expiresAt).toISOString(),kind:'local-arithmetic'};
  }
  private async actor(headers:RequestHeaders) {
    const actor=await this.identity.currentSession(nodeHeaders(headers));if(!actor) throw new UnauthorizedException();return actor;
  }
  async list(request:PrivateRequest,tenant:string,query:unknown):Promise<LeadPage> {
    const tenantId=parseIdentifier(tenant);let after:ReturnType<typeof decodeLeadCursor>;let pageSize:number;
    try {
      if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).some(k=>!['cursor','pageSize'].includes(k))) throw new Error();
      const q=query as Record<string,unknown>;after=decodeLeadCursor(q.cursor,tenantId);
      if(q.pageSize!==undefined&&(typeof q.pageSize!=='string'||!/^\d{1,2}$/.test(q.pageSize))) throw new Error();
      pageSize=q.pageSize===undefined?S04_LIMITS.pageSize:Number(q.pageSize);
      if(pageSize<1||pageSize>S04_LIMITS.maxPageSize) throw new Error();
    } catch {throw new BadRequestException();}
    const actor=await this.actor(request.headers);
    return this.db.withLeadTenant(actor,tenantId,async tx=>{
      const rows=await tx.execute(sql`SELECT ${listColumns} FROM gcms_s04.lead WHERE tenant_id=${tenantId} AND expires_at>clock_timestamp()
        AND (${after?.createdAt??null}::timestamptz IS NULL OR (created_at,id)<(${after?.createdAt??null}::timestamptz,${after?.id??null}::text))
        ORDER BY created_at DESC,id DESC LIMIT ${pageSize+1}`);
      const selected=rows.slice(0,pageSize);const last=selected[selected.length-1];
      return {items:selected.map(row=>listItem(row as Record<string,unknown>)),nextCursor:rows.length>pageSize&&last?
        encodeLeadCursor(tenantId,{createdAt:String(last.cursorTime),id:String(last.id)}):null};
    });
  }
  async detail(request:PrivateRequest,tenant:string,id:string):Promise<LeadDetail> {
    const tenantId=parseIdentifier(tenant),leadId=parseIdentifier(id),actor=await this.actor(request.headers);
    return this.db.withLeadTenant(actor,tenantId,async tx=>{
      const rows=await tx.execute(sql`SELECT ${listColumns},phone,email,message,
        jsonb_build_object('acceptedAt',consent_at,'version',consent_version,'copy',consent_copy) AS consent,
        CASE WHEN interest_service_id IS NULL THEN NULL ELSE jsonb_build_object('serviceSlug',interest_service_slug,'serviceTitle',interest_service_title) END AS interest,
        last_activity_at AS "lastActivityAt",expires_at AS "expiresAt" FROM gcms_s04.lead
        WHERE tenant_id=${tenantId} AND id=${leadId} AND expires_at>clock_timestamp()`);
      if(!rows[0]) throw new NotFoundException();const row=rows[0];
      return {...listItem(row as Record<string,unknown>),lastActivityAt:new Date(String(row.lastActivityAt)).toISOString(),
        expiresAt:new Date(String(row.expiresAt)).toISOString()} as LeadDetail;
    });
  }
}
