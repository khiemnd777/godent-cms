import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { sql } from 'drizzle-orm';
import { createClient } from 'redis';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import type { LocalConfig } from './config';

export const SERVICE_TIMEOUT_MS = 2500;
export type ServiceStatus = 'available' | 'unavailable';

// Driver connection timeout plus pool destruction bounds reads and socket stalls.
// Sources: https://orm.drizzle.team/docs/connect-bun-sql
// https://bun.sh/docs/runtime/sql#connection-options
export async function withPostgres<T>(config: LocalConfig, action: (db: ReturnType<typeof drizzle>) => Promise<T>): Promise<T> {
  const client = new SQL(config.databaseUrl, { max: 1, connectionTimeout: 2, idleTimeout: 2 });
  const timer = setTimeout(() => { void client.close({ timeout: 0 }).catch(() => {}); }, SERVICE_TIMEOUT_MS);
  try { return await action(drizzle({ client })); }
  finally { clearTimeout(timer); await client.close({ timeout: 0 }); }
}

export function redisClient(config: LocalConfig) {
  const client = createClient({ url: config.redisUrl, socket: { connectTimeout: 2000, reconnectStrategy: false }, disableOfflineQueue: true });
  // Error details can contain credentials or connection configuration.
  client.on('error', () => {});
  return client;
}
export async function withRedis<T>(config: LocalConfig, action: (client: ReturnType<typeof redisClient>) => Promise<T>): Promise<T> {
  const client = redisClient(config);
  const timer = setTimeout(() => { if (client.isOpen) client.destroy(); }, SERVICE_TIMEOUT_MS);
  try { await client.connect(); return await action(client); }
  finally { clearTimeout(timer); if (client.isOpen) client.destroy(); }
}

export function s3Client(config: LocalConfig) {
  return new S3Client({ endpoint: config.s3Endpoint, region: config.s3Region, forcePathStyle: true,
    credentials: { accessKeyId: config.s3AccessKeyId, secretAccessKey: config.s3SecretAccessKey }, maxAttempts: 1 });
}
export const s3Options = () => ({ abortSignal: AbortSignal.timeout(SERVICE_TIMEOUT_MS) });

async function status(action: () => Promise<unknown>): Promise<ServiceStatus> {
  try { await action(); return 'available'; } catch { return 'unavailable'; }
}

export async function readiness(config: LocalConfig) {
  const [postgres, redis, s3] = await Promise.all([
    status(() => withPostgres(config, async db => { const rows = await db.execute(sql`select 1 as ok`); if (rows[0]?.ok !== 1) throw new Error('Invalid probe'); })),
    status(() => withRedis(config, async client => { if (await client.ping() !== 'PONG') throw new Error('Invalid probe'); })),
    status(async () => { const client = s3Client(config); try { await client.send(new ListBucketsCommand({}), s3Options()); } finally { client.destroy(); } }),
  ]);
  return { status: [postgres, redis, s3].every(value => value === 'available') ? 'ready' : 'unavailable', services: { postgres, redis, s3 } };
}
