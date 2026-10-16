import { describe, expect, test } from 'bun:test';
import { mkdtemp, readdir, readFile, stat, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LocalLeadCapture } from '../src/worker/local-capture';

describe('S05 private idempotent local capture', () => {
  test('concurrent retries create one private generic capture per delivery', async () => {
    const parent = await mkdtemp('/private/tmp/gcms-s05-capture-'), directory = join(parent, 'capture'), id = randomUUID();
    const capture = new LocalLeadCapture(directory), message = { deliveryId: id, recipientEmail: 'admin@example.invalid', transport: 'local_capture' as const, signInUrl: 'http://127.0.0.1:5891/login' };
    await Promise.all(Array.from({ length: 8 }, () => capture.capture(message)));
    expect(await readdir(directory)).toEqual([`${id}.json`]);
    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(join(directory, `${id}.json`))).mode & 0o777).toBe(0o600);
    const receipt = await readFile(join(directory, `${id}.json`), 'utf8');
    expect(JSON.parse(receipt)).toMatchObject({ deliveryId: id, recipientEmail: message.recipientEmail, signInUrl: message.signInUrl });
    expect(receipt).not.toMatch(/customer|phone|message|leadId|token|password/i);
    await expect(capture.capture({ ...message, signInUrl: 'http://evil.invalid/sign-in' })).rejects.toThrow();
    await expect(capture.capture({ ...message, signInUrl: 'http://127.0.0.1:5891/sign-in' })).rejects.toThrow();
  });
  test('symlink directory and changed payload fail closed without replacing existing data', async () => {
    const parent = await mkdtemp('/private/tmp/gcms-s05-capture-'), directory = join(parent, 'capture'), alias = join(parent, 'alias'), id = randomUUID();
    const capture = new LocalLeadCapture(directory), message = { deliveryId: id, recipientEmail: 'admin@example.invalid', transport: 'local_capture' as const, signInUrl: 'http://127.0.0.1:5891/login' };
    await capture.capture(message); await symlink(directory, alias);
    await expect(new LocalLeadCapture(alias).capture(message)).rejects.toThrow();
    await expect(capture.capture({ ...message, recipientEmail: 'changed@example.invalid' })).rejects.toThrow();
    expect(JSON.parse(await readFile(join(directory, `${id}.json`), 'utf8')).recipientEmail).toBe(message.recipientEmail);
  });
});
