/** Root runs this local-only spike after building the new immutable decoder image. */
import sharp from 'sharp';
import { DockerMediaProcessor, RejectedImage } from '../apps/api/src/media/processor';
const processor=new DockerMediaProcessor();
const results:Record<string,unknown>[]=[];
for(const type of ['jpeg','png','webp'] as const) {
  const input=await sharp({create:{width:48,height:32,channels:3,background:'#3377bb'}})[type]().toBuffer();
  const output=await processor.process(input),metadata=await sharp(output.body).metadata();
  if(output.detectedType!==type||metadata.format!=='webp'||output.width!==48||output.height!==32||metadata.exif) throw new Error('Decode result mismatch');
  results.push({type,bytes:input.length,outputBytes:output.bytes,width:output.width,height:output.height,metadataStripped:true});
}
for(const [label,input] of [
  ['malformed',Buffer.from('ffd8ffdb','hex')],
  ['edge_limit',await sharp({create:{width:8193,height:1,channels:3,background:'red'}}).png().toBuffer()],
  ['pixel_limit',await sharp({create:{width:4001,height:4000,channels:3,background:'red'}}).png().toBuffer()],
] as const) {
  let rejected=false;try {await processor.process(input);}catch(error){rejected=error instanceof RejectedImage;}
  if(!rejected) throw new Error('Expected isolated decoder rejection');results.push({label,rejected});
}
console.log(JSON.stringify({scope:'S07 isolated decoder real input/output',bun:Bun.version,sharp:sharp.versions.sharp,image:process.env.S07_DECODER_IMAGE,results},null,2));
