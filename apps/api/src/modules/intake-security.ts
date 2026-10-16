import { isIP } from 'node:net';
import { BadRequestException, ForbiddenException, UnsupportedMediaTypeException } from '@nestjs/common';
import { PUBLIC_SITE_ORIGIN } from '../contracts/s03';
import type { RequestHeaders } from './request-security';

export function isPublicIntakeRoute(path: string) {
  return /^\/api\/public\/intake\/builder\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:vi|en)\/(?:service|landing)\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/challenge)?$/.test(path)||/^\/api\/public\/intake\/sites\/[a-z0-9]+(?:-[a-z0-9]+)*\/services\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/challenge)?$/.test(path);
}
export function assertPublicIntakeRequest(headers: RequestHeaders,method:string) {
  if(headers.origin!==PUBLIC_SITE_ORIGIN||headers.cookie!==undefined||headers.authorization!==undefined||!['POST','OPTIONS'].includes(method)) throw new ForbiddenException();
  if(method==='POST'&&(typeof headers['content-type']!=='string'||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(headers['content-type']))) throw new UnsupportedMediaTypeException();
}
export function peerIp(request:{socket:{remoteAddress?:string};headers:RequestHeaders}) {
  const address=request.socket.remoteAddress?.replace(/^::ffff:/,'');
  if(!address||!isIP(address)) throw new BadRequestException();
  return address;
}
