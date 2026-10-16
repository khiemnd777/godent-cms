import { describe, expect, test } from 'bun:test';
import { selectWorkerEnvironment } from '../../../scripts/start-s05-worker';
describe('S05 worker process credential boundary', () => {
  test('copies only worker role URL and platform variables', () => {
    const worker = 'postgres://gcms_s05_worker:synthetic-only@127.0.0.1:5888/gcms_s01';
    const env = selectWorkerEnvironment({ S05_WORKER_DATABASE_URL: worker }, { PATH: '/synthetic', HOME: '/synthetic', TMPDIR: '/private/tmp',
      DATABASE_URL: 'forbidden', S02_AUTH_DATABASE_URL: 'forbidden', BETTER_AUTH_SECRET: 'forbidden', S04_HMAC_SECRET: 'forbidden', S3_SECRET_ACCESS_KEY: 'forbidden' });
    expect(Object.keys(env).sort()).toEqual(['HOME', 'PATH', 'S05_WORKER_DATABASE_URL', 'TMPDIR']);
    expect(env.S05_WORKER_DATABASE_URL).toBe(worker);
    expect(() => selectWorkerEnvironment({ S05_WORKER_DATABASE_URL: worker.replace('gcms_s05_worker', 'gcms_local') }, {})).toThrow();
  });
});
