import { BadRequestException } from '@nestjs/common';
import { normalizeUserIdentifier } from '../contracts/user-identifier';
import type { DraftInput, ProvisionTenantInput, SaveDraftInput } from '../contracts/s02';
import { parseM5InitialQuotaPolicy } from '../contracts/m5-platform';

function object(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) {
    throw new BadRequestException();
  }
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !keys.includes(key))) throw new BadRequestException();
  return value;
}
function text(value: unknown, minimum: number, maximum: number): string {
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum || value.includes('\0')) {
    throw new BadRequestException();
  }
  return value;
}
export function draftInput(input: unknown): DraftInput {
  const value = object(input, ['title', 'body']);
  const title = text(value.title, 1, 160).trim();
  if (!title) throw new BadRequestException();
  return { title, body: text(value.body, 0, 20000) };
}
export function saveDraftInput(input: unknown): SaveDraftInput {
  const value = object(input, ['title', 'body', 'expectedVersion']);
  if (!Number.isSafeInteger(value.expectedVersion) || Number(value.expectedVersion) < 1 || Number(value.expectedVersion) >= 2147483647) {
    throw new BadRequestException();
  }
  return { ...draftInput({ title: value.title, body: value.body }), expectedVersion: value.expectedVersion as number };
}
export function invitationInput(input: unknown): { email: string } {
  const value = object(input, ['email']);
  const email = text(value.email, 3, 254).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException();
  return { email };
}
export function provisionInput(input: unknown): ProvisionTenantInput {
  const value = object(input, ['name', 'initialAdminEmail', 'initialQuotaPolicy']);
  const name = text(value.name, 1, 160).trim();
  if (!name) throw new BadRequestException();
  let initialQuotaPolicy: ProvisionTenantInput['initialQuotaPolicy'];
  try { initialQuotaPolicy = parseM5InitialQuotaPolicy(value.initialQuotaPolicy); }
  catch { throw new BadRequestException(); }
  return { name, initialAdminEmail: invitationInput({ email: value.initialAdminEmail }).email, initialQuotaPolicy };
}
export function acceptInput(input: unknown): { token: string } {
  const value = object(input, ['token']);
  const token = text(value.token, 43, 128);
  if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new BadRequestException();
  return { token };
}
export function reauthInput(input: unknown): { password: string } {
  const value = object(input, ['password']);
  return { password: text(value.password, 12, 128) };
}
export function emptyInput(input: unknown) { object(input, []); }
export function userIdentifier(value: unknown): string {
  try { return normalizeUserIdentifier(value); }
  catch { throw new BadRequestException(); }
}
