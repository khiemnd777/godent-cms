import sharp from 'sharp';
/** Bounded synthetic media owned by M5; no retained fixture or patient asset is read. */
export function m5SyntheticPng(index:0|1):Promise<Buffer>{
 return sharp({create:{width:480,height:320,channels:3,background:index?'#eadecc':'#dbede8'}}).png().toBuffer();
}
