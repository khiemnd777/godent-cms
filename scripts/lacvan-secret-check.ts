import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readLacVanFixtures } from './lacvan-fixtures';

async function main() {
  if (Bun.version !== '1.4.3' || process.cwd() !== resolve(import.meta.dir, '..') || process.argv.slice(2).join(' ') !== '--local-lacvan') throw new Error('Explicit clinic artifact check required');
  const fixture = await readLacVanFixtures();
  const result = Bun.spawnSync(['rg', '--files', 'apps', 'scripts', 'docs', 'AGENTS.md', 'assets/lacvan'], { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error('Artifact inventory unavailable');
  const paths = new TextDecoder().decode(result.stdout).trim().split('\n').filter(path => /\.(?:ts|tsx|js|json|sql|md|css|html|toml|yaml|yml|txt|svg)$/.test(path));
  const hits: { path: string; credentialLabel: string }[] = [];
  let bytes = 0;
  for (const path of paths) {
    const text = await readFile(path, 'utf8'); bytes += Buffer.byteLength(text);
    for (const actor of fixture.identities) if (text.includes(actor.password)) hits.push({ path, credentialLabel: actor.label });
  }
  const report = { status: hits.length ? 'FAIL' : 'PASS', phase: 'exact-owned-credential-artifact-scan', recordedAt: new Date().toISOString(), files: paths.length, bytes, credentialValuesChecked: fixture.identities.length, hits, credentialsPrinted: false, limit: 'Exact new synthetic password values in repository text artifacts; runtime conversation history and binary image pixels are outside this check.' };
  await writeFile(`docs/evidence/lacvan/secret-check-${Date.now()}.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.info(JSON.stringify(report)); if (hits.length) process.exitCode = 1;
}
if (import.meta.main) void main().catch(() => { console.error('Clinic credential artifact check failed; values redacted.'); process.exitCode = 1; });
