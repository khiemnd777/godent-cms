import { boolean, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// Better Auth 1.7.10 password-only core schema. SQL migrations are authoritative.
// https://better-auth.com/docs/adapters/drizzle
const authSchema = pgSchema('gcms_s02_auth');
const time = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
export const user = authSchema.table('user', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false), image: text('image'),
  createdAt: time('created_at').notNull().defaultNow(), updatedAt: time('updated_at').notNull().defaultNow(),
  active: boolean('active').notNull().default(true), platformAdmin: boolean('platform_admin').notNull().default(false),
});
export const session = authSchema.table('session', {
  id: text('id').primaryKey(), token: text('token').notNull().unique(), userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: time('expires_at').notNull(), createdAt: time('created_at').notNull().defaultNow(), updatedAt: time('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'), userAgent: text('user_agent'),
});
export const account = authSchema.table('account', {
  id: text('id').primaryKey(), accountId: text('account_id').notNull(), providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }), password: text('password'),
  accessToken: text('access_token'), refreshToken: text('refresh_token'), idToken: text('id_token'),
  accessTokenExpiresAt: time('access_token_expires_at'), refreshTokenExpiresAt: time('refresh_token_expires_at'), scope: text('scope'),
  createdAt: time('created_at').notNull().defaultNow(), updatedAt: time('updated_at').notNull().defaultNow(),
}, table => [uniqueIndex('account_provider_identity').on(table.providerId, table.accountId)]);
export const verification = authSchema.table('verification', {
  id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(), expiresAt: time('expires_at').notNull(),
  createdAt: time('created_at').notNull().defaultNow(), updatedAt: time('updated_at').notNull().defaultNow(),
});
// Legacy factor storage remains in PostgreSQL, outside the active auth mapping.
export const authTables = { user, session, account, verification };
