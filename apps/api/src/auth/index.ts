import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ForbiddenException, UnauthorizedException, BadRequestException, HttpException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { S02Database, S02Transaction, SessionActor } from '../database';
import { authTables } from '../database/schema';
import { ADMIN_ORIGIN, API_ORIGIN, SESSION_SECONDS, REAUTH_SECONDS, validateAuthRequest } from './policy';
import { sendLocalMail } from './mail';

const allowedPaths = new Set(['/sign-in/email','/sign-out','/send-verification-email','/verify-email',
  '/request-password-reset','/reset-password']);
const noStore = { 'Cache-Control': 'private, no-store', Pragma: 'no-cache', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function protectAuthResponse(response: Response): Promise<Response> {
  const headers=new Headers(response.headers);
  for(const [key,value] of Object.entries(noStore)) headers.set(key,value);
  if((response.status>=300 && response.status<400) || response.body===null) {
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
  if(response.headers.get('content-type')?.includes('application/json')) {
    headers.delete('content-length');
    const text=await response.text();
    const value:unknown=text?JSON.parse(text):null;
    if(value && typeof value==='object' && !Array.isArray(value)) {
      const object=value as Record<string,unknown>;
      delete object.token;
      if(object.session && typeof object.session==='object') delete (object.session as Record<string,unknown>).token;
    }
    return Response.json(value,{status:response.status,headers});
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export function createS02Auth(db: S02Database, env: Record<string, string | undefined> = process.env) {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('Invalid authentication secret');
  const budgets = new Map<string, { count: number; until: number }>();
  function rateLimit(key: string, limit: number) {
    const now = Date.now();
    for (const [entry, value] of budgets) if (value.until <= now) budgets.delete(entry);
    const value = budgets.get(key) ?? { count: 0, until: now + 60000 };
    if (value.count >= limit || budgets.size > 1000) throw new HttpException('Too many attempts', 429);
    value.count++; budgets.set(key, value);
  }
  async function invitedEmail(token: string): Promise<string> {
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) throw new BadRequestException('Invitation unavailable');
    const result = await db.authDb.execute(sql`select gcms_s02.invited_email(${hash(token)}) as email`);
    if (typeof result[0]?.email !== 'string') throw new BadRequestException('Invitation unavailable');
    return result[0].email;
  }

  // Better Auth owns credential hashing, token consumption, session cookies. Transaction support is explicitly enabled for its adapter.
  // https://better-auth.com/docs/adapters/drizzle
  // https://better-auth.com/docs/concepts/session-management
  const auth = betterAuth({
    appName: 'Godent CMS', baseURL: API_ORIGIN, basePath: '/api/auth', secret,
    database: drizzleAdapter(db.authDb, { provider: 'pg', schema: authTables, transaction: true }),
    trustedOrigins: [ADMIN_ORIGIN], logger: { disabled: true }, telemetry: { enabled: false },
    // HTTP signup is disabled. The server-only signup API is guarded by an
    // unconsumed invitation and derives the email from that invitation.
    disabledPaths: ['/sign-up/email'],
    emailAndPassword: { enabled: true, autoSignIn: false, requireEmailVerification: true,
      minPasswordLength: 12, maxPasswordLength: 128, resetPasswordTokenExpiresIn: 1800, revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => { await sendLocalMail({ to: user.email, type: 'password-reset', url }); },
    },
    emailVerification: { sendOnSignUp: true, sendOnSignIn: false, autoSignInAfterVerification: false, expiresIn: 86400,
      sendVerificationEmail: async ({ user, url }) => { await sendLocalMail({ to: user.email, type: 'email-verification', url }); },
    },
    user: { additionalFields: {
      active: { type: 'boolean', defaultValue: true, input: false, returned: false },
      platformAdmin: { type: 'boolean', defaultValue: false, input: false, returned: false },
    } },
    session: { expiresIn: SESSION_SECONDS, disableSessionRefresh: true, freshAge: REAUTH_SECONDS,
      cookieCache: { enabled: false } },
    advanced: { cookiePrefix: 'gcms-s02', useSecureCookies: false, crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: false, path: '/api' } },
    rateLimit: { enabled: true, window: 60, max: 30, storage: 'memory' },
    databaseHooks: {
      session: { create: { before: async session => {
        const result = await db.authDb.execute(sql`select active,email_verified from gcms_s02_auth."user" where id=${session.userId}`);
        if (!result[0]?.active || !result[0]?.email_verified) return false;
        const createdAt = session.createdAt instanceof Date ? session.createdAt : new Date();
        return { data: { ...session, expiresAt: new Date(Math.min(new Date(session.expiresAt).getTime(), createdAt.getTime() + SESSION_SECONDS * 1000)) } };
      } } },
    },
    hooks: { before: createAuthMiddleware(async context => {
      if (context.path === '/sign-up/email') {
        const token = context.headers?.get('x-gcms-invitation');
        if (!token || await invitedEmail(token) !== context.body?.email) throw new APIError('FORBIDDEN', { message: 'Invitation required' });
      }
      if (context.body?.rememberMe === true || context.body?.trustDevice === true || context.body?.method === 'otp') throw new APIError('BAD_REQUEST', { message: 'Unsupported authentication option' });
    }) },
  });

  async function currentSession(headers: Headers): Promise<SessionActor | null> {
    await db.verifyRoles();
    const result = await auth.api.getSession({ headers, query: { disableCookieCache: true, disableRefresh: true } });
    if (!result?.session) return null;
    const rows = await db.authDb.execute(sql`select u.id as "userId",s.id as "sessionId",u.email,u.name,u.email_verified as "emailVerified",
      u.platform_admin as "platformAdmin",
      s.created_at as "sessionCreatedAt",s.expires_at as "sessionExpiresAt"
      from gcms_s02_auth.session s join gcms_s02_auth."user" u on u.id=s.user_id where s.id=${result.session.id}
      and u.active and u.email_verified and s.expires_at>now() and s.created_at<=now() and s.created_at>now()-interval '8 hours'`);
    return (rows[0] as unknown as SessionActor) ?? null;
  }
  function csrfToken(actor: SessionActor): string {
    return createHmac('sha256', secret!).update(`s02-csrf:${actor.userId}:${actor.sessionId}`).digest('base64url');
  }
  function verifyCsrf(headers: Headers, actor: SessionActor): boolean {
    const supplied = headers.get('x-csrf-token') ?? '';
    const expected = csrfToken(actor);
    if (!/^[A-Za-z0-9_-]{43}$/.test(supplied) || supplied.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  }
  async function requireRecent(actor: SessionActor, transaction?: S02Transaction) {
    const verify = async (tx: S02Transaction) => {
      const rows = await tx.execute(sql`select gcms_s02.has_recent_auth() as recent`);
      if (!rows[0]?.recent) throw new ForbiddenException('REAUTH_REQUIRED');
    };
    if (transaction) return verify(transaction);
    return db.withActor(actor, verify);
  }
  async function reauthenticate(headers: Headers, body: { password: string }) {
    const actor = await currentSession(headers);
    if (!actor) throw new UnauthorizedException();
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'password') ||
      typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128 || body.password.includes('\0')) throw new BadRequestException();
    rateLimit(`reauth:${actor.userId}`, 5);
    try { await auth.api.verifyPassword({ headers, body: { password: body.password } }); }
    catch { throw new UnauthorizedException('Reauthentication failed'); }
    // The user and session locks serialize password proof with disable/reset.
    // A grant belongs to this session and never changes its absolute lifetime.
    return db.authDb.transaction(async tx => {
      const users = await tx.execute(sql`select id from gcms_s02_auth."user" where id=${actor.userId} and active and email_verified for share`);
      const sessions = await tx.execute(sql`select id from gcms_s02_auth.session where id=${actor.sessionId} and user_id=${actor.userId}
        and expires_at>clock_timestamp() and created_at<=clock_timestamp() and created_at>clock_timestamp()-interval '8 hours' for update`);
      if (!users.length || !sessions.length) throw new UnauthorizedException();
      const grants = await tx.execute(sql`insert into gcms_s02_auth.reauth_grant(session_id,verified_at,expires_at)
        values(${actor.sessionId},clock_timestamp(),clock_timestamp()+interval '5 minutes')
        on conflict(session_id) do update set verified_at=excluded.verified_at,expires_at=excluded.expires_at returning expires_at as "expiresAt"`);
      return { expiresAt: new Date(String(grants[0].expiresAt)) };
    });
  }
  async function rawHandler(request: Request): Promise<Response> {
    await db.verifyRoles();
    if (!validateAuthRequest(request)) return Response.json({ code: 'FORBIDDEN', message: 'Request denied' }, { status: 403, headers: noStore });
    // The auth handler precedes Express JSON parsing. Bound streamed bodies as
    // well as Content-Length so chunked input cannot bypass the API body limit.
    if (!['GET','HEAD','OPTIONS'].includes(request.method) && request.body) {
      const reader=request.body.getReader(); const chunks: Uint8Array[]=[]; let length=0;
      try {
        for (;;) {
          const item=await reader.read(); if(item.done) break;
          length+=item.value.byteLength;
          if(length>65536) { await reader.cancel(); return Response.json({code:'PAYLOAD_TOO_LARGE'},{status:413,headers:noStore}); }
          chunks.push(item.value);
        }
      } finally { reader.releaseLock(); }
      request=new Request(request,{body:Buffer.concat(chunks)});
    }
    const path = new URL(request.url).pathname.slice('/api/auth'.length);
    if (path === '/invitation-register' && request.method === 'POST') {
      rateLimit('registration', 10);
      let body: { token?: unknown; name?: unknown; password?: unknown };
      try { body = await request.json() as typeof body; } catch { throw new BadRequestException(); }
      if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(key=>!['token','name','password'].includes(key))) throw new BadRequestException();
      if (typeof body.token !== 'string' || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100 || typeof body.password !== 'string') throw new BadRequestException();
      const email = await invitedEmail(body.token);
      await auth.api.signUpEmail({ headers: new Headers({ origin: ADMIN_ORIGIN, 'x-gcms-invitation': body.token }),
        body: { email, name: body.name.trim(), password: body.password, callbackURL: `${ADMIN_ORIGIN}/login`, rememberMe: false } });
      return Response.json({ status: true }, { headers: noStore });
    }
    if (!allowedPaths.has(path) && !/^\/reset-password\/[A-Za-z0-9_-]+$/.test(path)) return Response.json({ code: 'NOT_FOUND' }, { status: 404, headers: noStore });
    const response = await auth.handler(request);
    // Browser clients authenticate with the HttpOnly cookie. Do not duplicate
    // session bearer tokens into script-readable Better Auth response bodies.
    return protectAuthResponse(response);
  }
  async function handler(request: Request): Promise<Response> {
    try { return await rawHandler(request); }
    catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : error instanceof APIError ? error.statusCode : 500;
      return Response.json({ code: status === 429 ? 'RATE_LIMITED' : status >= 500 ? 'UNAVAILABLE' : 'REQUEST_DENIED', message: 'Request could not be completed' }, { status, headers: noStore });
    }
  }
  return { auth, handler, currentSession, csrfToken, verifyCsrf, requireRecent, reauthenticate };
}
export type S02Auth = ReturnType<typeof createS02Auth>;
