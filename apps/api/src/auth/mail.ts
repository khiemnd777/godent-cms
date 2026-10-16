import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ADMIN_ORIGIN, API_ORIGIN } from './policy';

export interface LocalMail { to: string; type: string; url: string }
export async function sendLocalMail(message: LocalMail) {
  const url = new URL(message.url);
  if (![ADMIN_ORIGIN, API_ORIGIN].includes(url.origin)) throw new Error('Invalid local mail link');
  const directory = resolve(process.cwd(), '.local/s02-mail');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await writeFile(resolve(directory, `${Date.now()}-${crypto.randomUUID()}.json`),
    JSON.stringify({ ...message, createdAt: new Date().toISOString() }) + '\n', { flag: 'wx', mode: 0o600 });
}
