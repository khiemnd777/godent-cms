import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { sql } from 'drizzle-orm';
import { CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand, GetObjectCommand,
  HeadObjectCommand, ListBucketsCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { readConfig, type LocalConfig } from './config';
import { checkAuthAdapter } from './adapter-trial';
import { readiness, s3Client, s3Options, withPostgres, withRedis, SERVICE_TIMEOUT_MS } from './services';

export async function runServiceChecks() {
  // These checks create only uniquely owned technical resources, never application data.
  const config = readConfig();
  const checks: Record<string, unknown> = {};
  let phase = 'initialization';
  const evidence = { scope: 'S01 technical API and services only', recordedAt: new Date().toISOString(),
    runtime: { name: 'bun', version: Bun.version }, checks };
  const record = (name: string, details: unknown = {}) => { checks[name] = { status: 'PASS', details }; };

  function httpStatus(error: unknown) {
    return (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  }
  async function fails(action: () => Promise<unknown>, predicate?: (error: unknown) => boolean) {
    let rejected = false;
    try { await action(); } catch (error) { rejected = true; if (predicate) assert.ok(predicate(error)); }
    assert.ok(rejected, 'Expected technical operation to fail');
  }

  async function postgres() {
    phase = 'postgres';
    await withPostgres(config, async db => {
      const version = await db.execute(sql`select current_setting('server_version_num') as version`);
      assert.ok(Number(version[0]?.version) >= 180000 && Number(version[0]?.version) < 190000);
      record('postgres18', { version: version[0]?.version, driver: 'drizzle-orm/bun-sql + Bun.SQL' });
      await db.execute(sql`create temporary table gcms_s01_probe (value integer not null) on commit preserve rows`);
      try {
        await db.transaction(async tx => { await tx.execute(sql`insert into gcms_s01_probe values (1)`); });
        const committed = await db.execute(sql`select count(*)::integer as total from gcms_s01_probe`);
        assert.equal(committed[0]?.total, 1);
        const rollback = new Error('owned rollback sentinel');
        await fails(() => db.transaction(async tx => {
          await tx.execute(sql`insert into gcms_s01_probe values (2)`);
          throw rollback;
        }), error => error === rollback);
        const rolledBack = await db.execute(sql`select count(*)::integer as total from gcms_s01_probe`);
        assert.equal(rolledBack[0]?.total, 1);
        record('postgresCommitRollback', { resource: 'session-local temporary table', committedRows: 1, rowsAfterRollback: 1 });
      } finally {
        await db.execute(sql`drop table if exists pg_temp.gcms_s01_probe`);
        const removed = await db.execute(sql`select to_regclass('pg_temp.gcms_s01_probe') as relation`);
        assert.equal(removed[0]?.relation, null);
        record('postgresCleanup');
      }
    });
  }

  async function redis() {
    phase = 'redis';
    const key = `gcms:s01:${crypto.randomUUID()}`;
    try {
      await withRedis(config, async client => {
        assert.equal(await client.ping(), 'PONG');
        assert.equal(await client.set(key, 'technical-probe', { EX: 1, NX: true }), 'OK');
        assert.equal(await client.get(key), 'technical-probe');
        assert.ok(await client.ttl(key) >= 0);
      });
      await Bun.sleep(1150);
      await withRedis(config, async client => { assert.equal(await client.get(key), null); });
      record('redisTtl', { prefix: 'gcms:s01:', expirySeconds: 1, expired: true });
    } finally {
      await withRedis(config, async client => { await client.del(key); assert.equal(await client.exists(key), 0); });
      record('redisCleanup');
    }
  }

  async function s3() {
    phase = 's3';
    const client = s3Client(config);
    const bucket = `gcms-s01-${crypto.randomUUID()}`;
    const key = 'technical-probe.bin';
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 255]);
    let created = false;
    try {
      phase = 's3CreateBucket';
      await client.send(new CreateBucketCommand({ Bucket: bucket }), s3Options()); created = true;
      phase = 's3PutObject';
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes }), s3Options());
      phase = 's3GetObject';
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), s3Options());
      phase = 's3CompareBytes';
      const received = await result.Body?.transformToByteArray();
      checks.s3ByteShape = { expectedType: bytes.constructor.name, receivedType: received?.constructor.name, expectedLength: bytes.length, receivedLength: received?.length };
      assert.deepEqual(received, bytes);
      record('s3RoundTrip', { bytes: bytes.length, privateTechnicalBucket: true });
      const anonymous = await fetch(`${config.s3Endpoint}/${bucket}/${key}`, { signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS), redirect: 'error' });
      assert.ok([401, 403].includes(anonymous.status)); await anonymous.body?.cancel();
      record('s3AnonymousDenied', { status: anonymous.status });
      await fails(() => client.send(new GetObjectCommand({ Bucket: bucket, Key: 'missing-object' }), s3Options()), error => httpStatus(error) === 404);
      record('s3MissingObject', { status: 404 });
      const wrong = s3Client({ ...config, s3AccessKeyId: `invalid-${crypto.randomUUID()}`, s3SecretAccessKey: crypto.randomUUID() });
      try {
        await fails(() => wrong.send(new GetObjectCommand({ Bucket: bucket, Key: key }), s3Options()), error => [401, 403].includes(httpStatus(error) ?? 0));
        record('s3WrongCredentialsDenied');
      } finally { wrong.destroy(); }
    } finally {
      try {
        if (created) {
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), s3Options());
          await fails(() => client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), s3Options()), error => httpStatus(error) === 404);
          await client.send(new DeleteBucketCommand({ Bucket: bucket }), s3Options());
          const remaining = await client.send(new ListBucketsCommand({}), s3Options());
          assert.ok(!remaining.Buckets?.some(item => item.Name === bucket));
          record('s3Cleanup', { objectAbsent: true, bucketAbsent: true });
        }
      } finally { client.destroy(); }
    }
  }

  // A loopback listener accepts TCP but never answers: prove actual deadline handling.
  async function stalledServices() {
    phase = 'boundedServiceTimeouts';
    const sockets = new Set<Socket>();
    const server = createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const stalled: LocalConfig = { ...config,
      databaseUrl: `postgres://technical:technical@127.0.0.1:${address.port}/technical`,
      redisUrl: `redis://127.0.0.1:${address.port}`, s3Endpoint: `http://127.0.0.1:${address.port}` };
    try {
      const start = performance.now();
      const result = await readiness(stalled);
      const elapsedMs = Math.round(performance.now() - start);
      assert.equal(result.status, 'unavailable');
      assert.deepEqual(result.services, { postgres: 'unavailable', redis: 'unavailable', s3: 'unavailable' });
      assert.ok(elapsedMs < 5000);
      record('stalledServiceTimeouts', { services: result.services, elapsedMs, maximumMs: 5000 });
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    const closed = { ...stalled };
    const start = performance.now();
    assert.equal((await readiness(closed)).status, 'unavailable');
    record('closedLoopbackFailures', { elapsedMs: Math.round(performance.now() - start) });
  }

  try {
    await postgres(); await redis(); await s3(); await stalledServices();
    phase = 'betterAuthAdapter'; record('betterAuthAdapter', await checkAuthAdapter(config));
    phase = 'readiness'; const ready = await readiness(config); assert.equal(ready.status, 'ready'); record('readiness', ready);
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Unknown';
    const code = (error as { code?: unknown })?.code;
    checks[phase] = { status: 'FAIL', error: 'Technical check failed; exception details intentionally redacted.',
      classification: { name: ['Error', 'AssertionError', 'AbortError', 'TimeoutError', 'S3ServiceException', 'InvalidAccessKeyId', 'AccessDenied', 'SignatureDoesNotMatch', 'NoSuchKey'].includes(name) ? name : 'Other',
        code: ['ERR_ASSERTION', 'ECONNREFUSED', 'ETIMEDOUT', 'ABORT_ERR'].includes(String(code)) ? code : 'Other', httpStatus: httpStatus(error) } };
    process.exitCode = 1;
  } finally {
    await Bun.write('docs/evidence/s01-api.json', JSON.stringify(evidence, null, 2) + '\n');
    console.info(JSON.stringify(evidence, null, 2));
  }

}
