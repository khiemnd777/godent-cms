import { expect, test } from 'bun:test';
import { ForbiddenException } from '@nestjs/common';
import { DomainService } from '../src/modules/domain.service';

test('custom mutation rejects an absent or wrong session CSRF token before entering a tenant transaction', async () => {
  let enteredDatabase = false;
  const database = { withTenant() { enteredDatabase = true; throw new Error('Unsafe database entry'); } };
  const identity = { currentSession: async () => ({ userId: 'user', sessionId: 'session' }), verifyCsrf: () => false };
  const service = new DomainService(database as unknown as ConstructorParameters<typeof DomainService>[0],
    identity as unknown as ConstructorParameters<typeof DomainService>[1]);
  await expect(service.createDraft({ method: 'POST', originalUrl: '/api/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/services',
    headers: { host: '127.0.0.1:5890', origin: 'http://127.0.0.1:5891', 'content-type': 'application/json' } },
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { title: 'Private', body: '' })).rejects.toThrow(ForbiddenException);
  expect(enteredDatabase).toBe(false);
});
