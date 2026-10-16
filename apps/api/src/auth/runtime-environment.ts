import { readFile } from 'node:fs/promises';
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
  return selectRuntimeEnvironment(privateConfig, process.env, intakeConfig,mediaConfig);
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
