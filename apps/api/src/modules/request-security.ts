import { BadRequestException, ForbiddenException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ADMIN_ORIGIN, API_HOST } from '../contracts/s02';

export type RequestHeaders = Record<string, string | string[] | undefined>;
export interface PrivateRequest { headers: RequestHeaders; method: string; originalUrl: string }

export function assertApiHost(headers: RequestHeaders) {
  if (headers.host !== API_HOST || headers['x-forwarded-host'] !== undefined || headers.forwarded !== undefined) throw new BadRequestException();
}
export function assertMutationRequest(headers: RequestHeaders) {
  if (headers.origin !== ADMIN_ORIGIN) throw new ForbiddenException();
  const contentType = headers['content-type'];
  if (typeof contentType !== 'string' || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
    throw new UnsupportedMediaTypeException();
  }
}
export function isMutation(method: string) { return !['GET', 'HEAD', 'OPTIONS'].includes(method); }

export function parseIdentifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)) {
    throw new BadRequestException();
  }
  return value;
}
export function parseCursor(value: unknown): string | null {
  return value === undefined ? null : parseIdentifier(value);
}
export function encodePageCursor(scope: string, after: string): string {
  return Buffer.from(JSON.stringify({ scope, after })).toString('base64url');
}
export function decodePageCursor(value: unknown, scope: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 600 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new BadRequestException();
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (decoded.scope !== scope || typeof decoded.after !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(decoded.after) ||
        Object.keys(decoded).sort().join(',') !== 'after,scope') throw new Error();
    return decoded.after;
  } catch { throw new BadRequestException(); }
}
export function nodeHeaders(headers: RequestHeaders): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') result.set(key, value);
    else if (Array.isArray(value)) for (const item of value) result.append(key, item);
  }
  return result;
}
