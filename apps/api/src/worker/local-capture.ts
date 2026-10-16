import { constants } from 'node:fs';
import { link, lstat, mkdir, open, readFile, realpath, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface LeadCaptureMessage { deliveryId: string; recipientEmail: string; transport: 'local_capture'; signInUrl: string }
export interface LeadCaptureTransport { capture(message: LeadCaptureMessage, signal?: AbortSignal): Promise<void> }
export class PermanentCaptureFailure extends Error {}
export const SIGN_IN_URL = 'http://127.0.0.1:5891/login';

/** A capture is a local technical receipt, never proof that an external email was delivered. */
export class LocalLeadCapture implements LeadCaptureTransport {
  constructor(private readonly directory = resolve('.local/s05-mail')) {}
  async capture(message: LeadCaptureMessage, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(message.deliveryId) ||
      message.signInUrl !== SIGN_IN_URL || message.transport !== 'local_capture' || !/^[^\s@\r\n]{1,64}@[^\s@\r\n]{1,189}$/.test(message.recipientEmail) ||
      Object.keys(message).sort().join(',') !== 'deliveryId,recipientEmail,signInUrl,transport') throw new PermanentCaptureFailure('Invalid local capture');
    await mkdir(this.directory, { mode: 0o700, recursive: true });
    const directory = await lstat(this.directory);
    if (!directory.isDirectory() || directory.isSymbolicLink() || (directory.mode & 0o777) !== 0o700 || await realpath(this.directory) !== resolve(this.directory)) throw new PermanentCaptureFailure('Unsafe local capture directory');
    const body = JSON.stringify({ deliveryId: message.deliveryId, recipientEmail: message.recipientEmail,
      subject: 'Có yêu cầu tư vấn mới', text: 'Đăng nhập CMS để xem yêu cầu tư vấn mới.', signInUrl: SIGN_IN_URL, transport: 'local_capture' }) + '\n';
    const path = join(this.directory, `${message.deliveryId}.json`), temporary = join(this.directory, `.${message.deliveryId}.${randomUUID()}.tmp`);
    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(body, 'utf8'); await handle.sync(); } finally { await handle.close(); }
    try {
      try { await link(temporary, path); }
      catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') throw error;
        const existing = await lstat(path);
        if (!existing.isFile() || existing.isSymbolicLink() || (existing.mode & 0o777) !== 0o600 || await readFile(path, 'utf8') !== body) throw new PermanentCaptureFailure('Existing capture conflict');
      }
      const directoryHandle = await open(this.directory, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    } finally {
      // This exact temporary path was exclusively created by this invocation.
      await unlink(temporary);
    }
  }
}
