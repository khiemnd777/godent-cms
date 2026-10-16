import { SQL } from 'bun';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomBytes, createHash } from 'node:crypto';
import { createS02Database } from '../src/database';
import { createS02Auth } from '../src/auth';
import { validateDatabaseUrl } from '../src/auth/policy';
import { DomainService } from '../src/modules/domain.service';
import { draftInput, saveDraftInput } from '../src/modules/input';
import { openFixtureSession } from '../../../scripts/s02-fixtures';

describe('S02 draft API/database contract',()=>{
  it('accepts the 160-character storage boundary and rejects 161 before SQL',()=>{
    expect(draftInput({title:'x'.repeat(160),body:''}).title.length).toBe(160);
    expect(()=>draftInput({title:'x'.repeat(161),body:''})).toThrow();
    expect(()=>saveDraftInput({title:'x'.repeat(161),body:'',expectedVersion:1})).toThrow();
  });
});
const integration=process.env.S02_INTEGRATION==='1'?describe:describe.skip;
integration('S02 sensitive invitation acceptance',()=>{
  let db:ReturnType<typeof createS02Database>;let identity:ReturnType<typeof createS02Auth>;let owner:SQL;
  let session:Awaited<ReturnType<typeof openFixtureSession>>;let service:DomainService;
  const tenantId=crypto.randomUUID();const token=randomBytes(32).toString('base64url');
  beforeAll(async()=>{
    db=createS02Database();identity=createS02Auth(db);service=new DomainService(db,identity);
    owner=new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL,'gcms_s02_migration'),{max:1});
    session=await openFixtureSession(identity,'noMembership');
    await owner.begin(async tx=>{
      await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
      await tx`insert into gcms_s02.tenant(id,name) values(${tenantId},'S02 reauthentication acceptance')`;
      await tx`insert into gcms_s02.membership(tenant_id,user_id) values(${tenantId},'10000000-0000-4000-8000-000000000001')`;
      await tx`insert into gcms_s02.invitation(id,tenant_id,email,token_hash,expires_at,created_by)
        values(${crypto.randomUUID()},${tenantId},${session.fixture.email},${createHash('sha256').update(token).digest('hex')},now()+interval '24 hours','10000000-0000-4000-8000-000000000001')`;
      await tx`update gcms_s02_auth.session set created_at=now()-interval '6 minutes' where id=${session.actor.sessionId}`;
    });
  },30000);
  afterAll(async()=>{
    if(owner && session) await owner.begin(async tx=>{
      await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
      await tx`update gcms_s02.membership set status='revoked' where tenant_id=${tenantId} and user_id=${session.actor.userId} and status='active'`;
    });
    await session?.call('/sign-out',{});await db?.close();await owner?.close();
  });
  it('denies a stale session cookie until the intended identity reauthenticates',async()=>{
    const request={method:'POST',originalUrl:'/api/invitations/accept',headers:{host:'127.0.0.1:5890',origin:'http://127.0.0.1:5891','content-type':'application/json',
      cookie:session.headers.get('cookie')??'','x-csrf-token':identity.csrfToken(session.actor)}};
    let deniedStatus:number|undefined;
    try {await service.acceptInvitation(request,{token});} catch(error) {deniedStatus=(error as {getStatus?:()=>number}).getStatus?.();}
    expect(deniedStatus).toBe(403);
    await identity.reauthenticate(session.headers,{password:session.fixture.password});
    expect(await service.acceptInvitation(request,{token})).toEqual({tenantId,role:'tenant_admin'});
  },15000);
});
