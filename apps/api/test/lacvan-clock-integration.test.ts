import {SQL} from 'bun';
import {afterAll,beforeAll,describe,expect,test} from 'bun:test';
import {validateDatabaseUrl} from '../src/auth/policy';
/** Root prepares one owned, published promotion with a start boundary 3--20s ahead.
 * Only selected identifiers are passed; this test reads no fixture/credential files and writes no rows.
 * Two connections reproduce a statement that starts before the boundary and projects after its lock wait.
 */
(process.env.LACVAN_CLOCK_INTEGRATION==='1'?describe:describe.skip)('Signature post-lock promotion clock',()=>{
 let db:SQL;beforeAll(()=>{db=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:2,connectionTimeout:3});});afterAll(()=>db?.close());
 async function verify(boundaryName:'startAt'|'endAt',expected:'active'|'expired'){
  const tenant=process.env.LACVAN_TEST_TENANT_ID,promotion=process.env.LACVAN_TEST_PROMOTION_ID;if(!tenant||!promotion)throw new Error('Root-selected owned tenant/promotion identifiers required');
  const state=await db.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');return (await tx`SELECT p.content->>${boundaryName} AS boundary,p.content->>'startAt' AS start_at,p.content->>'endAt' AS end_at,p.id FROM gcms_m4.variant v JOIN gcms_m4.publication p ON p.tenant_id=v.tenant_id AND p.id=v.active_publication_id WHERE v.tenant_id=${tenant} AND v.kind='promotion' AND v.resource_id=${promotion} AND v.locale='vi'`)[0];});
  if(!state)throw new Error('Owned current Published VI promotion required');const boundary=Date.parse(state.boundary),delay=boundary-Date.now();if(delay<500||delay>20000||(boundaryName==='startAt'&&Date.parse(state.end_at)<boundary+5000))throw new Error('Root must prepare a near-future start and later end boundary');
  let release!:()=>void,locked!:()=>void;const acquired=new Promise<void>(resolve=>{locked=resolve;}),unlock=new Promise<void>(resolve=>{release=resolve;});
  const holder=db.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');await tx`SELECT pg_advisory_xact_lock(hashtextextended(${tenant},7202))`;locked();await unlock;});await acquired;
  const projection=db.begin(async tx=>{await tx.unsafe("SET LOCAL ROLE gcms_s02_owner; SET LOCAL statement_timeout='30s'");return (await tx`WITH held AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtextextended(${tenant},7202))) SELECT statement_timestamp() AS statement_at,clock_timestamp() AS actual_at,gcms_m4.project_core(${tenant},'promotion',${promotion},'vi',NULL,0,false) AS page FROM held`)[0];});
  try{await Bun.sleep(Math.max(1,boundary-Date.now()+150));}finally{release();}await holder;const result=await projection;
  expect(new Date(result.statement_at).getTime()).toBeLessThan(boundary);if(boundaryName==='endAt')expect(new Date(result.statement_at).getTime()).toBeGreaterThanOrEqual(Date.parse(state.start_at));expect(new Date(result.actual_at).getTime()).toBeGreaterThanOrEqual(boundary);expect(result.page?.promotionState).toBe(expected);
 }
 test('a statement started before start becomes active after the lock wait',()=>verify('startAt','active'),30000);
 test('a statement started while active becomes expired after the lock wait',()=>verify('endAt','expired'),30000);
});
