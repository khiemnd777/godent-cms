import { SQL } from 'bun';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDatabaseUrl } from '../apps/api/src/auth/policy';

async function main() {
  if (!process.argv.includes('--local-auth-001') || process.cwd() !== resolve(import.meta.dir, '..')) throw new Error('Explicit AUTH local scope required');
  const client = new SQL(validateDatabaseUrl(process.env.S02_MIGRATION_DATABASE_URL, 'gcms_s02_migration'),
    { max: 1, connectionTimeout: 3, connection: { default_transaction_read_only: 'on' } });
  try {
    const result = await client.begin(async tx => {
      await tx.unsafe('SET LOCAL ROLE gcms_s02_owner');
      const functions = await tx`SELECT n.nspname AS schema,p.proname AS name,p.prosecdef AS security_definer,p.provolatile AS volatility,
        p.proconfig AS configuration,pg_get_userbyid(p.proowner) AS owner,pg_get_functiondef(p.oid) AS definition,
        pg_get_function_arguments(p.oid) AS arguments,
        EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('gcms_s02','gcms_s04','gcms_s05') ORDER BY n.nspname,p.proname`;
      const activeFactorReferences = functions.filter((row: { definition: string }) => /two_factor_enabled|mfa_verified|\bg\.mfa\b/i.test(row.definition));
      const legacyCalls = functions.filter((row: { name: string; definition: string }) => row.name !== 'has_membership' && /gcms_s02\.has_membership\(/.test(row.definition));
      const policy = await tx`SELECT schemaname,tablename,policyname,qual,with_check FROM pg_policies WHERE schemaname IN ('gcms_s02','gcms_s04','gcms_s05')`;
      const legacyPolicies = policy.filter((row: { qual: string | null; with_check: string | null }) => /has_membership\(/.test(`${row.qual ?? ''} ${row.with_check ?? ''}`));
      const [legacyColumns] = await tx`SELECT count(*)::integer AS count FROM information_schema.columns WHERE
        (table_schema='gcms_s02_auth' AND table_name='user' AND column_name='two_factor_enabled') OR
        (table_schema='gcms_s02_auth' AND table_name='session' AND column_name='mfa_verified') OR
        (table_schema='gcms_s02_auth' AND table_name='two_factor' AND column_name IN ('secret','backup_codes'))`;
      const [grantDefault] = await tx`SELECT column_default FROM information_schema.columns
        WHERE table_schema='gcms_s02_auth' AND table_name='reauth_grant' AND column_name='mfa'`;
      const current = functions.find((row: { name: string }) => row.name === 'has_current_membership');
      const recent = functions.find((row: { name: string }) => row.name === 'has_recent_auth');
      const wrapper = functions.find((row: { name: string }) => row.name === 'has_membership');
      const lock = functions.find((row: { name: string }) => row.name === 'lock_actor');
      const helperPrivileges = await tx`SELECT has_function_privilege('gcms_s02_tenant','gcms_s02.has_current_membership(text)','EXECUTE') AS tenant_member,
        has_function_privilege('gcms_s02_platform','gcms_s02.has_current_membership(text)','EXECUTE') AS platform_member,
        has_function_privilege('gcms_s02_tenant','gcms_s02.has_recent_auth()','EXECUTE') AS tenant_recent,
        has_function_privilege('gcms_s02_platform','gcms_s02.has_recent_auth()','EXECUTE') AS platform_recent,
        has_function_privilege('gcms_s04_intake','gcms_s02.has_recent_auth()','EXECUTE') AS intake_recent,
        has_function_privilege('gcms_s05_worker','gcms_s02.has_recent_auth()','EXECUTE') AS worker_recent`;
      const migration = await readFile('apps/api/migrations/0001_s02_access.sql', 'utf8');
      const historicalMigration = JSON.parse(await readFile('docs/evidence/s02/migration-final.json', 'utf8')) as { migrations: Array<{ name: string; checksum: string }> };
      const historicalSuites = JSON.parse(await readFile('docs/evidence/s02/combined-api-checks.json', 'utf8')) as { status: string; suites: Array<{ file: string; exitCode: number }> };
      const triggers = await tx`SELECT t.tgname,p.proname,t.tgenabled FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
        WHERE NOT t.tgisinternal AND t.tgname IN ('membership_retain_admin','user_retain_admin')`;
      const retainedBodies = ['retain_admin', 'retain_admin_on_disable'].map(name => {
        const original = migration.match(new RegExp('CREATE FUNCTION gcms_s02\\.' + name + '\\(\\)[\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;'))?.[1]?.trim();
        const installed = functions.find((row: { name: string }) => row.name === name)?.definition.match(/AS (\$[a-zA-Z_0-9]*\$)([\s\S]*?)\1/)?.[2]?.trim();
        return { name, sourceBodySha256: original ? createHash('sha256').update(original).digest('hex') : null,
          exactBodyMatch: !!original && installed === original };
      });
      const migrationMatchesHistorical = historicalMigration.migrations.find(item => item.name === '0001_s02_access.sql')?.checksum === createHash('sha256').update(migration).digest('hex');
      const historicalRaceSuitePassed = historicalSuites.status === 'PASS' && historicalSuites.suites.find(item => item.file === 'domain-integration.test.ts')?.exitCode === 0;
      const repair = await readFile('apps/api/migrations/0014_s05_user_identifier.sql', 'utf8');
      const originalLead = (await readFile('apps/api/migrations/0008_s05_lead_operations.sql', 'utf8')).match(/CREATE FUNCTION gcms_s05\.lead_command\([\s\S]*?AS \$\$([\s\S]*?)\$\$;/)?.[1]?.trim();
      const repairedBody = repair.match(/AS \$\$([\s\S]*?)\$\$;/)?.[1]?.trim();
      const installedLead = functions.find((row: { name: string }) => row.name === 'lead_command')?.definition.match(/AS (\$[a-zA-Z_0-9]*\$)([\s\S]*?)\1/)?.[2]?.trim();
      const oldPredicate = "c->>'assigneeUserId' !~ '^[a-f0-9-]{36}$'";
      const newPredicate = "c->>'assigneeUserId' !~ '^[A-Za-z0-9_-]{1,128}$'";
      const checks = {
        assignmentUserIdentifierForwardRepair: !!originalLead && repairedBody === originalLead.replace(oldPredicate, () => newPredicate) && installedLead === repairedBody,
        lastAdminTriggersRetained: triggers.length === 2 && triggers.every((row: { tgname: string; proname: string; tgenabled: string }) => row.tgenabled === 'O' && row.proname === (row.tgname === 'membership_retain_admin' ? 'retain_admin' : 'retain_admin_on_disable')),
        lastAdminBodiesMatchHistorical: migrationMatchesHistorical && retainedBodies.every(item => item.exactBodyMatch),
        activeFactorReferencesAbsent: activeFactorReferences.length === 0,
        activeLegacyMembershipCallsAbsent: legacyCalls.length === 0 && legacyPolicies.length === 0,
        legacyStorageRetained: legacyColumns.count === 4,
        inertGrantDefaultFalse: grantDefault.column_default === 'false',
        wrapperKeepsExactArgumentAndDefault: !!wrapper && /p_mfa boolean DEFAULT true/.test(wrapper.arguments) && /has_current_membership\(p_tenant\)/.test(wrapper.definition),
        actorPayloadFactorFree: !!lock && !/twoFactorEnabled|mfaVerified/.test(lock.definition),
        helpersOwnerAndSearchPath: [current, recent].every(row => row?.security_definer && row.owner === 'gcms_s02_owner' && row.configuration?.includes('search_path=pg_catalog') && !row.public_execute),
        recentUsesCurrentClock: recent?.volatility === 'v',
        narrowHelperPrivileges: helperPrivileges[0].tenant_member && helperPrivileges[0].platform_member && helperPrivileges[0].tenant_recent && helperPrivileges[0].platform_recent && !helperPrivileges[0].intake_recent && !helperPrivileges[0].worker_recent,
      };
      return { checks, lastAdminRaceEvidenceReuse: { historicalRaceSuitePassed, migrationMatchesHistorical, retainedBodies,
          limit: 'Reuses historical actual race proof only for unchanged last-admin counting/locks/triggers. Fresh password-only and UI last-admin tests remain separate; no fresh race run is claimed.' }, functionCount: functions.length, policyCount: policy.length,
        functionHashes: functions.map((row: { schema: string; name: string; definition: string }) => ({ schema: row.schema, name: row.name, sha256: createHash('sha256').update(row.definition).digest('hex') })) };
    });
    const status = Object.values(result.checks).every(Boolean) ? 'PASS' : 'FAIL';
    await mkdir('docs/evidence/auth-001/data', { recursive: true });
    await writeFile('docs/evidence/auth-001/data/catalog.json', JSON.stringify({ recordedAtUtc: new Date().toISOString(), status, ...result,
      limit: 'Read-only PostgreSQL catalog checks. Behavioral/session and browser proof remain separate.' }, null, 2) + '\n');
    console.info(JSON.stringify({ status, checks: result.checks, functionCount: result.functionCount, policyCount: result.policyCount, databaseWritesAttempted: false }));
    if (status !== 'PASS') process.exitCode = 1;
  } finally { await client.close(); }
}
main().catch(() => { console.error('AUTH catalog check failed; details redacted.'); process.exitCode = 1; });
