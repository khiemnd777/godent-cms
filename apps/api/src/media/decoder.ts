/** Runs only inside the isolated decoder image; stdin/stdout are the complete interface. */
import sharp from 'sharp';
import { MEDIA_LIMITS } from '../contracts/s07';
import { detectImage } from './input';

export class InvalidImage extends Error {}
export async function decodeImage(input: Uint8Array) {
  if(!input.byteLength || input.byteLength>MEDIA_LIMITS.bytes) throw new InvalidImage('bytes');
  let type: 'jpeg'|'png'|'webp';
  try { type=detectImage(input); } catch { throw new InvalidImage('format'); }
  const buffer=Buffer.from(input);
  if(type==='jpeg') {
    let offset=2;
    while(offset+4<=buffer.length) {
      if(buffer[offset++]!==255) throw new InvalidImage('jpeg_marker');
      while(buffer[offset]===255) offset++;
      const marker=buffer[offset++];
      if(marker===0xda) break;
      if(marker===0x01) continue;
      const length=buffer.readUInt16BE(offset);
      if(length<2 || length>buffer.length-offset) throw new InvalidImage('truncated');
      if(marker===0xe2 && buffer.toString('ascii',offset+2,offset+6)==='MPF\0') throw new InvalidImage('multipage');
      offset+=length;
    }
  }
  // Reject APNG and animated WebP before decoding. Sharp pages metadata is checked as well.
  if(type==='png') {
    let offset=8,ended=false;
    while(offset+12<=buffer.length) {
      const length=buffer.readUInt32BE(offset), chunk=buffer.toString('ascii',offset+4,offset+8);
      if(length>buffer.length-offset-12) throw new InvalidImage('truncated');
      if(chunk==='acTL' || chunk==='fcTL' || chunk==='fdAT') throw new InvalidImage('animation');
      offset+=12+length; if(chunk==='IEND') {ended=true;break;}
    }
    if(!ended || offset!==buffer.length) throw new InvalidImage('truncated');
  }
  if(type==='webp') {
    if(buffer.readUInt32LE(4)+8!==buffer.length) throw new InvalidImage('truncated');
    let offset=12;
    while(offset+8<=buffer.length) {
      const chunk=buffer.toString('ascii',offset,offset+4), length=buffer.readUInt32LE(offset+4);
      if(length>buffer.length-offset-8) throw new InvalidImage('truncated');
      if(chunk==='ANIM' || chunk==='ANMF' || (chunk==='VP8X' && (buffer[offset+8]&2)!==0)) throw new InvalidImage('animation');
      offset+=8+length+(length%2);
    }
    if(offset!==buffer.length) throw new InvalidImage('truncated');
  }
  sharp.cache(false); sharp.concurrency(1);
  // Source: https://sharp.pixelplumbing.com/api-constructor/
  const options={failOn:'warning' as const,limitInputPixels:MEDIA_LIMITS.pixels,unlimited:false,sequentialRead:true};
  try {
    const metadata=await sharp(buffer,options).metadata();
    if(metadata.format!==type || !metadata.width || !metadata.height || metadata.width>MEDIA_LIMITS.edge || metadata.height>MEDIA_LIMITS.edge || metadata.width*metadata.height>MEDIA_LIMITS.pixels || (metadata.pages??1)!==1) throw new InvalidImage('dimensions');
    // Force the complete input through the decoder before resizing. Orientation applies once.
    const raw=await sharp(buffer,options).autoOrient().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
    const encoded=await sharp(raw.data,{raw:{width:raw.info.width,height:raw.info.height,channels:raw.info.channels},limitInputPixels:MEDIA_LIMITS.pixels})
      .resize({width:MEDIA_LIMITS.derivativeEdge,height:MEDIA_LIMITS.derivativeEdge,fit:'inside',withoutEnlargement:true})
      .webp({quality:82,effort:4}).toBuffer({resolveWithObject:true});
    // Fresh raw input carries no EXIF, GPS, XMP, comments or embedded profiles.
    if(encoded.data.byteLength>MEDIA_LIMITS.bytes) throw new InvalidImage('output');
    return {detectedType:type,sourceWidth:metadata.width,sourceHeight:metadata.height,width:encoded.info.width,height:encoded.info.height,
      bytes:encoded.data.byteLength,body:encoded.data.toString('base64')};
  } catch(error) { if(error instanceof InvalidImage) throw error; throw new InvalidImage('decode'); }
}
async function decoderMain() {
  try {
    const chunks: Uint8Array[]=[]; let length=0;
    for await(const chunk of Bun.stdin.stream()) {length+=chunk.byteLength;if(length>MEDIA_LIMITS.bytes) throw new InvalidImage('bytes');chunks.push(chunk);}
    const result=await decodeImage(Buffer.concat(chunks,length));
    process.stdout.write(JSON.stringify({outcome:'success',...result}));
  } catch(error) { process.stdout.write(JSON.stringify({outcome:'rejected',code:error instanceof InvalidImage?error.message:'processor'})); process.exitCode=2; }
}
if(process.env.S07_DECODER_ENTRY==='1') void decoderMain();
