import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { LocalConfig } from './config';
import { withPostgres } from './services';

// Initialization only. No handlers, schema, migrations, users, login or sessions.
// Source: https://better-auth.com/docs/adapters/drizzle
export async function checkAuthAdapter(config: LocalConfig) {
  return withPostgres(config, async db => {
    const auth = betterAuth({ database: drizzleAdapter(db, { provider: 'pg' }),
      secret: config.authSecret, baseURL: 'http://localhost:5890', logger: { disabled: true } });
    const context = await auth.$context;
    if (typeof context.adapter.findOne !== 'function' || typeof context.adapter.create !== 'function' ||
        typeof auth.handler !== 'function') throw new Error('Adapter initialization failed');
    return { status: 'initialized', adapter: context.adapter.id,
      scope: 'initialization-only', login: 'NOT_RUN', session: 'NOT_RUN' };
  });
}
