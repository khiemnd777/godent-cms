import {SQL} from 'bun';
import {randomUUID} from 'node:crypto';
import {validateDatabaseUrl} from '../auth/policy';
import {m3Id} from '../contracts/m3-validation';
export interface ContentPurgeClaim {tenantId:string;permissionId:string;workerId:string;fence:number}
/** Resource-scoped delivery has no cached HTML or copied storage objects.
 * This worker settles the durable invalidation intent. Global asset deletion
 * remains MediaWorker's physical purge and cannot be replaced by this result. */
export class ContentPurgeWorker {
  private readonly client:SQL;
  constructor(url:string,private readonly invalidate:(claim:ContentPurgeClaim)=>Promise<void>=async()=>{}){
    this.client=new SQL(validateDatabaseUrl(url,'gcms_s07_worker'),{max:1,connectionTimeout:3,idleTimeout:20});
  }
  async runOnce(tenantId:string){
    m3Id(tenantId);const worker=randomUUID();
    const roles=await this.client`SELECT current_user AS name,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,pg_has_role(current_user,'gcms_s02_owner','MEMBER') AS owner_member,
      EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname IN ('gcms_s02','gcms_s02_auth','gcms_s04','gcms_s05','gcms_s07','gcms_m3') AND n.nspowner=r.oid) AS owns_schema,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('gcms_s02','gcms_s02_auth','gcms_s04','gcms_s05','gcms_s07','gcms_m3') AND c.relkind IN ('r','p') AND has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE')) AS table_access
      FROM pg_roles r WHERE rolname=current_user`;
    const role=roles[0];if(!role||role.name!=='gcms_s07_worker'||role.rolsuper||role.rolbypassrls||role.rolcreaterole||role.rolcreatedb||role.owner_member||role.owns_schema||role.table_access)throw new Error('Unsafe content purge role');
    const rows=await this.client`SELECT gcms_m3.purge_claim(${tenantId},${worker}) AS claim`,claim=rows[0]?.claim as ContentPurgeClaim|null;
    if(!claim)return {claimed:0,completed:0,ownedObjects:0,scope:'resource_delivery' as const};
    let outcome='success';try{await this.invalidate(claim);}catch{outcome='retry';}
    const finish=await this.client`SELECT gcms_m3.purge_finish(${tenantId},${claim.permissionId},${worker},${claim.fence},${outcome}) AS ok`;
    return {claimed:1,completed:finish[0]?.ok===true&&outcome==='success'?1:0,ownedObjects:0,scope:'resource_delivery' as const};
  }
  async close(){await this.client.close();}
}
