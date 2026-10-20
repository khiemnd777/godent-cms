import { describe, expect, it } from 'bun:test';
import { validateDatabaseUrl, validateAuthRequest, isRecent } from '../src/auth/policy';
import { selectRuntimeEnvironment } from '../src/auth/runtime-environment';
import { postgresCode } from '../src/database';
import { protectAuthResponse } from '../src/auth';

describe('S02 trust boundaries', () => {
  it('only accepts the restricted database role at the approved loopback database', () => {
    expect(validateDatabaseUrl('postgresql://gcms_s02_auth:secret@127.0.0.1:5888/gcms_s01', 'gcms_s02_auth')).toContain('gcms_s02_auth');
    for (const url of ['postgres://gcms_local:secret@127.0.0.1:5888/gcms_s01', 'postgres://gcms_s02_auth:secret@localhost:5888/gcms_s01', 'postgres://gcms_s02_auth:secret@127.0.0.1:5432/gcms_s01']) {
      expect(() => validateDatabaseUrl(url, 'gcms_s02_auth')).toThrow();
    }
  });
  it('accepts only the retained loopback or Compose database endpoint in local Docker mode', () => {
    const previous = process.env.GCMS_DOCKER_LOCAL;
    process.env.GCMS_DOCKER_LOCAL = '1';
    try {
      for (const endpoint of ['127.0.0.1:5888', 'postgres:5432']) {
        expect(validateDatabaseUrl(`postgresql://gcms_s02_auth:synthetic@${endpoint}/gcms_s01`, 'gcms_s02_auth')).toContain(endpoint);
      }
      for (const endpoint of ['localhost:5888', 'postgres:5888', 'redis:5432']) {
        expect(() => validateDatabaseUrl(`postgresql://gcms_s02_auth:synthetic@${endpoint}/gcms_s01`, 'gcms_s02_auth')).toThrow();
      }
    } finally {
      if (previous === undefined) delete process.env.GCMS_DOCKER_LOCAL;
      else process.env.GCMS_DOCKER_LOCAL = previous;
    }
  });
  it('rejects public-host cookie forwarding and all untrusted mutation origins', () => {
    expect(validateAuthRequest(new Request('http://127.0.0.1:5890/api/auth/sign-in/email', { method: 'POST', headers: { origin: 'http://127.0.0.1:5891' } }))).toBe(true);
    expect(validateAuthRequest(new Request('http://localhost:5890/api/auth/get-session'))).toBe(false);
    expect(validateAuthRequest(new Request('http://127.0.0.1:5890/api/auth/sign-out', { method: 'POST' }))).toBe(false);
    expect(validateAuthRequest(new Request('http://127.0.0.1:5890/api/auth/sign-out', { method: 'POST', headers: { origin: 'http://localhost:5892' } }))).toBe(false);
  });
  it('expires reauthentication at five minutes and rejects future timestamps', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    expect(isRecent(new Date(now.getTime() - 299999), now)).toBe(true);
    expect(isRecent(new Date(now.getTime() - 300000), now)).toBe(false);
    expect(isRecent(new Date(now.getTime() + 1), now)).toBe(false);
  });
  it('excludes bootstrap credentials from API and all credentials from browser processes', () => {
    const privateConfig = Object.fromEntries(['AUTH','TENANT','PLATFORM','MIGRATION'].map(role =>
      [`S02_${role}_DATABASE_URL`,`postgresql://gcms_s02_${role.toLowerCase()}:synthetic@127.0.0.1:5888/gcms_s01`]));
    const source = { PATH:'/synthetic', POSTGRES_PASSWORD:'bootstrap-secret', DATABASE_URL:'owner-secret',
      REDIS_URL:'redis-secret', S3_ENDPOINT:'endpoint', S3_REGION:'region', S3_ACCESS_KEY_ID:'key', S3_SECRET_ACCESS_KEY:'secret', BETTER_AUTH_SECRET:'auth-secret' };
    const result = selectRuntimeEnvironment(privateConfig, source);
    expect(result.api.POSTGRES_PASSWORD).toBeUndefined();
    expect(result.api.S02_MIGRATION_DATABASE_URL).toBeUndefined();
    expect(result.api.DATABASE_URL).toBe(privateConfig.S02_TENANT_DATABASE_URL);
    expect(Object.keys(result.web).sort()).toEqual(['NEXT_TELEMETRY_DISABLED','PATH']);
  });
  it('extracts server SQLSTATE through Drizzle and Bun error wrappers', () => {
    expect(postgresCode({ cause: { code: 'ERR_POSTGRES_SERVER_ERROR', errno: '23514' } })).toBe('23514');
    expect(postgresCode({ code: '42501' })).toBe('42501');
    expect(postgresCode({ code: 'ERR_CONNECTION_CLOSED' })).toBeUndefined();
  });
  it('preserves empty verification redirects and strips bearer tokens only from JSON objects',async()=>{
    const redirect=await protectAuthResponse(new Response(null,{status:302,headers:{'content-type':'application/json',location:'http://127.0.0.1:5891/login'}}));
    expect(redirect.status).toBe(302);expect(redirect.headers.get('location')).toBe('http://127.0.0.1:5891/login');
    expect(redirect.headers.get('cache-control')).toContain('no-store');
    expect(await (await protectAuthResponse(Response.json(null))).json()).toBeNull();
    const result=await protectAuthResponse(Response.json({token:'synthetic-bearer',session:{token:'synthetic-bearer',id:'synthetic-session'}}));
    expect(await result.json()).toEqual({session:{id:'synthetic-session'}});
  });
});
