import { expect,test } from 'bun:test';
import { selectM2WorkerEnvironment } from '../../../scripts/start-m2-worker';
test('worker environments do not inherit API, migration, other worker, signing or global credentials',()=>{
 const config={S06_WORKER_DATABASE_URL:'postgresql://gcms_s06_worker:synthetic@127.0.0.1:5888/gcms_s01',S07_WORKER_DATABASE_URL:'postgresql://gcms_s07_worker:synthetic@127.0.0.1:5888/gcms_s01',
  S07_MEDIA_BUCKET:'gcms-m2-media-synthetic',S07_STORAGE_ACCESS_KEY_ID:'owned-test',S07_STORAGE_SECRET_ACCESS_KEY:'owned-test',S07_DECODER_IMAGE:'sha256:owned-test',S07_MEDIA_SIGNING_SECRET:'must-not-leak'};
 const source={PATH:'/synthetic',HOME:'/synthetic',S3_ENDPOINT:'http://127.0.0.1:5887',S3_REGION:'synthetic',DATABASE_URL:'must-not-leak',S02_MIGRATION_DATABASE_URL:'must-not-leak',BETTER_AUTH_SECRET:'must-not-leak',S04_HMAC_SECRET:'must-not-leak',AWS_SECRET_ACCESS_KEY:'must-not-leak'};
 const retention=selectM2WorkerEnvironment('s06',config,source),media=selectM2WorkerEnvironment('s07',config,source);
 expect(Object.keys(retention).sort()).toEqual(['HOME','PATH','S06_WORKER_DATABASE_URL']);
 expect(Object.keys(media).sort()).toEqual(['HOME','PATH','S07_DECODER_IMAGE','S07_MEDIA_BUCKET','S07_STORAGE_ACCESS_KEY_ID','S07_STORAGE_SECRET_ACCESS_KEY','S07_WORKER_DATABASE_URL','S3_ENDPOINT','S3_REGION']);
 expect(JSON.stringify([retention,media])).not.toContain('must-not-leak');
});
