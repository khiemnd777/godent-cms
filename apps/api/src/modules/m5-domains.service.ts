import {isPublicIntakeRoute} from './intake-security';
import {BadRequestException,ConflictException,ForbiddenException,NotFoundException,UnauthorizedException} from '@nestjs/common';
import {sql} from 'drizzle-orm';
import type {S02Auth} from '../auth';
import type {S02Database} from '../database';
import type {M5DomainBinding,M5DomainCommandResult,M5DomainsView,M5EntryContext} from '../contracts/m5-domains';
import {parseDomainCommand,parseEntryInput,type DomainVerifier} from './m5-domains-input';
import {assertApiHost,assertMutationRequest,decodePageCursor,encodePageCursor,isMutation,nodeHeaders,parseIdentifier,type PrivateRequest} from './request-security';
import {ReauthenticationRequired} from './publication.service';
export class M5DomainsService {
 constructor(private readonly db:S02Database,private readonly identity:S02Auth,private readonly verifier?:DomainVerifier){}
 private async actor(r:PrivateRequest){assertApiHost(r.headers);const headers=nodeHeaders(r.headers),actor=await this.identity.currentSession(headers);if(!actor)throw new UnauthorizedException();if(isMutation(r.method)){assertMutationRequest(r.headers);if(!this.identity.verifyCsrf(headers,actor))throw new ForbiddenException();}return actor;}
 async list(r:PrivateRequest,tenant:string,query:Record<string,unknown>={}):Promise<M5DomainsView>{
  const t=parseIdentifier(tenant),actor=await this.actor(r);if(Object.keys(query).some(key=>key!=='cursor'))throw new BadRequestException();const scope=`${t}:m5-domains`,after=decodePageCursor(query.cursor,scope);if(after)parseIdentifier(after);
  return this.db.withReadTenant(actor,t,async tx=>{const rows=await tx.execute(sql`SELECT gcms_m5.domains_view(${t},${after}) AS result`);const result=rows[0]?.result as M5DomainsView&{hasMore?:boolean};if(!result)throw new NotFoundException();return {...result,nextCursor:result.hasMore&&result.bindings.length?encodePageCursor(scope,result.bindings.at(-1)!.id):null};});
 }
 async command(r:PrivateRequest,tenant:string,binding:string|undefined,action:string,input:unknown):Promise<M5DomainCommandResult>{
  const t=parseIdentifier(tenant),id=binding?parseIdentifier(binding):null,actor=await this.actor(r);let command:Record<string,unknown>;
  if((action==='register'||action==='primary')?id!==null:id===null)throw new BadRequestException();
  try{command=parseDomainCommand(action,input);}catch{throw new BadRequestException();}
  return this.db.withTenant(actor,t,async(tx,current)=>{
   try{await this.identity.requireRecent(current,tx);}catch(error){if(error instanceof ForbiddenException)throw new ReauthenticationRequired();throw error;}
   if(action==='verify-local'){
    if(!id)throw new BadRequestException();
    const receipt=await tx.execute(sql`SELECT gcms_m5.domain_receipt_exists(${t},${String(command.operationId)}) AS found`);
    if(!receipt[0]?.found){
    if(!this.verifier)throw new ForbiddenException();
    const values=await tx.execute(sql`SELECT gcms_m5.binding_view(${t},${id}) AS result`),bound=values[0]?.result as M5DomainBinding|undefined;
    if(!bound||bound.state==='removed')throw new NotFoundException();
    if(bound.version!==command.expectedVersion)throw new ConflictException();
    // The adapter is a second enrollment check. SQL alone issues evidence from
    // the protected owner attestation; no JSON proof crosses the role boundary.
    try{await this.verifier.verify(bound);}catch{throw new ForbiddenException('Local verification unavailable');}
    }
   }
   const rows=await tx.execute(sql`SELECT gcms_m5.domain_command(${t},${id},${JSON.stringify(command)}::text::jsonb,NULL::jsonb) AS result`),result=rows[0]?.result as M5DomainCommandResult&{code?:string};
   if(result?.code==='REAUTH_REQUIRED')throw new ReauthenticationRequired();if(result?.code==='NOT_FOUND')throw new NotFoundException();if(!result||result.code||typeof result.replayed!=='boolean')throw new ConflictException();
   return result;
  });
 }
 async resolve(r:PrivateRequest,query:Record<string,unknown>):Promise<M5EntryContext>{
  assertApiHost(r.headers);let value:{host:string;path:string};try{value=parseEntryInput(query);}catch{throw new BadRequestException();}
  await this.db.verifyRoles();const rows=await this.db.tenantDb.execute(sql`SELECT gcms_m5.resolve_entry(${value.host},${value.path}) AS result`);if(!rows[0]?.result)throw new NotFoundException();return rows[0].result as M5EntryContext;
 }
 async acceptsIntakeOrigin(origin:string,path:string):Promise<boolean>{
  if(!isPublicIntakeRoute(path))return false;
  const match=/^\/api\/public\/intake\/(?:builder\/|sites\/)([a-z0-9]+(?:-[a-z0-9]+)*)\//.exec(path);if(!match)return false;
  await this.db.verifyRoles();const rows=await this.db.tenantDb.execute(sql`SELECT gcms_m5.intake_origin_allowed(${origin},${match[1]}) AS allowed`);return rows[0]?.allowed===true;
 }
}
