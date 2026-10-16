import {BadRequestException,ForbiddenException,HttpException,NotFoundException,UnauthorizedException} from '@nestjs/common';
import {sql} from 'drizzle-orm';
import type {S02Auth} from '../auth';
import type {S02Database,SessionActor} from '../database';
import {parseM5Quota,parseM5Lifecycle,parseM5Deletion,type M5PlatformStatus,type M5CommandResult,type M5FailureCode} from '../contracts/m5-platform';
import {assertApiHost,assertMutationRequest,isMutation,nodeHeaders,parseIdentifier,type PrivateRequest} from './request-security';

export class M5PlatformFailure extends HttpException {constructor(readonly code:M5FailureCode){super({code},code==='INVALID_INPUT'?400:code==='REAUTH_REQUIRED'?403:code==='NOT_FOUND'?404:409);}}
export class M5PlatformService {
 constructor(readonly db:S02Database,readonly identity:S02Auth){}
 async actor(request:PrivateRequest):Promise<SessionActor>{assertApiHost(request.headers);const headers=nodeHeaders(request.headers),actor=await this.identity.currentSession(headers);if(!actor)throw new UnauthorizedException();if(isMutation(request.method)){assertMutationRequest(request.headers);if(!this.identity.verifyCsrf(headers,actor))throw new ForbiddenException();}return actor;}
 async status(request:PrivateRequest,tenant:string,platform=false):Promise<M5PlatformStatus>{const t=parseIdentifier(tenant),actor=await this.actor(request);return platform?this.db.withPlatform(actor,async tx=>{const rows=await tx.execute(sql`SELECT gcms_m5.status_view(${t},true) AS result`);if(!rows[0]?.result)throw new NotFoundException();return rows[0].result as M5PlatformStatus;}):this.db.withReadTenant(actor,t,async tx=>{const rows=await tx.execute(sql`SELECT gcms_m5.status_view(${t},false) AS result`);if(!rows[0]?.result)throw new NotFoundException();return rows[0].result as M5PlatformStatus;});}
 async command(request:PrivateRequest,tenant:string,action:'quota'|'lifecycle'|'request'|'confirm'|'cancel'|'execute',input:unknown):Promise<M5CommandResult>{const t=parseIdentifier(tenant),actor=await this.actor(request);let command;try{command=action==='quota'?parseM5Quota(input):action==='lifecycle'?parseM5Lifecycle(input):parseM5Deletion(input,action);}catch{throw new BadRequestException();}const run=async(tx:Parameters<Parameters<S02Database['withTenant']>[2]>[0])=>{const rows=await tx.execute(sql`SELECT gcms_m5.command(${t},${action},${JSON.stringify(command)}::text::jsonb) AS result`);const result=rows[0]?.result as Record<string,unknown>;if(!result)throw new Error('Invalid platform command result');if(result.code)throw new M5PlatformFailure(result.code as M5FailureCode);return result as unknown as M5CommandResult;};return ['quota','lifecycle','execute'].includes(action)?this.db.withPlatform(actor,run):this.db.withReadTenant(actor,t,run);}
}
