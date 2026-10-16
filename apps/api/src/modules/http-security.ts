import { BadRequestException, ForbiddenException, PayloadTooLargeException } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ADMIN_ORIGIN } from '../contracts/s02';
import { safeError } from '../errors';
import { assertApiHost, assertMutationRequest, isMutation } from './request-security';
import { assertPublicIntakeRequest, isPublicIntakeRoute } from './intake-security';
import { PUBLIC_SITE_ORIGIN } from '../contracts/s03';

export function apiSecurity(request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Vary', 'Origin, Cookie');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  response.setHeader('Referrer-Policy', 'no-referrer');
  try {
    assertApiHost(request.headers);
    const originalUrl=(request as IncomingMessage&{originalUrl?:string}).originalUrl??request.url??'';
    if(isPublicIntakeRoute(originalUrl)) {
      assertPublicIntakeRequest(request.headers,request.method??'');
      response.setHeader('Access-Control-Allow-Origin',PUBLIC_SITE_ORIGIN);
      if(request.method==='OPTIONS') {
        const headers=String(request.headers['access-control-request-headers']??'').toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);
        if(request.headers['access-control-request-method']!=='POST'||headers.some(value=>value!=='content-type')) throw new ForbiddenException();
        response.setHeader('Access-Control-Allow-Methods','POST');response.setHeader('Access-Control-Allow-Headers','Content-Type');
        response.statusCode=204;response.end();return;
      }
      next();return;
    }
    const origin = request.headers.origin;
    if (origin !== undefined && origin !== ADMIN_ORIGIN) throw new ForbiddenException();
    if (origin === ADMIN_ORIGIN) {
      response.setHeader('Access-Control-Allow-Origin', ADMIN_ORIGIN);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    if (request.method === 'OPTIONS') {
      if (origin !== ADMIN_ORIGIN || !['GET', 'HEAD', 'POST', 'PUT', 'DELETE'].includes(String(request.headers['access-control-request-method']))) {
        throw new ForbiddenException();
      }
      const headers = String(request.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
      if (headers.some(value => !['content-type', 'x-csrf-token'].includes(value))) throw new ForbiddenException();
      response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
      response.statusCode = 204; response.end(); return;
    }
    // Better Auth retains its own CSRF checks. This also rejects unsafe missing-Origin requests early.
    if (isMutation(request.method ?? '')) assertMutationRequest(request.headers);
    next();
  } catch (error) {
    const body = safeError(error);
    response.statusCode = body.statusCode;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(body));
  }
}

/** Express JSON errors must use the same redacted contract as Nest controller errors. */
export function bodyParserError(error: unknown, _request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) {
  if (!error) { next(); return; }
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  const body = safeError(status === 413 ? new PayloadTooLargeException() : status === 400 ? new BadRequestException() : error);
  response.statusCode = body.statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}
