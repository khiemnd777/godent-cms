import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { lstat,readFile,writeFile } from 'node:fs/promises';
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const ident=(v:string)=>{if(!/^[a-z_][a-z0-9_]*$/.test(v))throw new Error('Invalid SQL identifier');return `"${v}"`;};
async function main() {
 const baseline=JSON.parse(await readFile('.local/m2-db-baseline.json','utf8')),files=JSON.parse(await readFile('.local/m2-file-baseline.json','utf8'));
 const url=new URL(process.env.DATABASE_URL??'');if(url.hostname!=='127.0.0.1'||url.port!=='5888'||url.pathname!=='/gcms_s01'||decodeURIComponent(url.username)!=='gcms_local')throw new Error('Local identity required');
 const db=new SQL(url.toString(),{max:1,connectionTimeout:3,connection:{default_transaction_read_only:'on'}});
 const tables=[];
 try {
  for(const table of baseline.tables) {
   const columns=await db`SELECT column_name FROM information_schema.columns WHERE table_schema=${table.schema} AND table_name=${table.table}`;
   const oldColumns=new Set(table.columns.map((c:{column_name:string})=>c.column_name));
   const additions=columns.map((c:{column_name:string})=>String(c.column_name)).filter((c:string)=>!oldColumns.has(c));
   additions.forEach(ident);
   const subtract=additions.length?`-ARRAY[${additions.map((c:string)=>`'${c}'`).join(',')}]`:'';
   const rows=await db.unsafe(`SELECT (to_jsonb(t)${subtract})::text AS projection FROM ${ident(table.schema)}.${ident(table.table)} t`);
   const now=new Map<string,string>();
   for(const r of rows) {const v=JSON.parse(r.projection),key=table.primaryKeyColumns.length?table.primaryKeyColumns.map((c:string)=>v[c]):v;now.set(sha(JSON.stringify(key)),sha(r.projection));}
   let same=0,removedVolatile=0,unexpected=0;
   for(const old of table.projections) {if(now.get(old.keyHash)===old.rowHash)same++;else if(!now.has(old.keyHash)&&table.classification==='volatile_session_or_abuse_state')removedVolatile++;else unexpected++;}
   tables.push({table:`${table.schema}.${table.table}`,baselineRows:table.rows,currentRows:rows.length,retainedSame:same,removedVolatile,unexpected,additiveColumns:additions,credentialInvariant:table.credentialInvariant,status:unexpected?'FAIL':'PASS'});
  }
 }finally{await db.close();}
 const privateChecks=[];
 for(const [path,old] of Object.entries(files.private) as Array<[string,{sha256:string;mode:string}]>) {
  if(path==='.local/processes.json'){privateChecks.push({path,status:'EXPECTED_LAUNCHER_METADATA_CHANGE'});continue;}
  if(path==='.local/m1-closure-runtime.log'){const current=await readFile(path),hash=createHash('sha256');let prefix=false;for(const part of current.toString('utf8').split(/(?<=\n)/)){hash.update(part);if(hash.copy().digest('hex')===old.sha256)prefix=true;}privateChecks.push({path,status:prefix?'EXPECTED_LIVE_LOG_APPEND':'FAIL'});continue;}
  try {const meta=await lstat(path);privateChecks.push({path,status:sha(await readFile(path))===old.sha256&&`0o${(meta.mode&0o777).toString(8)}`===old.mode?'PASS':'FAIL'});}
  catch{privateChecks.push({path,status:'FAIL'});}
 }
 const protectedPaths=Object.keys(files.repo).filter(p=>p.startsWith('docs/evidence/')||p.startsWith('.agents/')||p.startsWith('.codex/')||p.startsWith('docs/design/'));
 const protectedChecks=[];for(const path of protectedPaths)protectedChecks.push({path,status:sha(await readFile(path))===files.repo[path]?'PASS':'FAIL'});
 const result={status:tables.every(t=>t.status==='PASS')&&privateChecks.every(t=>t.status!=='FAIL')&&protectedChecks.every(t=>t.status==='PASS')?'PASS':'FAIL',recordedAt:new Date().toISOString(),tables,privateFiles:privateChecks,protectedFiles:protectedChecks,
  limits:'Readonly before/after hashes of pre-M2 rows projected onto original columns. New additive M2 rows/columns are separate. Only expired volatile-state removals permitted. Launcher metadata intentionally replaced; original live launcher log prefix hash preserved with shutdown append. No backup/restore claim; no raw rows or credentials emitted.'};
 await writeFile(`docs/evidence/m2/preservation-${Date.now()}.json`,JSON.stringify(result,null,2)+'\n');
 console.info(JSON.stringify({status:result.status,tables:tables.length,failedTables:tables.filter(t=>t.status==='FAIL').map(t=>({table:t.table,unexpected:t.unexpected})),privateFailures:privateChecks.filter(t=>t.status==='FAIL').map(t=>t.path),protectedFailures:protectedChecks.filter(t=>t.status==='FAIL').map(t=>t.path)}));if(result.status!=='PASS')process.exitCode=1;
}
void main().catch(()=>{console.error('M2 preservation check failed; details redacted.');process.exitCode=1;});
