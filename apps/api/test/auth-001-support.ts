import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SQL, type TransactionSQL } from 'bun';
import { createS02Database } from '../src/database';
import { createS02Auth } from '../src/auth';
import { validateDatabaseUrl } from '../src/auth/policy';
import { openPasswordSession } from '../../../scripts/s02-fixtures';

export interface Auth001Fixtures {
  tenantIds: { A: string; B: string };
  identities: Array<{ label: string; userId: string; email: string; password: string; purpose: string }>;
}
/** Pre-created bounded AUTH accounts only. This helper never seeds or changes retained credentials. */
export class Auth001Harness {
  db = createS02Database();
  identity = createS02Auth(this.db);
  owner = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'), { max: 1 });
  fixtures!: Auth001Fixtures;
  private lastSignInAt = 0;
  readonly transport = async (request: Request) => {
    if (request.method === 'POST' && new URL(request.url).pathname === '/api/auth/sign-in/email') {
      // Better Auth's rolling ten-second window follows the latest allowed call.
      // Keep the real limiter enabled and allow an eleven-second quiet interval.
      const remaining = 11000 - (Date.now() - this.lastSignInAt);
      if (remaining > 0) await Bun.sleep(remaining);
      this.lastSignInAt = Date.now();
    }
    return this.identity.handler(request);
  };
  async ready() {
    this.fixtures = JSON.parse(await readFile(resolve('.local/auth-001-data-fixtures.json'), 'utf8')) as Auth001Fixtures;
    if (this.fixtures.identities.length > 8 || !this.fixtures.tenantIds.A || !this.fixtures.tenantIds.B) throw new Error('Bounded AUTH fixtures absent');
  }
  account(label: string) {
    const found = this.fixtures.identities.find(item => item.label === ({ recovery: 'apiRecovery', disable: 'apiDisable' }[label] ?? label));
    if (!found || !found.email.endsWith('@auth-001.example.test') || !['recovery', 'disable'].includes(found.purpose)) throw new Error('Owned AUTH account absent');
    return found;
  }
  async signIn(label: string) { return openPasswordSession(this.identity, this.account(label), this.transport); }
  async owned<T>(action: (tx: TransactionSQL) => Promise<T>): Promise<T> {
    return this.owner.begin(async tx => { await tx.unsafe('SET LOCAL ROLE gcms_s02_owner'); return action(tx); });
  }
  async close() { await this.db.close(); await this.owner.close(); }
}
