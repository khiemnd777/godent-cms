import { describe, expect, it } from 'bun:test';
import sharp from 'sharp';
import { decodeImage, InvalidImage } from '../src/media/decoder';
import { MEDIA_LIMITS } from '../src/contracts/s07';

async function fixture(type:'jpeg'|'png'|'webp') {
  return sharp({create:{width:12,height:8,channels:3,background:'#3777aa'}})[type]().toBuffer();
}
describe('S07 complete native image decode and clean derivative',()=>{
  for(const type of ['jpeg','png','webp'] as const) it(`fully decodes ${type} and creates a fixed private WebP derivative`,async()=>{
    const decoded=await decodeImage(await fixture(type));
    expect(decoded.detectedType).toBe(type);expect(decoded.width).toBe(12);expect(decoded.height).toBe(8);
    const metadata=await sharp(Buffer.from(decoded.body,'base64')).metadata();expect(metadata.format).toBe('webp');
    expect(metadata.exif).toBeUndefined();expect(metadata.xmp).toBeUndefined();expect(metadata.icc).toBeUndefined();
  });
  it('applies orientation once and strips EXIF/GPS/private description',async()=>{
    const original=await sharp({create:{width:12,height:8,channels:3,background:'#3777aa'}})
      .withMetadata({orientation:6}).withExif({IFD0:{ImageDescription:'S07_PRIVATE_METADATA'},IFD3:{GPSLatitudeRef:'N',GPSLatitude:'10/1 0/1 0/1'}}).jpeg().toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const decoded=await decodeImage(original),out=Buffer.from(decoded.body,'base64'),metadata=await sharp(out).metadata();
    expect(decoded.width).toBe(8);expect(decoded.height).toBe(12);expect(metadata.orientation).toBeUndefined();expect(metadata.exif).toBeUndefined();
    expect(out.includes(Buffer.from('S07_PRIVATE_METADATA'))).toBe(false);
  });
  it('rejects truncated, malformed and unsupported content without ready output',async()=>{
    const png=await fixture('png');
    for(const input of [png.subarray(0,png.length-20),Buffer.from('ffd8ffdb','hex'),Buffer.from('<svg/>'),Buffer.alloc(5*1024*1024+1)]) await expect(decodeImage(input)).rejects.toBeInstanceOf(InvalidImage);
  });
  it('accepts a valid PNG at exactly five MiB and rejects one byte more',async()=>{
    const png=await fixture('png'),length=MEDIA_LIMITS.bytes-png.length-12,chunk=Buffer.alloc(length+12,65);
    chunk.writeUInt32BE(length,0);chunk.write('tEXt',4);chunk.write('Note\0',8);
    let crc=0xffffffff;
    for(const byte of chunk.subarray(4,-4)) {crc^=byte;for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    chunk.writeUInt32BE((crc^0xffffffff)>>>0,chunk.length-4);
    const input=Buffer.concat([png.subarray(0,-12),chunk,png.subarray(-12)]);
    expect(input.length).toBe(MEDIA_LIMITS.bytes);expect((await decodeImage(input)).detectedType).toBe('png');
    await expect(decodeImage(Buffer.concat([input,Buffer.from([0])]))).rejects.toBeInstanceOf(InvalidImage);
  });
  it('rejects valid decoded dimensions above an edge and above sixteen megapixels',async()=>{
    const edge=await sharp({create:{width:8193,height:1,channels:3,background:'red'}}).png().toBuffer();
    await expect(decodeImage(edge)).rejects.toBeInstanceOf(InvalidImage);
    const pixels=await sharp({create:{width:4001,height:4000,channels:3,background:'blue'}}).png().toBuffer();
    await expect(decodeImage(pixels)).rejects.toBeInstanceOf(InvalidImage);
  });
  it('rejects actual animated WebP and PNG animation markers',async()=>{
    const animated=await sharp(Buffer.from([255,0,0,255,0,255,0,255]),{raw:{width:1,height:2,channels:4,pageHeight:1}}).webp({loop:0}).toBuffer();
    expect((await sharp(animated,{animated:true}).metadata()).pages).toBe(2);
    await expect(decodeImage(animated)).rejects.toBeInstanceOf(InvalidImage);
    const png=await fixture('png'),chunk=Buffer.alloc(20);chunk.writeUInt32BE(8,0);chunk.write('acTL',4);chunk.writeUInt32BE(2,8);
    await expect(decodeImage(Buffer.concat([png.subarray(0,33),chunk,png.subarray(33)]))).rejects.toBeInstanceOf(InvalidImage);
  });
});
