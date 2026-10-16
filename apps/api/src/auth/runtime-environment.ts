import { lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from './policy';

export async function loadRuntimeEnvironment() {
  const path = resolve(process.cwd(), '.local/s02.env');
  const privateConfig = Object.fromEntries((await readFile(path, 'utf8')).trim().split('\n').map(line => {
    const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)];
  }));
  const intakeConfig = Object.fromEntries((await readFile(resolve(process.cwd(),'.local/s04.env'),'utf8')).trim().split('\n').map(line=>{
    const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1)];
  }));
  let mediaConfig:Record<string,string>|undefined;
  try {mediaConfig=Object.fromEntries((await readFile(resolve(process.cwd(),'.local/m2.env'),'utf8')).trim().split('\n').map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1)];}));}
  catch(error) {if(!(error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT')) throw error;}
  const selected = selectRuntimeEnvironment(privateConfig, process.env, intakeConfig,mediaConfig);
  try {
    const path = resolve(process.cwd(), '.local/m5-fixtures.json'), meta = await lstat(path);
    if (!meta.isFile() || meta.isSymbolicLink() || (meta.mode & 0o777) !== 0o600 || meta.uid !== process.getuid?.() || meta.size > 262144) throw new Error('Unsafe M5 local scope');
    const domains = selectM5LocalDomains(JSON.parse(await readFile(path, 'utf8')));
    selected.api.GCMS_M5_LOCAL_DOMAINS = JSON.stringify(domains);
    selected.web.GCMS_M5_LOCAL_HOSTS = JSON.stringify(domains.bindings.map(binding => binding.host));
  } catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error; }
  return selected;
}

/** Only the private, owned fixture scope may enable the synthetic verifier. */
export function selectM5LocalDomains(input: unknown) {
  const value = input as { owner?: string; runId?: string; status?: string; tenants?: { id: string; slug: string; name: string; label: string }[] };
  const uuid = (id: unknown) => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
  if (!value || value.owner !== 'GCMS-M5-v1' || !uuid(value.runId) || !['provisioning', 'complete'].includes(value.status ?? '') || !Array.isArray(value.tenants) || value.tenants.length !== 3) throw new Error('Invalid local M5 scope');
  const run = value.runId!, seen = new Set<string>();
  const bindings = value.tenants.map(tenant => {
    if (!['A', 'B', 'Deletion'].includes(tenant.label) || !uuid(tenant.id) || seen.has(tenant.label) || tenant.slug !== `m5-${run.slice(0, 8)}-${tenant.label.toLowerCase()}` || tenant.name !== `M5 Synthetic ${tenant.label} ${run}`) throw new Error('Invalid owned M5 tenant');
    seen.add(tenant.label);
    return { tenantId: tenant.id, host: `${tenant.slug}.localhost` };
  });
  const primary = bindings.find(binding => binding.host.endsWith('-a.localhost'));
  if (primary) bindings.push({ tenantId: primary.tenantId, host: `www.${primary.host}` });
  return { mode: 'local-m5', bindings };
}

export function selectRuntimeEnvironment(privateConfig: Record<string, string>, source: Record<string, string | undefined>,intakeConfig?:Record<string,string>,mediaConfig?:Record<string,string>) {
  const common: Record<string, string> = { NEXT_TELEMETRY_DISABLED: '1' };
  for (const name of ['PATH', 'HOME', 'TMPDIR', 'NODE_ENV']) if (source[name]) common[name] = source[name]!;
  const api = { ...common };
  for (const role of ['AUTH', 'TENANT', 'PLATFORM']) {
    const key = `S02_${role}_DATABASE_URL`;
    api[key] = validateDatabaseUrl(privateConfig[key], `gcms_s02_${role.toLowerCase()}`);
  }
  if(intakeConfig) {
    api.S04_INTAKE_DATABASE_URL=validateDatabaseUrl(intakeConfig.S04_INTAKE_DATABASE_URL,'gcms_s04_intake');
    if(!/^[a-f0-9]{64}$/.test(intakeConfig.S04_HMAC_SECRET??'')) throw new Error('Invalid S04 HMAC configuration');
    api.S04_HMAC_SECRET=intakeConfig.S04_HMAC_SECRET;
  }
  for (const name of ['REDIS_URL', 'S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'BETTER_AUTH_SECRET']) {
    if (!source[name]) throw new Error(`Missing runtime configuration: ${name}`);
    api[name] = source[name]!;
  }
  api.DATABASE_URL = api.S02_TENANT_DATABASE_URL;
  if(mediaConfig) for(const name of ['S07_MEDIA_BUCKET','S07_MEDIA_SIGNING_SECRET','S07_STORAGE_ACCESS_KEY_ID','S07_STORAGE_SECRET_ACCESS_KEY']) {
    if(!mediaConfig[name]) throw new Error('Incomplete M2 media configuration');api[name]=mediaConfig[name];
  }
  return { api, web: { ...common } };
}
