import { constants } from 'node:fs';
import { link, lstat, mkdir, open, readFile, realpath, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PermanentCaptureFailure, SIGN_IN_URL, type LeadCaptureMessage, type LeadCaptureTransport } from './local-capture';

/** Separate retention channel. The generic message contains no client or lead identifier. */
export class RetentionCapture implements LeadCaptureTransport {
  constructor(private readonly directory = resolve('.local/m2-retention-mail')) {}
  async capture(message: LeadCaptureMessage, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(message.deliveryId) || message.signInUrl !== SIGN_IN_URL ||
      message.transport !== 'local_capture' || !/^[^\s@\r\n]{1,64}@[^\s@\r\n]{1,189}$/.test(message.recipientEmail) ||
      Object.keys(message).sort().join(',') !== 'deliveryId,recipientEmail,signInUrl,transport') throw new PermanentCaptureFailure('Invalid retention capture');
    await mkdir(this.directory, { mode: 0o700, recursive: true });
    const directory = await lstat(this.directory);
    if (!directory.isDirectory() || directory.isSymbolicLink() || (directory.mode & 0o777) !== 0o700 || await realpath(this.directory) !== resolve(this.directory)) throw new PermanentCaptureFailure('Unsafe retention capture directory');
    const body = JSON.stringify({ ...message, subject: 'Yêu cầu tư vấn sắp hết thời hạn lưu trữ', text: 'Đăng nhập CMS để kiểm tra thời hạn lưu trữ yêu cầu tư vấn.' }) + '\n';
    const path = join(this.directory, `${message.deliveryId}.json`), temporary = join(this.directory, `.${message.deliveryId}.${randomUUID()}.tmp`);
    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(body, 'utf8'); await handle.sync(); } finally { await handle.close(); }
    try {
      try { await link(temporary, path); }
      catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') throw error;
        const existing = await lstat(path);
        if (!existing.isFile() || existing.isSymbolicLink() || (existing.mode & 0o777) !== 0o600 || await readFile(path, 'utf8') !== body) throw new PermanentCaptureFailure('Existing retention capture conflict');
      }
      const parent = await open(this.directory, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { await parent.sync(); } finally { await parent.close(); }
    } finally { await unlink(temporary); }
  }
}
