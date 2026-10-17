import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
import {exactObject} from '../contracts/content';
import {M4_KINDS} from '../contracts/m4';
import {m3Id} from '../contracts/m3-validation';
const prefix='s2_',purpose='gcms:m4:search-cursor:v2';
function key(secret:unknown):Buffer {if(typeof secret!=='string'||!/^[a-f0-9]{64}$/.test(secret))throw new Error('Private search runtime required');return createHmac('sha256',Buffer.from(secret,'hex')).update(purpose+':key').digest();}
function checkpoint(value:unknown):string {if(typeof value!=='string'||value.length>64)throw new TypeError('Invalid search checkpoint');const parts=value.split(':');if(parts.length!==2||!(M4_KINDS as readonly string[]).includes(parts[0]))throw new TypeError('Invalid search checkpoint');m3Id(parts[1]);return value;}
function aad(scope:string):Buffer {if(typeof scope!=='string'||!/^m4-search:[a-f0-9]{64}$/.test(scope))throw new TypeError('Invalid search context');return Buffer.from(purpose+':'+scope,'utf8');}
/** Standard AES-GCM keeps even an ineligible raw checkpoint private; SQL still authorizes every result.
 * Node crypto: https://nodejs.org/api/crypto.html#cryptocreatecipherivalgorithm-key-iv-options
 * A fresh IV and authenticated full search context prevent substitution and cross-query replay.
 */
export function encodeBuilderSearchCursor(scope:string,after:string,secret:unknown=process.env.S04_HMAC_SECRET):string {
 const plaintext=Buffer.from(JSON.stringify({version:2,after:checkpoint(after)}),'utf8'),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),iv,{authTagLength:16});cipher.setAAD(aad(scope));
 const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);return prefix+Buffer.concat([iv,ciphertext,cipher.getAuthTag()]).toString('base64url');
}
export function decodeBuilderSearchCursor(value:unknown,scope:string,secret:unknown=process.env.S04_HMAC_SECRET):string|null {
 if(value===undefined)return null;
 if(typeof value!=='string'||value.length<64||value.length>512||!/^s2_[A-Za-z0-9_-]+$/.test(value))throw new TypeError('Invalid search cursor');
 const encoded=value.slice(prefix.length),bytes=Buffer.from(encoded,'base64url');if(bytes.toString('base64url')!==encoded||bytes.length<29||bytes.length>284)throw new TypeError('Invalid search cursor');
 const decipher=createDecipheriv('aes-256-gcm',key(secret),bytes.subarray(0,12),{authTagLength:16});decipher.setAAD(aad(scope));decipher.setAuthTag(bytes.subarray(-16));
 const plaintext=Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]);if(plaintext.length>256)throw new TypeError('Invalid search cursor');
 const decoded=exactObject(JSON.parse(plaintext.toString('utf8')),['version','after']);if(Object.keys(decoded).length!==2||decoded.version!==2)throw new TypeError('Invalid search cursor');return checkpoint(decoded.after);
}
