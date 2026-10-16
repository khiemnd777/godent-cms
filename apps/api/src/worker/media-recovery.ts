import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DecoderSettlementUnknown } from '../media/processor';

export interface MediaRecoveryContext {tenantId:string;assetId:string;jobId:string;fence:number;workerId:string}
export type MediaRecoveryWriter=(context:MediaRecoveryContext,error:DecoderSettlementUnknown)=>Promise<string>;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/** This receipt contains identities only. It never authorizes cleanup or clears the database latch. */
export async function writeMediaRecoveryReceipt(context:MediaRecoveryContext,error:DecoderSettlementUnknown,directory=resolve('.local')):Promise<string> {
 const container=error.container;
 if(!container||!uuid.test(error.errorId)||!uuid.test(container.nonce)||container.name!==`gcms-s07-decoder-${container.nonce}`||
  (container.id!==null&&!/^[a-f0-9]{64}$/.test(container.id))||!uuid.test(context.tenantId)||!uuid.test(context.assetId)||!uuid.test(context.jobId)||!uuid.test(context.workerId)||!Number.isSafeInteger(context.fence)||context.fence<1) throw new Error('Invalid media recovery identity');
 const stat=await lstat(directory);
 if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o777)!==0o700||stat.uid!==process.getuid?.()) throw new Error('Private media recovery directory required');
 const path=resolve(directory,`s07-recovery-${error.errorId}.json`);
 const file=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try {
  await file.writeFile(JSON.stringify({schemaVersion:1,recordedAt:new Date().toISOString(),state:'native_blocked',failureCode:'decoder_settlement_unknown',
   errorId:error.errorId,tenantId:context.tenantId,assetId:context.assetId,jobId:context.jobId,fence:context.fence,workerId:context.workerId,
   container:{id:container.id,name:container.name,nonce:container.nonce}},null,2)+'\n');
  await file.sync();
 } finally {await file.close();}
 const folder=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
 try {await folder.sync();}finally{await folder.close();}
 return path;
}
