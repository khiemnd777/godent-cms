import {describe,expect,test} from 'bun:test';
import {deleteLifecycleBatch} from '../src/worker/m5-lifecycle-worker';
describe('M5 irreversible object deletion checkpoints',()=>{
 test('only a verified physical delete advances checkpoint',async()=>{const events:string[]=[];const result=await deleteLifecycleBatch([{assetId:'a',key:'object'}],{deleteVerified:async key=>{events.push('verified:'+key);}},async item=>{events.push('checkpoint:'+item.key);},async(_asset,run)=>run());expect(result).toBe(1);expect(events).toEqual(['verified:object','checkpoint:object']);});
 test('failed or uncertain DELETE leaves checkpoint unadvanced',async()=>{let checkpoint=false;await expect(()=>deleteLifecycleBatch([{assetId:'a',key:'object'}],{deleteVerified:async()=>{throw new Error('HEAD unavailable');}},async()=>{checkpoint=true;},async(_asset,run)=>run())).toThrow('HEAD unavailable');expect(checkpoint).toBe(false);});
 test('checkpoint failure is observable and prevents later objects',async()=>{const deleted:string[]=[];await expect(()=>deleteLifecycleBatch([{assetId:'a',key:'one'},{assetId:'b',key:'two'}],{deleteVerified:async k=>{deleted.push(k);}},async()=>{throw new Error('fence lost');},async(_asset,run)=>run())).toThrow('fence lost');expect(deleted).toEqual(['one']);});
});
