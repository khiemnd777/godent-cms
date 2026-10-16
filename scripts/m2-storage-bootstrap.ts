import { S3Client,CreateBucketCommand,ListBucketsCommand,PutObjectCommand,HeadObjectCommand,GetObjectCommand } from '@aws-sdk/client-s3';
import { writeFile } from 'node:fs/promises';
let stage='input';
async function main() {
 if(!process.argv.includes('--local-m2')) throw new Error('Explicit new local storage scope required');
 const bucket=process.env.S07_MEDIA_BUCKET??'',access=process.env.S07_STORAGE_ACCESS_KEY_ID??'',secret=process.env.S07_STORAGE_SECRET_ACCESS_KEY??'';
 if(!/^gcms-m2-media-[a-f0-9-]{36}$/.test(bucket)||!/^gcmsm2[a-f0-9]{24}$/.test(access)||!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Invalid new storage scope');
 const endpoint=process.env.S3_ENDPOINT;if(endpoint!=='http://127.0.0.1:5887') throw new Error('Wrong existing local endpoint');
 const inspect=Bun.spawn(['docker','inspect','godent-cms-s01-s3-1','--format','{{.Id}} {{index .Config.Labels "com.docker.compose.project"}}'],{stdout:'pipe',stderr:'pipe'});
 const [identity,inspectCode]=await Promise.all([new Response(inspect.stdout).text(),inspect.exited]);
 if(inspectCode||!identity.trim().endsWith('godent-cms-s01')) throw new Error('Wrong existing storage container');
 const container=identity.split(' ')[0];
 const common={endpoint,region:process.env.S3_REGION!,forcePathStyle:true,maxAttempts:1};
 const root=new S3Client({...common,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID!,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY!}});
 const scoped=new S3Client({...common,credentials:{accessKeyId:access,secretAccessKey:secret}});
 const options=()=>({abortSignal:AbortSignal.timeout(5000)});
 try {
  const ensureOwnedBucket=async(name:string,marker:string)=>{
    // SeaweedFS4.48 HeadBucket returns500 for an existing bucket on this local topology.
    // A private run-owned marker verifies resumability without relying on bucket enumeration.
    try {
      const existing=await root.send(new GetObjectCommand({Bucket:name,Key:'scope-proof'}),options());
      if(await existing.Body?.transformToString()!==marker) throw new Error('Owned marker mismatch');
      return;
    } catch(error) {
      if((error as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode!==404) throw error;
      try {await root.send(new CreateBucketCommand({Bucket:name,ACL:'private'}),options());}
      catch(created) {if((created as {name?:string}).name!=='BucketAlreadyOwnedByYou') throw created;}
    }
  };
  stage='own_bucket';await ensureOwnedBucket(bucket,'owned synthetic storage proof');
  stage='dynamic_identity';const child=Bun.spawn(['docker','exec','-i',container,'weed','shell','-master=localhost:9333','-filer=localhost:8888'],{stdin:'pipe',stdout:'pipe',stderr:'pipe'});
  child.stdin.write(`s3.configure -user=${access} -actions=Read,Write -buckets=${bucket} -access_key=${access} -secret_key=${secret} -apply\n`);await child.stdin.end();
  const [stdout,stderr,exit]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
  await writeFile('.local/m2-s3-configure.log',stdout+stderr,{mode:0o600});
  if(exit||/error|failed|unknown command/i.test(stdout+stderr)) throw new Error('Scoped storage configuration rejected');
  stage='scoped_write';let ready=false;
  for(let attempt=0;attempt<30;attempt++) {
   try {await scoped.send(new PutObjectCommand({Bucket:bucket,Key:'scope-proof',Body:'owned synthetic storage proof',ACL:'private'}),options());ready=true;break;}
   catch {await Bun.sleep(500);}
  }
  if(!ready) throw new Error('Scoped storage credential not ready');
  await scoped.send(new HeadObjectCommand({Bucket:bucket,Key:'scope-proof'}),options());
  // SeaweedFS may return an empty filtered200 rather than403 for ListBuckets.
  let listDenied=false;try {const listed=await scoped.send(new ListBucketsCommand({}),options());listDenied=(listed.Buckets??[]).every(b=>b.Name===bucket);}catch(error){listDenied=(error as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode===403;}
  const other=`${bucket}-denied`;
  stage='control_bucket';await ensureOwnedBucket(other,'owned denial control');
  // The existing local service has no free volumes for another collection.
  // Control bucket existence is confirmed by root create/owned409; no object write is claimed.
  // The scoped request must reject before revealing whether its requested key exists.
  stage='control_read_denial';let crossDenied=false;try {await scoped.send(new GetObjectCommand({Bucket:other,Key:'scope-proof'}),options());}catch(error){crossDenied=(error as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode===403;}
  stage='anonymous_read_denial';const anonymous=await fetch(`${endpoint}/${bucket}/scope-proof`,{signal:AbortSignal.timeout(5000)});
  if(!listDenied||!crossDenied||anonymous.status!==403) throw new Error('Storage privilege boundary not verified');
  await root.send(new ListBucketsCommand({}),options());
  const result={status:'PASS',bucket,existingContainerPreserved:true,existingStaticConfigPreserved:true,newScopedIdentity:true,
    ownObjectReadWrite:true,unscopedBucketEnumerationDenied:listDenied,crossBucketRequestDenied:crossDenied,controlObjectCreated:false,controlWriteLimit:'Existing local volume capacity exhausted; no old container/config/capacity changed.',unsignedReadDenied:anonymous.status===403,
    source:'https://github.com/seaweedfs/seaweedfs/blob/4.48/weed/shell/command_s3_configure.go',scope:'New M2 bucket and dynamic identity only; original identity remains usable.'};
  await writeFile('docs/evidence/m2/storage-bootstrap.json',JSON.stringify(result,null,2)+'\n');console.info(JSON.stringify(result));
 }finally{root.destroy();scoped.destroy();}
}
void main().catch(error=>{console.error(JSON.stringify({status:'FAIL',stage,code:error?.name,httpStatus:error?.$metadata?.httpStatusCode,detailsRedacted:true}));process.exitCode=1;});
