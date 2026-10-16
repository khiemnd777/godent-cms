import {BadRequestException} from '@nestjs/common';
import {M4_KINDS,M4_LOCALES,type M4SeoEntry} from '../contracts/m4';
import {decodePageCursor,encodePageCursor,parseIdentifier} from './request-security';

function seoKey(after:string):string{
 const parts=after.split(':');
 if(parts.length!==3||!(M4_KINDS as readonly string[]).includes(parts[0])||!(M4_LOCALES as readonly string[]).includes(parts[2]))throw new BadRequestException();
 parseIdentifier(parts[1]);return after;
}
export function encodeM4SeoCursor(tenant:string,entry:Pick<M4SeoEntry,'kind'|'id'|'locale'>):string{
 const after=seoKey(`${entry.kind}:${entry.id}:${entry.locale}`);
 // The generic cursor accepts a single opaque token. Keep its strict grammar
 // and encode the composite SEO key inside that token instead of widening it.
 return encodePageCursor(`${tenant}:m4-seo`,Buffer.from(after,'utf8').toString('base64url'));
}
export function decodeM4SeoCursor(value:unknown,tenant:string):string|null{
 const scope=`${tenant}:m4-seo`,inner=decodePageCursor(value,scope);if(inner===null)return null;
 const after=Buffer.from(inner,'base64url').toString('utf8');
 if(Buffer.from(after,'utf8').toString('base64url')!==inner||encodePageCursor(scope,inner)!==value)throw new BadRequestException();
 return seoKey(after);
}
