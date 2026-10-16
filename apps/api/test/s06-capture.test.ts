import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, lstat, readFile, readdir, chmod, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { RetentionCapture } from '../src/worker/retention-capture';
import { SIGN_IN_URL } from '../src/worker/local-capture';
describe('S06 private local retention capture', () => {
  test('captures once with private permissions and generic content', async () => {
    const directory = await mkdtemp('/private/tmp/gcms-s06-capture-'), path = join(directory, 'capture'), capture = new RetentionCapture(path);
    const message = { deliveryId: randomUUID(), recipientEmail: 'admin@example.invalid', signInUrl: SIGN_IN_URL, transport: 'local_capture' as const };
    await capture.capture(message); await capture.capture(message);
    expect(await readdir(path)).toEqual([`${message.deliveryId}.json`]);
    expect((await lstat(path)).mode & 0o777).toBe(0o700);
    const target = join(path, `${message.deliveryId}.json`);
    expect((await lstat(target)).mode & 0o777).toBe(0o600);
    const value = JSON.parse(await readFile(target, 'utf8'));
    expect(Object.keys(value).sort()).toEqual(['deliveryId', 'recipientEmail', 'signInUrl', 'subject', 'text', 'transport']);
    expect(value.subject).toBe('Yêu cầu tư vấn sắp hết thời hạn lưu trữ');
  });
  test('rejects a substituted recipient, unsafe directory and symlink', async () => {
    const directory = await mkdtemp('/private/tmp/gcms-s06-denied-'), path = join(directory, 'capture'), capture = new RetentionCapture(path);
    const message = { deliveryId: randomUUID(), recipientEmail: 'admin@example.invalid', signInUrl: SIGN_IN_URL, transport: 'local_capture' as const };
    await capture.capture(message);
    await expect(capture.capture({ ...message, recipientEmail: 'changed@example.invalid' })).rejects.toThrow('conflict');
    await chmod(path, 0o755); await expect(capture.capture({ ...message, deliveryId: randomUUID() })).rejects.toThrow('Unsafe');
    const linked = join(directory, 'linked'); await symlink(path, linked);
    await expect(new RetentionCapture(linked).capture(message)).rejects.toThrow('Unsafe');
    await expect(capture.capture({ ...message, signInUrl: 'https://external.invalid' })).rejects.toThrow('Invalid');
  });
});
