import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASELINE='.local/m4-baseline.json';
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const ident=(value:string)=>{if(!/^[a-z_][a-z0-9_]*$/.test(value))throw new Error('Unsafe identifier');return `"${value}"`;};
type FileProof={path:string;sha256:string;mode:number;bytes:number};
type TableProof={schema:string;name:string;columns:string[];keys:string[];volatile:boolean;rows:Array<{key:string;hash:string}>};
interface Baseline {owner:'GCMS-M4-v1';recordedAt:string;tables:TableProof[];files:FileProof[]}
async function filesAt(path:string):Promise<string[]> {
 const meta=await lstat(path);if(meta.isSymbolicLink())throw new Error('Protected symlink refused');
 if(meta.isFile())return [path];if(!meta.isDirectory())throw new Error('Unexpected protected file');
 return (await Promise.all((await readdir(path)).sort().map(name=>filesAt(`${path}/${name}`)))).flat();
}
async function main() {
 if(Bun.version!=='1.4.3'||process.cwd()!==resolve(import.meta.dir,'..')||!process.argv.includes('--local-m4'))throw new Error('Explicit pinned local M4 required');
 const phase=process.argv.at(-1);if(!['capture','compare'].includes(phase??''))throw new Error('Explicit phase required');
 const url=new URL(process.env.DATABASE_URL??'');
 if(url.protocol!=='postgresql:'||url.hostname!=='127.0.0.1'||url.port!=='5888'||url.pathname!=='/gcms_s01'||url.username!=='gcms_local'||url.search||url.hash)throw new Error('Wrong retained local database');
 const local=await lstat('.local');if(!local.isDirectory()||local.isSymbolicLink()||(local.mode&0o777)!==0o700)throw new Error('Unsafe private directory');
 const db=new SQL(url.toString(),{max:1,connectionTimeout:3,connection:{default_transaction_read_only:'on'}});
 try {
  if(phase==='capture') {
   const tables:TableProof[]=[];
   const catalog=await db`SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema LIKE 'gcms_%' AND table_type='BASE TABLE' ORDER BY table_schema,table_name`;
   for(const table of catalog) {
    const schema=String(table.table_schema),name=String(table.table_name);
    const columns=(await db`SELECT column_name FROM information_schema.columns WHERE table_schema=${schema} AND table_name=${name} ORDER BY ordinal_position`).map((v:{column_name:string})=>v.column_name);
    const keys:string[]=(await db`SELECT a.attname FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN unnest(i.indkey) WITH ORDINALITY k(attnum,ord) ON true JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum WHERE i.indisprimary AND n.nspname=${schema} AND c.relname=${name} ORDER BY k.ord`).map((v:{attname:string})=>v.attname);
    const rows=await db.unsafe(`SELECT to_jsonb(t)::text AS value FROM ${ident(schema)}.${ident(name)} t`);
    tables.push({schema,name,columns,keys,volatile:schema==='gcms_s02_auth'&&['session','reauth_grant','verification'].includes(name)||schema==='gcms_s04'&&['abuse_bucket','challenge'].includes(name),rows:rows.map((r:{value:string})=>{const v=JSON.parse(r.value);return {key:hash(JSON.stringify(keys.length?keys.map(k=>v[k]):v)),hash:hash(r.value)};})});
   }
   const paths=['.env',...(await filesAt('.local')).filter(p=>p!==BASELINE),...(await filesAt('docs/evidence')).filter(p=>!p.startsWith('docs/evidence/m4/')), ...await filesAt('.agents'),...await filesAt('.codex'),...await filesAt('docs/design')];
   const files:FileProof[]=[];for(const path of paths){const meta=await lstat(path);files.push({path,sha256:hash(await readFile(path)),mode:meta.mode&0o777,bytes:meta.size});}
   const baseline:Baseline={owner:'GCMS-M4-v1',recordedAt:new Date().toISOString(),tables,files};
   await writeFile(BASELINE,JSON.stringify(baseline)+'\n',{flag:'wx',mode:0o600});
   console.info(JSON.stringify({status:'PASS',phase,tables:tables.length,files:files.length,rows:tables.reduce((n,t)=>n+t.rows.length,0),rawDataEmitted:false}));return;
  }
  const meta=await lstat(BASELINE);if(!meta.isFile()||meta.isSymbolicLink()||(meta.mode&0o777)!==0o600)throw new Error('Unsafe baseline');
  const baseline=JSON.parse(await readFile(BASELINE,'utf8')) as Baseline;if(baseline.owner!=='GCMS-M4-v1')throw new Error('Wrong baseline owner');
  const tables=[];
  for(const table of baseline.tables) {
   const currentColumns=(await db`SELECT column_name FROM information_schema.columns WHERE table_schema=${table.schema} AND table_name=${table.name}`).map((v:{column_name:string})=>v.column_name);
   const additions=currentColumns.filter((c:string)=>!table.columns.includes(c));additions.forEach(ident);
   const subtract=additions.length?`-ARRAY[${additions.map((c:string)=>`'${c}'`).join(',')}]`:'';
   const rows=await db.unsafe(`SELECT (to_jsonb(t)${subtract})::text AS value FROM ${ident(table.schema)}.${ident(table.name)} t`);
   const current=new Map(rows.map((r:{value:string})=>{const v=JSON.parse(r.value);return [hash(JSON.stringify(table.keys.length?table.keys.map(k=>v[k]):v)),hash(r.value)];}));
   let unchanged=0,volatileRemoved=0,unexpected=0;
   for(const row of table.rows){if(current.get(row.key)===row.hash)unchanged++;else if(!current.has(row.key)&&table.volatile)volatileRemoved++;else unexpected++;}
   tables.push({table:`${table.schema}.${table.name}`,status:unexpected?'FAIL':'PASS',baselineRows:table.rows.length,currentRows:rows.length,unchanged,volatileRemoved,unexpected,additiveColumns:additions});
  }
  const files=[];
  for(const old of baseline.files) {
   try {
    const meta=await lstat(old.path),bytes=await readFile(old.path);
    const unchanged=meta.isFile()&&!meta.isSymbolicLink()&&(meta.mode&0o777)===old.mode&&hash(bytes)===old.sha256;
    const append=old.path.endsWith('.log')&&bytes.byteLength>=old.bytes&&hash(bytes.subarray(0,old.bytes))===old.sha256;
    files.push({path:old.path,status:unchanged?'PASS':old.path==='.local/processes.json'?'EXPECTED_LAUNCHER_METADATA_CHANGE':append?'EXPECTED_LOG_APPEND':'FAIL'});
   } catch {files.push({path:old.path,status:'FAIL'});}
  }
  const status=tables.every(t=>t.status==='PASS')&&files.every(f=>f.status!=='FAIL')?'PASS':'FAIL';
  const report={status,recordedAt:new Date().toISOString(),tables,files,limits:'Retained row hashes projected onto original columns and protected file hashes/modes. New resources separately owned. Only named volatile row expiry, launcher metadata and original log-prefix-preserving append allowed. No raw rows, credentials or backup/restore proof.'};
  await writeFile(`docs/evidence/m4/preservation-${Date.now()}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.info(JSON.stringify({status,phase,tableFailures:tables.filter(t=>t.status==='FAIL'),fileFailures:files.filter(f=>f.status==='FAIL')}));if(status!=='PASS')process.exitCode=1;
 } finally {await db.close();}
}
void main().catch(()=>{console.error('M4 preservation refused/failed; details redacted.');process.exitCode=1;});
