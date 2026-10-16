import { createHmac, timingSafeEqual } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { MEDIA_LIMITS } from '../contracts/s07';
export interface MediaAccessClaims { tenantId: string; assetId: string; revision: number; variant: 'cover'|'original'; purpose: 'admin_preview'; userId: string; sessionId: string }
export class MediaSigner {
  constructor(private readonly secret: string) { if(secret.length<32) throw new Error('Media signing key required'); }
  issue(claims: MediaAccessClaims, now=Date.now()) {
    const expiry=now+MEDIA_LIMITS.signedSeconds*1000;
    const body=Buffer.from(JSON.stringify({...claims,issuedAt:now,expiry})).toString('base64url');
    return {token:body+'.'+this.mac(body).toString('base64url'),expiresAt:new Date(expiry).toISOString()};
  }
  verify(token: unknown, now=Date.now()): MediaAccessClaims {
    try {
      if(typeof token!=='string' || token.length>2000 || !/^[\w-]+\.[\w-]+$/.test(token)) throw new Error();
      const [body,sig]=token.split('.'), expected=this.mac(body), actual=Buffer.from(sig,'base64url');
      if(actual.length!==expected.length || !timingSafeEqual(expected,actual)) throw new Error();
      const v=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
      if(v.purpose!=='admin_preview' || !['cover','original'].includes(v.variant) || !Number.isSafeInteger(v.revision) || v.revision<1 || !Number.isSafeInteger(v.issuedAt) || !Number.isSafeInteger(v.expiry) || v.expiry<=now || v.issuedAt>now || v.expiry-v.issuedAt>60_000 || v.expiry<=v.issuedAt) throw new Error();
      for(const field of ['tenantId','assetId','userId','sessionId']) if(typeof v[field]!=='string'||!v[field]||v[field].length>128) throw new Error();
      return v as MediaAccessClaims;
    } catch {throw new ForbiddenException();}
  }
  private mac(body: string) { return createHmac('sha256',this.secret).update('gcms-s07-media-v1\0').update(body).digest(); }
}
