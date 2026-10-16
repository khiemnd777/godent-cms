import { BadRequestException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { MEDIA_LIMITS, type MediaAccessInput, type MediaPermissionInput, type MediaWithdrawalInput, type ServiceMediaReference } from '../contracts/s07';
import { parseIdentifier } from '../modules/request-security';

export function mediaObject(input: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input)!==Object.prototype || Object.keys(input).some(k=>!keys.includes(k))) throw new BadRequestException();
  return input as Record<string, unknown>;
}
export function mediaVersion(input: unknown): number {
  if (!Number.isSafeInteger(input) || Number(input)<1 || Number(input)>=2147483647) throw new BadRequestException();
  return Number(input);
}
function text(input: unknown, max: number) {
  if (typeof input!=='string' || !input.trim() || input.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input)) throw new BadRequestException();
  return input.trim();
}
export function mediaReference(input: unknown): ServiceMediaReference {
  const v=mediaObject(input,['assetId','revision','alt']);
  return {assetId:parseIdentifier(v.assetId),revision:mediaVersion(v.revision),alt:text(v.alt,500)};
}
export function mediaPermission(input: unknown): MediaPermissionInput {
  const v=mediaObject(input,['expectedVersion','operationId','scope','evidenceReference']);
  if (v.scope!=='service_cover') throw new BadRequestException();
  return {expectedVersion:mediaVersion(v.expectedVersion),operationId:parseIdentifier(v.operationId),scope:v.scope,evidenceReference:text(v.evidenceReference,500)};
}
export function mediaWithdrawal(input: unknown): MediaWithdrawalInput {
  const v=mediaObject(input,['expectedVersion','operationId','reason']);
  return {expectedVersion:mediaVersion(v.expectedVersion),operationId:parseIdentifier(v.operationId),reason:text(v.reason,500)};
}
export function mediaAccess(input: unknown): MediaAccessInput {
  const v=mediaObject(input,['revision','variant','purpose']);
  if (!['cover','original'].includes(String(v.variant)) || v.purpose!=='admin_preview') throw new BadRequestException();
  return {revision:mediaVersion(v.revision),variant:v.variant as 'cover'|'original',purpose:v.purpose};
}
export function detectImage(bytes: Uint8Array): 'jpeg'|'png'|'webp' {
  const b=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if (b.length>=3 && b[0]===255 && b[1]===216 && b[2]===255) return 'jpeg';
  if (b.length>=8 && b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))) return 'png';
  if (b.length>=12 && b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP') return 'webp';
  throw new UnsupportedMediaTypeException();
}
export async function boundedUpload(stream: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[]=[]; let received=0;
  for await (const chunk of stream) {
    received+=chunk.byteLength;
    if (received>MEDIA_LIMITS.bytes+MEDIA_LIMITS.multipartOverhead) throw new PayloadTooLargeException();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks,received);
}
