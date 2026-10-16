import { expect, test } from 'bun:test';
import { acceptInput, draftInput, invitationInput, provisionInput, reauthInput, saveDraftInput } from '../src/modules/input';

test('draft boundary accepts plain VI text and refuses publication or tenant substitution', () => {
  expect(draftInput({ title: '  Khám răng  ', body: '<script>plain text, never interpreted</script>' }))
    .toEqual({ title: 'Khám răng', body: '<script>plain text, never interpreted</script>' });
  for (const input of [{ title: ' ', body: '' }, { title: 'x', body: '', tenantId: 'other' }, { title: 'x', body: '', published: true },
    { title: 'x', body: '', locale: 'en' }, { title: 'x', body: 'x'.repeat(20001) }]) {
    expect(() => draftInput(input)).toThrow();
  }
});
test('save requires an explicit bounded expected version', () => {
  expect(saveDraftInput({ title: 'x', body: '', expectedVersion: 1 }).expectedVersion).toBe(1);
  for (const version of [undefined, '1', 0, -1, 1.5, 2147483647]) {
    expect(() => saveDraftInput({ title: 'x', body: '', expectedVersion: version })).toThrow();
  }
});
test('invitations fix the email and cannot add a tenant or platform role', () => {
  expect(invitationInput({ email: 'Admin@Example.test' })).toEqual({ email: 'admin@example.test' });
  expect(() => invitationInput({ email: 'a@example.test', role: 'platform_admin' })).toThrow();
  expect(() => invitationInput({ email: 'a@example.test', tenantId: 'other' })).toThrow();
  expect(() => acceptInput({ token: 'x'.repeat(43), email: 'other@example.test' })).toThrow();
  expect(provisionInput({ name: 'Test Dental', initialAdminEmail: 'a@example.test', initialQuotaPolicy: { mode: 'monitor', contentItemsLimit: null, mediaBytesLimit: null } }).name).toBe('Test Dental');
  expect(() => provisionInput({ name: 'Test', initialAdminEmail: 'a@example.test', slug: 'public' })).toThrow();
});
test('new tenant handoff requires an explicit monitor or enforced quota policy', () => {
  const input = { name: 'Synthetic M5', initialAdminEmail: 'a@example.test' };
  expect(() => provisionInput(input)).toThrow();
  for (const policy of [undefined, { mode: 'unset', contentItemsLimit: null, mediaBytesLimit: null },
    { mode: 'enforced', contentItemsLimit: null, mediaBytesLimit: null },
    { mode: 'enforced', contentItemsLimit: -1, mediaBytesLimit: null },
    { mode: 'monitor', contentItemsLimit: null, mediaBytesLimit: null, default: true }]) {
    expect(() => provisionInput({ ...input, initialQuotaPolicy: policy })).toThrow();
  }
  expect(provisionInput({ ...input, initialQuotaPolicy: { mode: 'enforced', contentItemsLimit: 0, mediaBytesLimit: null } }).initialQuotaPolicy.contentItemsLimit).toBe(0);
});
test('reauthentication accepts only a bounded password and rejects obsolete factor fields', () => {
  expect(reauthInput({ password: 'local-password' })).toEqual({ password: 'local-password' });
  for (const input of [{ password: 'local-password', code: '123456' },
    { password: 'local-password', backupCode: 'backup' }, { password: 'local-password', rememberMe: true },
    { password: 'x'.repeat(11) }, { password: 'x'.repeat(129) }, { password: '' }]) {
    expect(() => reauthInput(input)).toThrow();
  }
});
