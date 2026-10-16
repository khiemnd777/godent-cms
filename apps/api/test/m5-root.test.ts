import { expect, test } from 'bun:test';
import { ForbiddenException, HttpException } from '@nestjs/common';
import { safeError } from '../src/errors';

test('quota failure exposes only bounded public admission facts', () => {
  const failure = { cause: { errno: 'P5501', detail: JSON.stringify({ code: 'QUOTA_EXCEEDED', dimension: 'content_items', usage: 4, limit: 4, private: 'never-public' }), query: 'private SQL' } };
  expect(safeError(failure)).toEqual({ statusCode: 409, error: 'Conflict', code: 'QUOTA_EXCEEDED', dimension: 'content_items', usage: 4, limit: 4 });
  expect(safeError({ code: 'P5501', detail: '{"dimension":"private SQL","usage":-1}' })).toEqual({ statusCode: 409, error: 'Conflict', code: 'QUOTA_EXCEEDED' });
});

test('M5 command failures and recent-auth requirements retain known codes without messages', () => {
  expect(safeError(new HttpException({ code: 'EXECUTE_AFTER', message: 'private request details' }, 409))).toEqual({ statusCode: 409, error: 'Conflict', code: 'EXECUTE_AFTER' });
  expect(safeError(new ForbiddenException('REAUTH_REQUIRED'))).toEqual({ statusCode: 403, error: 'Forbidden', code: 'REAUTH_REQUIRED' });
  expect(safeError(new HttpException({ code: 'private-secret', message: 'private' }, 409))).toEqual({ statusCode: 409, error: 'Conflict' });
});
