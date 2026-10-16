import {BadRequestException} from '@nestjs/common';
import {sql} from 'drizzle-orm';
import type {S02Database,S02Transaction} from '../database';
import {parseIdentifier,type PrivateRequest} from './request-security';
/** The caller can pin a validated context, never choose a different tenant or primary. */
export async function withM5PublicContext<T>(db:S02Database,r:PrivateRequest,action:(tx:S02Transaction)=>Promise<T>):Promise<T>{
 const h=r.headers,version=h['x-gcms-primary-version'],binding=h['x-gcms-entry-binding'],generation=h['x-gcms-entry-generation'];
 for(const value of [version,generation])if(value!==undefined&&(typeof value!=='string'||!/^(0|[1-9][0-9]{0,9})$/.test(value)||Number(value)>2147483647))throw new BadRequestException();
 if((binding===undefined)!==(generation===undefined))throw new BadRequestException();if(binding!==undefined)parseIdentifier(binding);
 await db.verifyRoles();return db.tenantDb.transaction(async tx=>{
  await tx.execute(sql`SELECT set_config('statement_timeout','5s',true),set_config('lock_timeout','3s',true),set_config('gcms.m5_primary_version',${version??''}::text,true),set_config('gcms.m5_entry_binding',${binding??''}::text,true),set_config('gcms.m5_entry_generation',${generation??''}::text,true)`);
  return action(tx);
 });
}
