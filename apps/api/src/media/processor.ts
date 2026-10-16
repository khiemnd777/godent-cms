import { randomUUID } from 'node:crypto';
import { MEDIA_LIMITS } from '../contracts/s07';
export interface DecodedMedia { detectedType:'jpeg'|'png'|'webp'; sourceWidth:number; sourceHeight:number; width:number; height:number; bytes:number; body:Buffer }
export class RejectedImage extends Error {}
export class DecoderTimeout extends Error {}
/** A daemon/control failure is visible; it is never evidence of a stopped native decoder. */
export interface DecoderContainerIdentity {readonly id:string|null;readonly name:string;readonly nonce:string}
export class DecoderSettlementUnknown extends Error {
 readonly errorId=randomUUID();readonly container?:Readonly<DecoderContainerIdentity>;
 recovery?:Readonly<{blocked:true;receiptPath:string|null}>;
 constructor(message:string,container?:DecoderContainerIdentity) {super(message);if(container)this.container=Object.freeze({...container});}
}
export interface MediaProcessor { process(input:Uint8Array):Promise<DecodedMedia> }
export interface DockerCommandResult {code:number;stdout:Buffer;stderr:Buffer}
export interface DockerAttachment {
 stdout:ReadableStream<Uint8Array>;stderr:ReadableStream<Uint8Array>;exited:Promise<number>;
 write(input:Uint8Array):Promise<void>;stopCli():Promise<void>;
}
export interface MediaDockerRuntime {
 command(args:string[]):Promise<DockerCommandResult>;
 attach(id:string):DockerAttachment;
}
async function boundedOutput(stream:ReadableStream<Uint8Array>,limit:number) {
 const chunks:Uint8Array[]=[];let length=0;
 const reader=stream.getReader();
 try {
  for(;;) {const next=await reader.read();if(next.done)break;length+=next.value.byteLength;if(length>limit)throw new Error('Decoder output exceeded limit');chunks.push(next.value);}
 } finally {reader.releaseLock();}
 return Buffer.concat(chunks,length);
}
export class BunMediaDockerRuntime implements MediaDockerRuntime {
 async command(args:string[]):Promise<DockerCommandResult> {
  const child=Bun.spawn(['docker',...args],{stdout:'pipe',stderr:'pipe'});
  const timer=setTimeout(()=>child.kill('SIGKILL'),10_000);
  try {const [stdout,stderr,code]=await Promise.all([boundedOutput(child.stdout,65536),boundedOutput(child.stderr,16384),child.exited]);return {stdout,stderr,code};}
  finally {clearTimeout(timer);if(child.exitCode===null){child.kill('SIGKILL');await child.exited;}}
 }
 attach(id:string):DockerAttachment {
  const child=Bun.spawn(['docker','start','--attach','--interactive',id],{stdin:'pipe',stdout:'pipe',stderr:'pipe'});
  return {stdout:child.stdout,stderr:child.stderr,exited:child.exited,
   async write(input){child.stdin.write(input);await child.stdin.end();},
   async stopCli(){if(child.exitCode===null) child.kill('SIGKILL');await child.exited;}};
 }
}
interface ContainerState {Id:string;Name:string;Image:string;State:{Running:boolean;ExitCode:number};Config:{User:string;Labels:Record<string,string>};HostConfig:{Memory:number;MemorySwap:number;NanoCpus:number;PidsLimit:number;NetworkMode:string;ReadonlyRootfs:boolean};Mounts:Array<{Type:string;Destination:string}>}
export class DockerMediaProcessor implements MediaProcessor {
 private readonly runtime:MediaDockerRuntime;private readonly deadlineMs:number;
 constructor(private readonly image=process.env.S07_DECODER_IMAGE??'',options:{runtime?:MediaDockerRuntime;deadlineMs?:number}={}) {
  if(!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error('Immutable local decoder image required');
  this.runtime=options.runtime??new BunMediaDockerRuntime();this.deadlineMs=options.deadlineMs??MEDIA_LIMITS.processingSeconds*1000;
  if(!Number.isSafeInteger(this.deadlineMs)||this.deadlineMs<50||this.deadlineMs>MEDIA_LIMITS.processingSeconds*1000) throw new Error('Invalid decoder deadline');
 }
 private async inspect(identity:string):Promise<ContainerState|null> {
  const result=await this.runtime.command(['inspect','--type=container',identity]);
  if(result.code!==0) {
   if(/No such (?:object|container)/i.test(result.stderr.toString('utf8'))) return null;
   throw new DecoderSettlementUnknown('Container state unavailable');
  }
  const rows=JSON.parse(result.stdout.toString('utf8'));if(!Array.isArray(rows)||rows.length!==1) throw new DecoderSettlementUnknown('Container state invalid');return rows[0] as ContainerState;
 }
 private owned(state:ContainerState,name:string,nonce:string,id?:string) {
  if(state.Name!==`/${name}`||state.Config.Labels['gcms.s07.decoder']!==nonce||(id&&state.Id!==id)||state.Image!==this.image) throw new DecoderSettlementUnknown('Container ownership mismatch');
 }
 private async stopOwned(name:string,nonce:string,id?:string) {
  for(let attempt=0;attempt<3;attempt++) {
   const state=await this.inspect(id??name);if(!state) return;
   this.owned(state,name,nonce,id);if(!state.State.Running) return;
   // An unsuccessful kill is not completion. Always inspect the exact owned process again.
   await this.runtime.command(['kill',state.Id]);
  }
  const state=await this.inspect(id??name);if(!state) return;this.owned(state,name,nonce,id);
  if(state.State.Running) throw new DecoderSettlementUnknown('Decoder stop unconfirmed');
 }
 private async removeOwned(name:string,nonce:string,id?:string) {
  await this.stopOwned(name,nonce,id);const state=await this.inspect(id??name);if(!state) return;
  this.owned(state,name,nonce,id);if(state.State.Running) throw new DecoderSettlementUnknown('Decoder remains running');
  const removed=await this.runtime.command(['rm',state.Id]);if(removed.code!==0) throw new DecoderSettlementUnknown('Decoder cleanup unconfirmed');
  if(await this.inspect(state.Id)) throw new DecoderSettlementUnknown('Decoder removal unconfirmed');
 }
 async process(input:Uint8Array):Promise<DecodedMedia> {
  if(!input.byteLength||input.byteLength>MEDIA_LIMITS.bytes) throw new RejectedImage();
  const nonce=randomUUID(),name='gcms-s07-decoder-'+nonce;let id:string|undefined,attachment:DockerAttachment|undefined;
  let timedOut=false,stop:Promise<void>|undefined,settlementError:unknown;
  const timer=setTimeout(()=>{
   timedOut=true;
   if(attachment) stop=(async()=>{try{await this.stopOwned(name,nonce,id);}catch(error){settlementError=error;}finally{await attachment!.stopCli();}})();
  },this.deadlineMs);
  try {try {
   // Docker create never starts a process. A delayed/lost creation acknowledgement cannot run a decoder.
   // Source: https://docs.docker.com/reference/cli/docker/container/create/
   const created=await this.runtime.command(['create','--interactive','--name',name,'--label',`gcms.s07.decoder=${nonce}`,'--pull=never',
    '--network=none','--read-only','--user=10000:10000','--memory=384m','--memory-swap=384m','--cpus=1','--pids-limit=64','--cap-drop=ALL',
    '--security-opt=no-new-privileges','--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m',this.image]);
   if(created.code!==0) throw new Error('Decoder container creation failed');
   id=created.stdout.toString('utf8').trim();if(!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid decoder container identity');
   const state=await this.inspect(id);if(!state) throw new Error('Decoder container absent');this.owned(state,name,nonce,id);
   const c=state.HostConfig;
   if(c.Memory!==384*1024*1024||c.MemorySwap!==384*1024*1024||c.NanoCpus!==1_000_000_000||c.PidsLimit!==64||c.NetworkMode!=='none'||!c.ReadonlyRootfs||state.Config.User!=='10000:10000'||state.Mounts.some(m=>m.Type!=='tmpfs'||m.Destination!=='/tmp')) throw new Error('Decoder isolation mismatch');
   if(timedOut) throw new DecoderTimeout('Decoder creation exceeded deadline');
   attachment=this.runtime.attach(id);
   const stdout=boundedOutput(attachment.stdout,Math.ceil(MEDIA_LIMITS.bytes*4/3)+4096),stderr=boundedOutput(attachment.stderr,16384);
   await attachment.write(input);const [output,,exit]=await Promise.all([stdout,stderr,attachment.exited]);
   if(stop) await stop;if(settlementError) throw settlementError;if(timedOut) throw new DecoderTimeout('Decoder process deadline');
   const stopped=await this.inspect(id);if(!stopped) throw new Error('Decoder result state absent');this.owned(stopped,name,nonce,id);
   if(stopped.State.Running) throw new DecoderSettlementUnknown('Decoder result process remains running');
   const result=JSON.parse(output.toString('utf8'));
   if(result.outcome==='rejected'&&stopped.State.ExitCode===2) throw new RejectedImage();
   if(exit!==0||stopped.State.ExitCode!==0||result.outcome!=='success'||!['jpeg','png','webp'].includes(result.detectedType)||typeof result.body!=='string') throw new Error('Decoder process failed');
   for(const field of ['width','height','sourceWidth','sourceHeight','bytes']) if(!Number.isSafeInteger(result[field])||result[field]<1) throw new Error('Decoder result invalid');
   const body=Buffer.from(result.body,'base64');
   if(body.byteLength!==result.bytes||body.byteLength>MEDIA_LIMITS.bytes||result.width>1600||result.height>1600||result.sourceWidth>8192||result.sourceHeight>8192||result.sourceWidth*result.sourceHeight>MEDIA_LIMITS.pixels) throw new Error('Decoder result exceeds bounds');
   return {...result,body} as DecodedMedia;
  } finally {
   clearTimeout(timer);if(stop) await stop;
   // Container state, never CLI exit, decides whether native processing has settled.
   try {await this.removeOwned(name,nonce,id);}finally{if(attachment) await attachment.stopCli();}
  }} catch(error) {
   if(error instanceof DecoderSettlementUnknown) throw new DecoderSettlementUnknown(error.message,{id:id??null,name,nonce});
   throw error;
  }
 }
}
