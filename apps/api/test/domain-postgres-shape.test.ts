import { expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createS02Database } from '../src/database';
import { safeError } from '../src/errors';

/** Optional, read-only diagnostic: output contains only class names and error-code fields. */
test.skipIf(process.env.S02_ERROR_SHAPE !== '1')('redacted Bun PostgreSQL error metadata', async () => {
  const database = createS02Database();
  try {
    await database.tenantDb.execute(sql`SELECT 1 / 0`);
    throw new Error('Expected PostgreSQL error absent');
  } catch (error) {
    const codes: Array<Record<string, unknown>> = [];
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
      const value = current as { name?: unknown; code?: unknown; errno?: unknown; sqlState?: unknown; cause?: unknown };
      codes.push(Object.fromEntries(Object.entries({ name: value.name, code: value.code, errno: value.errno, sqlState: value.sqlState })
        .filter(([, item]) => typeof item === 'string' || typeof item === 'number')));
      current = value.cause;
    }
    console.info(JSON.stringify({ postgresErrorCodes: codes, safeStatus: safeError(error).statusCode }));
    expect(codes.some(item => Object.values(item).includes('22012'))).toBe(true);
  } finally { await database.close(); }
});
