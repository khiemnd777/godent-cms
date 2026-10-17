import {createHash} from 'node:crypto';
import {boundedText,exactObject} from '../contracts/content';
import {M4_KINDS,type M4Kind,type M4Locale,type M4PublicSearch} from '../contracts/m4';
import {m3QueryObject} from '../contracts/m3-validation';
import {decodeBuilderSearchCursor,encodeBuilderSearchCursor} from './builder-search-cursor';
/** Cursor is a navigation hint bound to the entire search context; SQL still scopes tenant and eligibility. */
export function parseBuilderSearch(query:Record<string,unknown>,tenant:string,locale:M4Locale,secret:unknown=process.env.S04_HMAC_SECRET) {
 const v=exactObject(m3QueryObject(query),['q','kind','cursor','pageSize']);
 const q=boundedText(v.q,160,true).normalize('NFC').trim().toLowerCase();if(q.length<2)throw new TypeError('Search needs two characters');
 let kind:M4Kind|null=null;if(v.kind!==undefined){if(!(M4_KINDS as readonly unknown[]).includes(v.kind))throw new TypeError('Invalid search family');kind=v.kind as M4Kind;}
 let size=10;if(v.pageSize!==undefined){if(typeof v.pageSize!=='string'||!/^[1-9][0-9]?$/.test(v.pageSize)||Number(v.pageSize)>20)throw new TypeError('Invalid page size');size=Number(v.pageSize);}
 const key='m4-search:'+createHash('sha256').update(JSON.stringify({tenant,locale,q,kind,size})).digest('hex'),after=decodeBuilderSearchCursor(v.cursor,key,secret);
 return {q,kind,size,key,after};
}

export type BuilderSearchWindow=Omit<M4PublicSearch,'nextCursor'>&{resumeAfter:string|null};
/** Whitelist the public shape: no raw checkpoint, work counters or other internal SQL fields escape. */
export function finishBuilderSearch(value:BuilderSearchWindow,query:ReturnType<typeof parseBuilderSearch>,secret:unknown=process.env.S04_HMAC_SECRET):M4PublicSearch {
 if(value.items.length>query.size)throw new TypeError('Invalid search result limit');
 return {schemaVersion:4,locale:value.locale,query:value.query,items:value.items,config:value.config,nextCursor:value.resumeAfter===null?null:encodeBuilderSearchCursor(query.key,value.resumeAfter,secret)};
}
