// Test-owned process only. It exposes the ordinary API with restricted runtime credentials.
import type { INestApplication } from '@nestjs/common';
if(process.env.NODE_ENV==='production'||process.env.S04_HMAC_SECRET===undefined) throw new Error('Local S04 test configuration required');
const {createApp}=await import('../dist/app.js' as string) as {createApp():Promise<INestApplication>};
const app=await createApp();await app.listen(0,'127.0.0.1');console.info(JSON.stringify({url:await app.getUrl()}));
