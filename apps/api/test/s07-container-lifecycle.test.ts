import { describe, expect, test } from 'bun:test';
import { BunMediaDockerRuntime, DecoderSettlementUnknown, DecoderTimeout, DockerMediaProcessor, type DockerCommandResult } from '../src/media/processor';
import { image } from './s07-support';

/** Fault only the control acknowledgement; every container below is an actual restricted Docker process. */
class FaultRuntime extends BunMediaDockerRuntime {
 id='';name='';nonce='';attachments=0;kills=0;
 constructor(readonly mode:'timeout'|'initial_kill_failure'|'late_create'|'unconfirmed_stop'){super();}
 override async command(args:string[]):Promise<DockerCommandResult> {
  if(args[0]==='create') {
   this.name=args[args.indexOf('--name')+1];this.nonce=args[args.indexOf('--label')+1].slice('gcms.s07.decoder='.length);
   // Use the exact decoder image and hard bounds; replace only its command with a real sleeper.
   const actual=[...args];actual.splice(actual.length-1,0,'--entrypoint=bun');actual.push('-e','await Bun.sleep(60000);');
   if(this.mode==='late_create') await Bun.sleep(2500);
   const result=await super.command(actual);this.id=result.stdout.toString('utf8').trim();return result;
  }
  if(args[0]==='kill') {
   this.kills++;
   if(this.mode==='unconfirmed_stop'||(this.mode==='initial_kill_failure'&&this.kills===1)) return {code:1,stdout:Buffer.alloc(0),stderr:Buffer.from('Owned fault fixture: kill acknowledgement failed')};
  }
  return super.command(args);
 }
 override attach(id:string){this.attachments++;return super.attach(id);}
 async absent() {const result=await super.command(['inspect',this.id]);return result.code!==0&&/No such (?:object|container)/i.test(result.stderr.toString('utf8'));}
 async fixtureCleanup() {
  if(!this.id) return;const result=await super.command(['inspect',this.id]);if(result.code!==0)return;
  const current=JSON.parse(result.stdout.toString('utf8'))[0];
  if(current.Id!==this.id||current.Name!==`/${this.name}`||current.Config.Labels['gcms.s07.decoder']!==this.nonce) throw new Error('Owned fixture cleanup refused');
  if(current.State.Running) await super.command(['kill',this.id]);await super.command(['rm',this.id]);
 }
}
describe.skipIf(process.env.S07_INTEGRATION!=='1')('S07 actual decoder wrapper lifecycle regression R6',()=>{
 for(const mode of ['timeout','initial_kill_failure','late_create'] as const) test(`${mode} confirms the exact actual container is absent before returning timeout`,async()=>{
  const runtime=new FaultRuntime(mode),processor=new DockerMediaProcessor(process.env.S07_DECODER_IMAGE!,{runtime,deadlineMs:2000});
  try {
   await expect(processor.process(await image('png'))).rejects.toBeInstanceOf(DecoderTimeout);
   expect(runtime.id).toMatch(/^[a-f0-9]{64}$/);expect(await runtime.absent()).toBe(true);
   if(mode==='late_create') expect(runtime.attachments).toBe(0);
   else expect(runtime.attachments).toBe(1);
   if(mode==='initial_kill_failure') expect(runtime.kills).toBeGreaterThanOrEqual(2);
  } finally {await runtime.fixtureCleanup();}
 },60000);
 test('persistent control failure reports Unknown and never claims container settlement',async()=>{
  const runtime=new FaultRuntime('unconfirmed_stop'),processor=new DockerMediaProcessor(process.env.S07_DECODER_IMAGE!,{runtime,deadlineMs:2000});
  try {
   let failure:unknown;try {await processor.process(await image('png'));}catch(error){failure=error;}
   expect(failure).toBeInstanceOf(DecoderSettlementUnknown);
   if(!(failure instanceof DecoderSettlementUnknown)) throw new Error('Expected actual decoder settlement failure');
   expect(failure.container).toEqual({id:runtime.id,name:runtime.name,nonce:runtime.nonce});
   expect(Object.isFrozen(failure.container)).toBe(true);expect(failure.errorId).toMatch(/^[a-f0-9-]{36}$/);
   expect(runtime.kills).toBeGreaterThanOrEqual(3);expect(await runtime.absent()).toBe(false);
  } finally {await runtime.fixtureCleanup();expect(await runtime.absent()).toBe(true);}
 },60000);
});
