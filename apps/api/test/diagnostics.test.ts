import { describe, expect, test } from 'bun:test';
import { readConfig } from '../src/config';
import { safeError } from '../src/errors';

const valid = {
  DATABASE_URL: 'postgres://technical:secret@127.0.0.1:5888/technical',
  REDIS_URL: 'redis://127.0.0.1:5889', S3_ENDPOINT: 'http://127.0.0.1:5887',
  S3_REGION: 'us-east-1', S3_ACCESS_KEY_ID: 'technical', S3_SECRET_ACCESS_KEY: 'secret',
  BETTER_AUTH_SECRET: 'a'.repeat(48),
};
describe('local technical configuration', () => {
  test('accepts explicit loopback configuration', () => {
    expect(readConfig(valid).databaseUrl).toBe(valid.DATABASE_URL);
  });
  test('rejects missing values without disclosing config values', () => {
    expect(() => readConfig({ ...valid, DATABASE_URL: '' })).toThrow('DATABASE_URL');
    expect(() => readConfig({ ...valid, S3_SECRET_ACCESS_KEY: '' })).toThrow('S3_SECRET_ACCESS_KEY');
  });
  test('rejects remote services and invalid protocols', () => {
    for (const value of ['postgres://a:secret@example.com:5888/db', 'http://127.0.0.1:5888/db', 'invalid-secret-url']) {
      expect(() => readConfig({ ...valid, DATABASE_URL: value })).toThrow('DATABASE_URL');
    }
    expect(() => readConfig({ ...valid, S3_ENDPOINT: 'http://127.0.0.1:5887/secret' })).toThrow('S3_ENDPOINT');
  });
  test('requires a long adapter initialization secret', () => {
    expect(() => readConfig({ ...valid, BETTER_AUTH_SECRET: 'short' })).toThrow('BETTER_AUTH_SECRET');
  });
});
describe('HTTP error redaction', () => {
  test('does not echo arbitrary exception details', () => {
    const error = safeError(new Error('postgres://user:secret@host PRIVATE STACK'));
    expect(error).toEqual({ statusCode: 500, error: 'Internal Server Error' });
    expect(JSON.stringify(error)).not.toContain('secret');
  });
});

import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
test('framework exceptions use fixed status labels and discard sensitive response bodies', () => {
  for (const [exception, statusCode, error] of [
    [new BadRequestException({ message: 'secret-value', stack: 'private' }), 400, 'Bad Request'],
    [new NotFoundException('private-route?secret=abc'), 404, 'Not Found'],
    [new ServiceUnavailableException('postgres://user:password@host/db'), 503, 'Service Unavailable'],
  ] as const) {
    expect(safeError(exception)).toEqual({ statusCode, error });
  }
});
