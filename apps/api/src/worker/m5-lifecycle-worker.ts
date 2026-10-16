import {SQL} from 'bun';
import {randomUUID} from 'node:crypto';
import {validateDatabaseUrl} from '../auth/policy';
import type {MediaStorage} from '../media/storage';
export interface LifecycleObject {assetId:string;key:string}
interface LifecycleClaim {tenantId:string;requestId:string;fence:number}
/** A failed DELETE/HEAD or checkpoint prevents progress. Retrying a confirmed
 * target repeats an idempotent storage DELETE before acknowledging it. */
export async function deleteLifecycleBatch(objects:LifecycleObject[],storage:Pick<MediaStorage,'deleteVerified'>,checkpoint:(object:LifecycleObject)=>Promise<void>,locked:(asset:string,run:()=>Promise<void>)=>Promise<void>){let count=0;for(const object of objects){await locked(object.assetId,async()=>{await storage.deleteVerified(object.key);await checkpoint(object);count++;});}return count;}
export class M5LifecycleWorker {
 private readonly client:SQL;readonly workerId=randomUUID();
 constructor(url:string,private readonly storage:Pick<MediaStorage,'deleteVerified'|'close'>){this.client=new SQL(validateDatabaseUrl(url,'gcms_m5_worker'),{max:2,connectionTimeout:3,idleTimeout:20,maxLifetime:0});}
 async verifyRole(){const rows=await this.client`SELECT current_user AS name,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,pg_has_role(current_user,'gcms_s02_owner','MEMBER') AS owner_member,EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname LIKE 'gcms_%' AND n.nspowner=r.oid) AS owns_schema,EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'gcms_%' AND c.relkind IN ('r','p') AND has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE')) AS table_access FROM pg_roles r WHERE rolname=current_user`;const row=rows[0];if(!row||row.name!=='gcms_m5_worker'||row.rolsuper||row.rolbypassrls||row.rolcreaterole||row.rolcreatedb||row.owner_member||row.owns_schema||row.table_access)throw new Error('Unsafe M5 lifecycle worker role');}
 async runOnce(tenant:string):Promise<{status:'completed'|'failed'|'idle';deletedObjects:number}>{
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(tenant))throw new Error('Explicit M5 tenant required');await this.verifyRole();const connection=await this.client.reserve();let tenantLocked=false,claim:LifecycleClaim|null=null,deletedObjects=0;
  try{
   await connection`SET statement_timeout='10s'`;const locks=await connection`SELECT pg_try_advisory_lock(hashtextextended(${tenant},7519)) AS locked`;tenantLocked=locks[0]?.locked===true;if(!tenantLocked)return {status:'idle',deletedObjects};
   const claims=await connection`SELECT gcms_m5.lifecycle_claim(${tenant},${this.workerId}) AS result`;claim=claims[0]?.result as LifecycleClaim|null;if(!claim)return {status:'idle',deletedObjects};const current=claim;
   while(true){const rows=await connection`SELECT gcms_m5.lifecycle_object_batch(${tenant},${current.requestId},${this.workerId},${current.fence}) AS result`;const targets=rows[0]?.result as LifecycleObject[];if(!Array.isArray(targets))throw new Error('Invalid lifecycle object batch');if(!targets.length)break;
    deletedObjects+=await deleteLifecycleBatch(targets,this.storage,async target=>{const ack=await connection`SELECT gcms_m5.lifecycle_object_deleted(${tenant},${current.requestId},${this.workerId},${current.fence},${target.key}) AS applied`;if(ack[0]?.applied!==true)throw new Error('Lifecycle checkpoint rejected');},async(asset,run)=>{const key=`${tenant}/${asset}`;let locked=false;try{await connection`SELECT pg_advisory_lock(hashtextextended(${key},7517))`;locked=true;
     // Recheck lease/fence after waiting for the previous writer to finish.
     await connection`SELECT gcms_m5.lifecycle_object_batch(${tenant},${current.requestId},${this.workerId},${current.fence})`;await run();
    }finally{if(locked)await connection`SELECT pg_advisory_unlock(hashtextextended(${key},7517))`;}});
   }
   const result=await connection`SELECT gcms_m5.lifecycle_cleanup(${tenant},${current.requestId},${this.workerId},${current.fence}) AS applied`;if(result[0]?.applied!==true)throw new Error('Lifecycle graph incomplete');return {status:'completed',deletedObjects};
  }catch(error){if(!claim)throw error;try{await connection`SELECT gcms_m5.lifecycle_fail(${tenant},${claim.requestId},${this.workerId},${claim.fence})`;}catch{/* A stale fence cannot overwrite a newer execution. The execution remains incomplete. */}return {status:'failed',deletedObjects};
  }finally{try{if(tenantLocked)await connection`SELECT pg_advisory_unlock(hashtextextended(${tenant},7519))`;}finally{connection.release();}}
 }
 async close(){this.storage.close();await this.client.close();}
}
