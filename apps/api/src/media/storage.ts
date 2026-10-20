import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { MEDIA_LIMITS } from '../contracts/s07';
import type { Readable } from 'node:stream';

export interface MediaStorageConfig { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string }
export function readMediaStorageConfig(env: Record<string,string|undefined>=process.env): MediaStorageConfig {
  const endpoint=new URL(env.S3_ENDPOINT??'');
  if(endpoint.protocol!=='http:' || endpoint.hostname!==(env.GCMS_DOCKER_LOCAL==='1'?'s3':'127.0.0.1') || endpoint.username || endpoint.password || endpoint.pathname!=='/' || endpoint.search || endpoint.hash) throw new Error('Invalid local media storage endpoint');
  const bucket=env.S07_MEDIA_BUCKET??'';
  if(!/^gcms-m2-media-[a-z0-9-]{8,48}$/.test(bucket)) throw new Error('New scoped media bucket required');
  const accessKeyId=env.S07_STORAGE_ACCESS_KEY_ID,secretAccessKey=env.S07_STORAGE_SECRET_ACCESS_KEY,region=env.S3_REGION;
  if(!accessKeyId || !secretAccessKey || !region) throw new Error('Scoped media storage credential required');
  return {endpoint:endpoint.href,region,bucket,accessKeyId,secretAccessKey};
}
export function mediaObjectKey(key: string) {
  if(!/^(?:original\/[a-f0-9-]{36}\/[a-f0-9-]{36}|derivative\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/r[1-9][0-9]*\/f[1-9][0-9]*\/cover\.webp)$/.test(key)) throw new Error('Invalid media object identity');
  return key;
}
export class MediaStorage {
  private readonly client: S3Client;
  constructor(readonly config: MediaStorageConfig) {
    this.client=new S3Client({endpoint:config.endpoint,region:config.region,forcePathStyle:true,maxAttempts:1,
      credentials:{accessKeyId:config.accessKeyId,secretAccessKey:config.secretAccessKey}});
  }
  async put(key: string, body: Uint8Array, type: 'application/octet-stream'|'image/webp') {
    if(!body.byteLength || body.byteLength>MEDIA_LIMITS.bytes) throw new Error('Invalid media object length');
    await this.client.send(new PutObjectCommand({Bucket:this.config.bucket,Key:mediaObjectKey(key),Body:body,ContentLength:body.byteLength,
      ContentType:type,CacheControl:'private, no-store',ACL:'private'}),{abortSignal:AbortSignal.timeout(5000)});
    const head=await this.client.send(new HeadObjectCommand({Bucket:this.config.bucket,Key:key}),{abortSignal:AbortSignal.timeout(5000)});
    if(head.ContentLength!==body.byteLength) throw new Error('Storage write not verified');
  }
  async get(key: string, expectedBytes: number): Promise<Buffer> {
    if(!Number.isSafeInteger(expectedBytes) || expectedBytes<1 || expectedBytes>MEDIA_LIMITS.bytes) throw new Error('Invalid expected media length');
    const response=await this.client.send(new GetObjectCommand({Bucket:this.config.bucket,Key:mediaObjectKey(key)}),{abortSignal:AbortSignal.timeout(5000)});
    const stream=response.Body as Readable|undefined;
    if(response.ContentLength!==expectedBytes || !stream || typeof stream.destroy!=='function') { stream?.destroy?.(); throw new Error('Media object length mismatch'); }
    const chunks: Uint8Array[]=[]; let received=0;
    // SDK's convenience transform allocates the entire body; keep the byte cap at the stream boundary.
    try {
      for await(const value of stream as AsyncIterable<Uint8Array>) {
        received+=value.byteLength; if(received>expectedBytes) throw new Error('Media object overrun'); chunks.push(value);
      }
    } finally { stream.destroy(); }
    if(received!==expectedBytes) throw new Error('Media object truncated');
    return Buffer.concat(chunks,received);
  }
  async deleteVerified(key: string) {
    await this.client.send(new DeleteObjectCommand({Bucket:this.config.bucket,Key:mediaObjectKey(key)}),{abortSignal:AbortSignal.timeout(5000)});
    try { await this.client.send(new HeadObjectCommand({Bucket:this.config.bucket,Key:key}),{abortSignal:AbortSignal.timeout(5000)}); }
    catch(error) {
      if(error && typeof error==='object' && '$metadata' in error && (error.$metadata as {httpStatusCode?:number})?.httpStatusCode===404) return;
      throw error;
    }
    throw new Error('Purge target still exists');
  }
  close() { this.client.destroy(); }
}
