import { describe, expect, it } from 'bun:test';
import { detectImage, mediaPermission, mediaWithdrawal, mediaReference, boundedUpload } from '../src/media/input';
import { MediaSigner } from '../src/media/signing';
import { MEDIA_LIMITS } from '../src/contracts/s07';
import { assertIsolatedMediaWorkerEnvironment } from '../src/worker/media-environment';
import { chmod, lstat, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DecoderSettlementUnknown } from '../src/media/processor';
import { writeMediaRecoveryReceipt } from '../src/worker/media-recovery';

const id = '00000000-0000-4000-8000-000000000001';
describe('S07 media boundaries', () => {
  it('records exact frozen recovery identities privately and never serializes decoder error details', async () => {
    const directory=await mkdtemp(join(tmpdir(),'gcms-s07-recovery-'));
    const nonce='00000000-0000-4000-8000-000000000002',container={id:'a'.repeat(64),name:`gcms-s07-decoder-${nonce}`,nonce};
    const error=new DecoderSettlementUnknown('Must not serialize private details',container);
    const context={tenantId:id,assetId:id,jobId:id,fence:2,workerId:id};
    try {
      const path=await writeMediaRecoveryReceipt(context,error,directory),text=await readFile(path,'utf8'),receipt=JSON.parse(text);
      expect(Object.isFrozen(error.container)).toBe(true);
      expect(receipt).toMatchObject({...context,errorId:error.errorId,state:'native_blocked',container});
      expect(Object.keys(receipt).sort()).toEqual(['assetId','container','errorId','failureCode','fence','jobId','recordedAt','schemaVersion','state','tenantId','workerId']);
      expect(text).not.toContain(error.message);expect((await lstat(path)).mode&0o777).toBe(0o600);
      await expect(writeMediaRecoveryReceipt(context,error,directory)).rejects.toThrow();
      expect(await readFile(path,'utf8')).toBe(text);
      await symlink(directory,join(directory,'alias'));
      await expect(writeMediaRecoveryReceipt(context,new DecoderSettlementUnknown('Control failure',container),join(directory,'alias'))).rejects.toThrow();
      await chmod(directory,0o755);
      await expect(writeMediaRecoveryReceipt(context,new DecoderSettlementUnknown('Control failure',container),directory)).rejects.toThrow();
    } finally {await rm(directory,{recursive:true,force:true});}
  });
  it('accepts scoped worker credentials and rejects ambient credentials before client creation', () => {
    const scoped = {S07_WORKER_DATABASE_URL:'scoped-db',S07_STORAGE_ACCESS_KEY_ID:'scoped-key',S07_STORAGE_SECRET_ACCESS_KEY:'scoped-secret',S07_MEDIA_BUCKET:'scoped-bucket',S07_DECODER_IMAGE:'immutable-image',S3_ENDPOINT:'loopback',S3_REGION:'local'};
    expect(() => assertIsolatedMediaWorkerEnvironment(scoped)).not.toThrow();
    for (const key of ['DATABASE_URL','S02_AUTH_DATABASE_URL','S02_TENANT_DATABASE_URL','S06_WORKER_DATABASE_URL','BETTER_AUTH_SECRET','S04_HMAC_SECRET','S07_MEDIA_SIGNING_SECRET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','AWS_SECURITY_TOKEN','AWS_PROFILE','AWS_SHARED_CREDENTIALS_FILE','AWS_CONFIG_FILE','AWS_WEB_IDENTITY_TOKEN_FILE','AWS_ROLE_ARN','AWS_CONTAINER_CREDENTIALS_FULL_URI','AWS_CONTAINER_CREDENTIALS_RELATIVE_URI']) {
      expect(() => assertIsolatedMediaWorkerEnvironment({...scoped,[key]:'sensitive-value'})).toThrow('Media worker credential isolation required');
      expect(() => assertIsolatedMediaWorkerEnvironment({...scoped,[key]:''})).toThrow('Media worker credential isolation required');
    }
  });
  it('accepts only JPEG PNG WebP signatures and ignores filenames', () => {
    expect(detectImage(Buffer.from('ffd8ffdb', 'hex'))).toBe('jpeg');
    expect(detectImage(Buffer.from('89504e470d0a1a0a', 'hex'))).toBe('png');
    expect(detectImage(Buffer.from('524946460000000057454250', 'hex'))).toBe('webp');
    for (const input of ['<svg/>', '<?xml version="1.0"?><svg/>', 'https://example.test/image.png', 'GIF89a']) expect(() => detectImage(Buffer.from(input))).toThrow();
  });
  it('bounds received bytes before multipart allocation and permits exactly the receive limit', async () => {
    const limit = MEDIA_LIMITS.bytes + MEDIA_LIMITS.multipartOverhead;
    async function* stream(bytes: number) { yield Buffer.alloc(bytes); }
    expect((await boundedUpload(stream(limit))).length).toBe(limit);
    await expect(boundedUpload(stream(limit + 1))).rejects.toThrow();
  });
  it('requires patient material evidence scope and validates withdrawal separately', () => {
    expect(mediaPermission({expectedVersion:1,operationId:id,scope:'service_cover',evidenceReference:'Synthetic permission record 1'}).scope).toBe('service_cover');
    for (const evidenceReference of ['', 'x'.repeat(501), null]) expect(() => mediaPermission({expectedVersion:1,operationId:id,scope:'service_cover',evidenceReference})).toThrow();
    expect(() => mediaPermission({expectedVersion:1,operationId:id,scope:'all',evidenceReference:'Record'})).toThrow();
    expect(mediaWithdrawal({expectedVersion:1,operationId:id,reason:'Withdraw synthetic material'}).reason).toBe('Withdraw synthetic material');
  });
  it('rejects arbitrary URLs, wrong revision and blank alternative text', () => {
    expect(mediaReference({assetId:id,revision:1,alt:'Synthetic blue square'})).toEqual({assetId:id,revision:1,alt:'Synthetic blue square'});
    for (const value of [{assetId:id,revision:0,alt:'A'}, {assetId:id,revision:1,alt:' '}, {assetId:id,revision:1,alt:'A',url:'https://example.test'}]) expect(() => mediaReference(value)).toThrow();
  });
  it('binds a ≤60 second signature to exact tenant asset session purpose revision and variant', () => {
    const signer = new MediaSigner('S'.repeat(48));
    const payload = {tenantId:id,assetId:id,revision:1,variant:'cover' as const,purpose:'admin_preview' as const,userId:'user',sessionId:'session'};
    const issued = signer.issue(payload,100_000);
    expect(signer.verify(issued.token,159_999)).toMatchObject(payload);
    expect(() => signer.verify(issued.token,160_000)).toThrow();
    const [body,mac] = issued.token.split('.');
    expect(() => signer.verify(body.slice(0,-1)+'x.'+mac,100_000)).toThrow();
    expect(() => signer.verify(issued.token+'.suffix',100_000)).toThrow();
  });
});
