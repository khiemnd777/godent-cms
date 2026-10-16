/** Stored ZIP with streamed data descriptors (PKWARE APPNOTE 6.3.10 §4.3).
 * https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
 * ZIP32 has explicit technical bounds; overruns fail the download before a
 * completion manifest/directory. No tenant dataset or archive is buffered.
 */
export interface ZipEntry {name:string;body:AsyncIterable<Uint8Array>}
const table=Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crcUpdate(crc:number,body:Uint8Array){for(const b of body)crc=table[(crc^b)&255]^(crc>>>8);return crc;}
function bound(n:number){if(!Number.isSafeInteger(n)||n<0||n>=0xffffffff)throw new Error('ZIP32 technical size exceeded');return n;}
export async function* streamZip(entries:AsyncIterable<ZipEntry>):AsyncGenerator<Uint8Array>{
 const directory:Buffer[]=[];const names=new Set<string>();let offset=0,directoryBytes=0;
 for await(const entry of entries){
  if(!/^[A-Za-z0-9_/-]+(?:\.[A-Za-z0-9]+)?$/.test(entry.name)||entry.name.startsWith('/')||entry.name.split('/').some(x=>!x||x==='..'||x==='.')||names.has(entry.name)||directory.length>=65534)throw new Error('Invalid ZIP entry');names.add(entry.name);
  const name=Buffer.from(entry.name),start=offset,local=Buffer.alloc(30);bound(offset+30+name.length+16+directoryBytes+46+name.length+22);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0808,6);local.writeUInt16LE(0x0021,12);local.writeUInt16LE(name.length,26);yield local;yield name;offset=bound(offset+local.length+name.length);
  let bytes=0,crc=0xffffffff;
  for await(const chunk of entry.body){bytes=bound(bytes+chunk.byteLength);bound(offset+chunk.byteLength+16+directoryBytes+46+name.length+22);offset=bound(offset+chunk.byteLength);crc=crcUpdate(crc,chunk);yield chunk;}
  crc=(crc^0xffffffff)>>>0;const descriptor=Buffer.alloc(16);descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(crc,4);descriptor.writeUInt32LE(bytes,8);descriptor.writeUInt32LE(bytes,12);yield descriptor;offset=bound(offset+16);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x0808,8);central.writeUInt16LE(0x0021,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(bytes,20);central.writeUInt32LE(bytes,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(start,42);directory.push(Buffer.concat([central,name]));directoryBytes+=central.length+name.length;
 }
 const start=offset;for(const header of directory){yield header;offset=bound(offset+header.length);}const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(directory.length,8);end.writeUInt16LE(directory.length,10);end.writeUInt32LE(offset-start,12);end.writeUInt32LE(start,16);yield end;
}
