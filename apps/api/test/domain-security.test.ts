import { describe, expect, test } from 'bun:test';
import { assertApiHost, assertMutationRequest, decodePageCursor, encodePageCursor, parseCursor, parseIdentifier } from '../src/modules/request-security';
import { apiSecurity, bodyParserError } from '../src/modules/http-security';
import { safeError } from '../src/errors';
import type { IncomingMessage, ServerResponse } from 'node:http';

function httpBoundary(headers: IncomingMessage['headers'], method: string) {
  const result = { statusCode: 200, headers: {} as Record<string, string>, body: '', continued: false };
  const response = { setHeader: (name: string, value: string) => { result.headers[name.toLowerCase()] = value; },
    set statusCode(value: number) { result.statusCode = value; }, end: (value = '') => { result.body = value; } };
  apiSecurity({ headers, method } as IncomingMessage, response as unknown as ServerResponse, () => { result.continued = true; });
  return result;
}

describe('S02 request trust boundary', () => {
  test('accepts only the explicit loopback API Host', () => {
    expect(() => assertApiHost({ host: '127.0.0.1:5890' })).not.toThrow();
    for (const host of [undefined, 'localhost:5890', '127.0.0.1:5891', 'evil.test', '127.0.0.1:5890,evil.test']) {
      expect(() => assertApiHost({ host })).toThrow();
    }
    expect(() => assertApiHost({ host: ['127.0.0.1:5890', 'evil.test'] })).toThrow();
    expect(() => assertApiHost({ host: '127.0.0.1:5890', 'x-forwarded-host': '127.0.0.1:5890' })).toThrow();
  });
  test('rejects missing, null, public and spoofed origins on custom mutations', () => {
    const valid = { origin: 'http://127.0.0.1:5891', 'content-type': 'application/json; charset=utf-8' };
    expect(() => assertMutationRequest(valid)).not.toThrow();
    for (const origin of [undefined, 'null', 'http://localhost:5892', 'http://127.0.0.1:5891.evil.test', 'http://127.0.0.1:5891/']) {
      expect(() => assertMutationRequest({ ...valid, origin })).toThrow();
    }
    for (const contentType of [undefined, 'text/plain', 'application/x-www-form-urlencoded', 'application/jsonp']) {
      expect(() => assertMutationRequest({ ...valid, 'content-type': contentType })).toThrow();
    }
  });
  test('rejects identifiers and cursors that cannot belong to this bounded contract', () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(parseIdentifier(id)).toBe(id);
    expect(parseCursor(undefined)).toBeNull();
    expect(parseCursor(id)).toBe(id);
    for (const value of ['../other', '', 'a'.repeat(200), 'id,other']) {
      expect(() => parseIdentifier(value)).toThrow();
      expect(() => parseCursor(value)).toThrow();
    }
  });
  test('binds pagination to the selected tenant and resource list', () => {
    const cursor = encodePageCursor('tenant-a:services', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(decodePageCursor(cursor, 'tenant-a:services')).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(decodePageCursor(undefined, 'tenant-a:services')).toBeNull();
    expect(() => decodePageCursor(cursor, 'tenant-b:services')).toThrow();
    expect(() => decodePageCursor(cursor, 'tenant-a:members')).toThrow();
    expect(() => decodePageCursor('invalid!base64', 'tenant-a:services')).toThrow();
  });
  test('private responses cannot enter shared caches and CORS permits only the administration origin', () => {
    const headers = { host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891' };
    const allowed = httpBoundary(headers, 'GET');
    expect(allowed.continued).toBe(true);
    expect(allowed.headers['cache-control']).toContain('no-store');
    expect(allowed.headers['x-robots-tag']).toContain('noindex');
    expect(allowed.headers['access-control-allow-origin']).toBe(headers.origin);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const denied = httpBoundary({ ...headers, origin: 'http://localhost:5892' }, 'GET');
    expect(denied.statusCode).toBe(403);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    expect(denied.continued).toBe(false);
  });
  test('preflight validates methods and headers without granting authenticated access', () => {
    const headers = { host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891',
      'access-control-request-method': 'PUT', 'access-control-request-headers': 'content-type, x-csrf-token' };
    expect(httpBoundary(headers, 'OPTIONS').statusCode).toBe(204);
    expect(httpBoundary({ ...headers, 'access-control-request-headers': 'x-forwarded-host' }, 'OPTIONS').statusCode).toBe(403);
    expect(httpBoundary({ ...headers, origin: 'null' }, 'OPTIONS').statusCode).toBe(403);
    expect(httpBoundary({ host: headers.host, 'content-type': 'application/json' }, 'POST').statusCode).toBe(403);
  });
  test('database denials and conflict errors discard SQL, parameters and details', () => {
    expect(safeError({ cause: { code: '23514', message: 'private data', query: 'private SQL' } })).toEqual({ statusCode: 409, error: 'Conflict' });
    expect(safeError({ code: '42501', detail: 'private tenant' })).toEqual({ statusCode: 403, error: 'Forbidden' });
    expect(safeError({ code: '28000' })).toEqual({ statusCode: 401, error: 'Unauthorized' });
    expect(safeError({ code: '40P01' })).toEqual({ statusCode: 409, error: 'Conflict' });
    expect(safeError({ cause: { code: 'ERR_POSTGRES_SERVER_ERROR', errno: '23514', query: 'PRIVATE SQL', params: ['PRIVATE'] } }))
      .toEqual({ statusCode: 409, error: 'Conflict' });
  });
  test('malformed and oversized JSON responses redact the parser body', () => {
    let output = ''; let status = 0;
    const response = { setHeader() {}, set statusCode(value: number) { status = value; }, end(value: string) { output = value; } };
    bodyParserError({ status: 400, body: 'PRIVATE PASSWORD' }, {} as IncomingMessage, response as unknown as ServerResponse, () => {});
    expect(status).toBe(400); expect(output).not.toContain('PRIVATE');
    bodyParserError({ status: 413, body: 'PRIVATE BODY' }, {} as IncomingMessage, response as unknown as ServerResponse, () => {});
    expect(status).toBe(413); expect(output).not.toContain('PRIVATE');
  });
});
