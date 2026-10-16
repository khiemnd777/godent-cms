# M2 independent review

Owner: native `/root/m2_review`, source/evidence review only. Root owns integration and shared records. Approval: GCMS-M2-001 current M2 v0.1 local scope. No application edits, repairs, DB mutations, process control, deployment, Git writes or child delegation by this reviewer.

**Current final bounded review — CLOSED,2026-10-16.** Findings R1–R7 and the related history-timing/worker-credential/recovery-identity questions are resolved within the inspected source and actual scoped local evidence. No open actionable source/security finding remains in this assigned review. Final disposition and source/trace hashes are below. Audit remains **FAIL/open** under the fresh bounded local-M2 deferral. Root's task/runbook closure and FE's full final visual inspection were pending at this reviewer handoff. Human M2 acceptance, Git delivery and deployment are separate and are not claimed.

**Historical early handoff:** root requested release of the native slot for remaining S08 integration-test implementation. At that checkpoint the same review remained open for source repairs and actual proof. The historical pending states below are superseded only by the final scoped disposition, not relabeled as passing historical runs.

## Early source checkpoint — 2026-10-16 07:19 UTC

**Verified source; runtime closure pending.** Read the complete approved plan, current project state, team policy, reviewer role and relevant code review/security/TechNote skills. Review questions cover S06 expiry/extension/current authority/deletion graph/audit365/positive worker scopes/fences; S07 decoding/native limits/private originals/signed purpose/current eligibility/withdrawal/process-purge races/grants; S08 history/restore/head/unpublish/replay/cross-reference/SQL guards and website consumers.

Required effort: xhigh. A reviewer-role metadata check observed kit-reviewer, parent `01a1437b-7cd2-7b23-92ef-70226da96f3f`, inherited gpt-6.1-sol and xhigh, PASS. An initial invocation with the helper's default coordinator role returned FAIL because a child cannot verify a coordinator; this was an invocation classification error, not an effort mismatch. Parent authoritative metadata is separately recorded in `reviewer-runtime.json`. Effective enforcement beyond observed runtime metadata remains Unknown.

### Findings handed to owners

| ID | Priority | Condition, source and impact | Proposed correction and missing proof | Early checkpoint state |
| --- | --- | --- | --- | --- |
| R1 | P1 | Original0017 unpublish validated key presence but did not validate expected-version JSON types. Restricted tenant SQL with JSON null versions makes comparisons NULL and can delete the pointer without a version match. | Strict typed positive integer validation before effects; test null/string/missing/overflow commands and unchanged pointer/head/event/receipt. | Forward0018 source inspected: strict validation added. Runtime regression pending. |
| R2 | P1 boundary question | Original0016 require_tenant used transaction-time membership without canonical current actor/tenant/membership locks. Direct restricted SQL or lock waiting could differ from HTTP current authority. | Delegate to canonical authorize(p_tenant,true); prove stale/revoked actor/session/membership and inactive tenant denial. | Forward0018 source inspected: canonical authorize delegation added. Runtime regression pending. |
| R3 | P1 | Original0017 public_reference_exists checked snapshot/pointer but omitted site.public_enabled and site/service slug_locked. HTML can become unavailable while direct public media still serves. | Same current site/service eligibility predicates on media; test current disabled site and direct derivative denial. | Forward0019 source inspected: matching predicates added. Runtime regression pending. |
| R4 | P1 | LeadWorkspace changed() used response-receipt Date.now() rather than request start for the server validity window. Slow command/extension responses under client clock skew can reapply expired private data. Command/retention compare responses also cached full lead data without their own validity window. | Carry conservative response timing through all applications, expire comparison data and reject late responses. Prove delayed command and compare responses spanning expiry do not display PII or reset privacy deadlines. | Repaired command/extension/compare source and independent unit checks close this implementation gap; browser proof and adjacent history timing remain pending. |
| R5 | P1 | Original0017 capture_revision returned when NEW.version=OLD.version. Existing tenant UPDATE grants permit direct content changes with the same version, producing no history revision and bypassing history/conflict evidence. | Enforce version+1 for canonical content changes, permit publication metadata-only updates with unchanged content/version; test direct same-version content denial and one revision per save/restore. | Forward0020 source inspected. The first source draft had an extra closing parenthesis; owner corrected it. Actual migration and direct SQL regression proof pending. |
| R6 | P1 | Decoder processor timer/finally awaited docker kill but ignored its exit status, then killed the Docker CLI. A failed kill or delayed container creation can leave native decoding running after the wrapper returns a timeout. CLI exit alone does not prove container termination. | Settle the exact newly owned container lifecycle and require stopped/absent after termination; test the actual wrapper timeout, late creation/failed initial kill and absence of a running decoder. | Handed to root; repair/proof pending. |

Source review identified the positive per-lead retention deletion allowlist, minimal deletion identity, cascading removal of private command/history children, explicit non-cascade graph deletion, and actual-I/O advisory locks for capture and media process/purge. These are source observations, not execution proof.

The root reported an initial decoder container spike FAIL caused by a stale build context lacking the entry ENV. Rebuild and new actual hard-limit proof are pending. This failure is retained and is not converted to PASS by Dockerfile inspection.

### Dependency assessment status

Sharp0.35.5 is now an explicit API dependency. Source applies byte, dimension, pixel and frame limits, full decode/re-encode, fresh raw-derived output and no metadata copy. Decoder execution requests a digest-pinned, non-root, no-network/read-only Docker container with memory/swap/CPU/PID/capability bounds and timeout settlement. Actual image/config/native limits and storage credentials remain runtime proof obligations.

Official sources inspected: [sharp constructor](https://sharp.pixelplumbing.com/api-constructor/), [installation](https://sharp.pixelplumbing.com/install/) and [v0.35.5 release](https://github.com/lovell/sharp/releases/tag/v0.35.5). Constructor guidance supports warning-level rejection for untrusted input and explains that the pixel guard trusts metadata; therefore the independent container hard bounds remain necessary. This is not a dependency audit PASS. Fresh native audit and final built exposure assessment remain pending. Existing braces FAIL/open and reassessment2026-10-22/earlier dependency, exposure or production triggers remain.

### Verification limits

No product runtime, authenticated browser, DB deletion, S3 policy, decoder-container hard-limit or production PASS was produced by this early source review. Owner test source and UI handoff were inspected; those are not reviewer execution results. Final source review follows root integration and relevant evidence. Human M2 acceptance remains separate.

Reviewer executed bounded pure checks after the R4 repair source arrived:

```text
./node_modules/.bin/bun test apps/admin/lib/lead-response.test.ts apps/admin/lib/retention-input.test.ts apps/api/test/s07-security.test.ts apps/api/test/s06-input.test.ts apps/api/test/s08-input.test.ts
PASS: 19 tests, 0 failures, 73 assertions, 5 files; Bun1.4.3.
```

These checks verify input/signature contracts and controlled response timing logic, including the reproduced old receipt-time admission. They do not verify browser rendering/clearing, PostgreSQL mutation, storage policy or actual decoder termination. R4 command/extension/compare implementation gap is closed by source review and these scoped tests; browser proof remains pending. Lead history has a related open timing question: its response originally carried no current serverTime/validUntil, so an older parent detail deadline can miss a newly shortened deadline from another administrator. Root owns the canonical contract and affected runtime proof.

### Dated source hashes

SHA-256 sampled2026-10-16 07:19:15 UTC. Owners were still integrating; hashes identify this checkpoint only.

```text
557d3268481685050ac0fa396d110440164de27ed6c1685576b23d126753440e apps/api/migrations/0015_s06_retention.sql
7d57b1ebdf0523371791fae4ba13c8c68a7cda169e2891753d8700e430489d09 apps/api/migrations/0016_s07_media.sql
f4b7d9df09c1df0e467354fbfc45156f63dc75dfa9d3ba15f92a15ab6ea622c6 apps/api/migrations/0017_s08_editorial.sql
cb50e5e40257f7c486b385ff8203ae132f83c4b45ce564700eea02e95715c5c1 apps/api/migrations/0018_m2_sql_boundary_repair.sql
986e9553df3447e54a03f3e3c5c98b43b0a0d61ca96d915e72d589ce66a4d994 apps/api/src/modules/retention.service.ts
d928b5588e12f972fdb16574b374cae8b9b470a71e8c8757627024e3ad4ce32e apps/api/src/modules/media.service.ts
b6708105ba6c1e84ed8e88e1ab6056ebcf83e3dc4d9325ea9d4a9237886c00ff apps/api/src/modules/publication.service.ts
4172a10efd5af7db19de6c148d498621c2b090b5da128634497fffaf18254b54 apps/api/src/media/decoder.ts
6ffbe96a6e435fba3d7b15e4440259885156400216ffe955763fea94f3f83384 apps/api/src/media/processor.ts
e334d2d67dd123dbd25afbbce857142cea38f924dc63f44ddcceab4f3eb06374 apps/api/src/media/storage.ts
938b64cbf29c803c941b22272640c5b7c56c538b37c7db81d7492d05e323ac45 apps/api/src/worker/retention-worker.ts
58d50da481714d4cd57b9dc14cd06677aec0a3bf2f0b1af0fff94fd07a9b5425 apps/api/src/worker/media-worker.ts
```

## Resumed source and evidence review — 2026-10-16

Root resumed this same bounded reviewer after integration. Native role/parent/model/xhigh metadata remains applicable. Current assignment permits source/dependency/evidence inspection and this record; root later explicitly authorized copying the sanitized audit payload to `audit.json`. No DB, Docker, process control or escalation by the reviewer. Owners continue S06/S07 repairs; interim failures remain historical evidence, not a final verdict.

This section records an intermediate checkpoint. Its pending items are superseded by the final disposition below where actual proof is identified.

### Current findings and evidence

- **R1 and R5:** source repairs in0018/0020 now have actual scoped API/SQL evidence in `s08-checks-1792135904536.json`:11 tests/276 assertions PASS. Inspected tests include null/missing/string/fractional/overflow unpublish versions with unchanged state, immutable history/events, same-version and skipped-version content denial, metadata-only updates, restore-only-draft, idempotent unpublish and historical-pointer reinsertion denial. These scoped source/SQL findings are resolved. Browser acceptance remains separate.
- **R2:**0018 delegates media current authority to canonical `gcms_s05.authorize(p_tenant,true)`. Existing AUTH/helper proof remains reusable within unchanged controls. Full S07 runtime suite is still being repaired; current media success/denial evidence remains bounded by that run.
- **R3:**0019 applies the same active tenant/site/public-enabled/slug-lock predicates to derivative references as page reads. The S07 suite now contains the matching disable-site and cross-tenant-reference case. Its actual final pass is pending because the earlier media run failed before completing the dependent ready-asset journey.
- **R4 and history adjacency:** repaired API history now returns current serverTime/validUntil. FE captures each history request start, retains the earliest accumulated deadline, rejects late pages and clears private parent/history/dirty state on expiry. Reviewer independently ran `bun test apps/admin/lib/lead-response.test.ts apps/admin/lib/retention-input.test.ts`: **PASS12 tests/34 assertions**, including the A2-shortened history window. Root's actual S06 runner `s06-checks-1792136411794.json` reports **PASS12 integration tests/236 assertions +7 pure tests/46 assertions**; the inspected integration case confirms history timing follows shortened and extended effective expiry. Rendered browser proof remains separate.
- **R6:** inspected the repaired create-only/exact-ID+nonce lifecycle, actual isolation verification, bounded kill+inspect retries, confirmed-stop/absence and explicit `DecoderSettlementUnknown`. Actual lifecycle evidence in `s07-checks-1792136288207.json` and its private test log reports **PASS4 tests/17 assertions**. The integration review then found that ordinary worker retry could lose the Unknown state. Current0024 source adds durable `worker_scope.native_blocked`, a failed `decoder_settlement_unknown` result, claim/start denial for fresh native work, generic process-retry denial, and owner-only unblock after exact cleanup. Worker persists the latch before rethrowing and releasing its asset lock. Purge remains possible because the native decoder has no storage credentials. Actual0024 application and the new durable-latch integration regression are pending; R6 is not fully closed yet.

R6 recovery correlation is also **Unknown**: the generic settlement error does not yet expose/persist the exact created container ID/name/nonce beside the failed tenant/job. The lifecycle test runtime owns that mapping, but its fixture cleanup does not prove a real operator recovery path. Proposed bounded repair/handoff: retain non-secret owned-container identity in a runtime receipt or diagnostic before/with the settlement failure. Until that exists and exact cleanup is observed, do not infer manual unblock success or stop arbitrary decoder containers. Root/media owner received this limitation.

**R7 — P2, immutable page/cover consistency:** the first integrated API read used two separate SQL statements for page and current cover. A concurrent publish could pair page P1 with cover P2, which the website contract would reject as invalid. Root replaced this with one MATERIALIZED SQL statement whose STABLE contracts share a PostgreSQL statement snapshot. Source now preserves a coherent immutable page/cover pair. A controlled concurrent-publication runtime regression remains pending. Owner: root with media test owner.

[PostgreSQL18 function volatility documentation](https://www.postgresql.org/docs/18/xfunc-volatility.html) confirms that SQL STABLE functions use the calling query's snapshot. This supports the source-level snapshot reasoning; it does not replace the planned runtime regression.

Forward0021 refreshes the S06 claim clock after scheduling newly inserted jobs. Forward0022 gives public cover metadata a narrow current-publication contract rather than ambient tenant RLS access. Both were source-inspected. S06 actual runner is now PASS within its recorded scope. S07's earlier2-pass/10-fail actual run remains preserved in `s07-checks-1792136288207.json`; the media owner owns that diagnosed repair and final rerun.

### Fresh dependency and exposure assessment

**Fresh native audit result — FAIL:** reviewer invocation `./node_modules/.bin/bun audit --json` exited1 with `DNSResolveFailed`; it produced no advisory payload, and no escalation was attempted. Root subsequently obtained an actual reachable native audit, exit1, stored privately as `.local/m2-audit.json` at2026-10-16T07:39:53Z. Reviewer inspected that payload: exactly one high `braces` advisory, GHSA-vfj7-8cjw-p6xm, affected<=3.0.3. Payload SHA-256: `5a9adf8fbbd2a854066d8ebb81515723fc033927c4bcee0f7ed3ea13b300efba`. Under root's explicit evidence authorization, the sanitized payload is copied to [audit.json](audit.json); parsed JSON equivalence was checked and passed. This evidence supersedes the connectivity limit for known-advisory enumeration; it does not turn audit FAIL into PASS.

Read-only HEAD/current lockfile comparison confirms551 unique package-version pairs on each side, with **zero added or removed package-version pairs**. M2 adds the exact direct API edge to existing sharp0.35.5. Remaining lock changes hoist/deduplicate versions already present, including semver6.3.1/7.8.5 and @emnapi/runtime1.10.0/1.11.3. No automatic dependency upgrade was performed by this reviewer.

Current code import scan finds sharp only in the isolated decoder source. Its direct dependencies are @img/colour, detect-libc and semver; the braces advisory chain is not introduced by sharp. Root/decoder installation blocks lifecycle scripts with frozen lockfile/ignore-scripts. Decoder context copies explicit manifests, lockfile and required source files, not private configuration. Source gives the decoder no storage credentials, network, writable root or host mounts. Actual wrapper/config/termination evidence is bounded as described under R6.

The decoder Dockerfile currently installs the workspace dependency tree, including development dependencies. Therefore this assessment does **not** claim that braces is physically absent from the decoder image. The relevant local exposure finding is that the decoder entry/import path and image input do not invoke the glob/advisory chain. Zero Next trace references prove only that bounded frontend trace result.

Current built trace sample: **34 Next traces (27 admin,7 website), zero braces/micromatch/fast-glob/@next-eslint-plugin/eslint-config-next chain references**. Current lock SHA-256: `b7c7780fda50d2b148437bd3d89f5078f94c0d08c194f04a94b60e4d582b6553`. Lint receives fixed local source patterns; application input does not reach that advisory chain. Recheck the trace sample if relevant frontend/dependency build inputs change before final handoff.

Fresh official sources checked2026-10-16:

- [Braces GHSA](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): patched-version field remains None.
- [Sharp librsvg advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w): affected<0.35.5;0.35.5 is patched.
- [Sharp libheif advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c): affected<0.35.4.
- [Sharp libvips advisory](https://github.com/lovell/sharp/security/advisories/GHSA-f88m-g3jw-g9cj): affected<0.35.0.
- [Sharp libwebp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-54xq-cgqr-rpm3): affected<0.32.6.
- [Sharp security guidance](https://sharp.pixelplumbing.com/security/): untrusted decoding requires safety checks and resource limits. Source retains warning-level rejection, finite pixels/channels defaults and no unlimited mode. Inspected installed macOS prebuilt metadata reports rsvg2.63.2/heif1.23.5/vips8.18.7/webp1.6.0; this is not a fresh Linux binary-version inspection.

**Independent disposition:** the fresh source/audit/trace evidence supports a bounded **local-M2 deferral** of the existing braces advisory. Audit remains FAIL/open. This is a fresh assessment, not inherited S05 or production authority. Desktop owns reassessment by **2026-10-22**, or earlier on patch availability, dependency/exposure change or before production. No reminder automation, upgrade or production waiver follows. R6 operational proof and remaining M2 criteria remain independent obligations.

`storage-bootstrap.json` was inspected: scoped own-object read/write, filtered/denied enumeration, cross-bucket403 and unsigned403 PASS. Its control object was not created because existing local volume capacity was exhausted; no old resource/configuration/capacity change is claimed. This bootstrap proof does not replace the actual process/purge/storage-fault integration criteria.

### Resumed source checkpoint hashes

Sampled 2026-10-16T07:47:29.995329+00:00. This identifies reviewed source while owners finish runtime proof; it is not a final closure pin. Re-review only relevant changed inputs.

```text
557d3268481685050ac0fa396d110440164de27ed6c1685576b23d126753440e apps/api/migrations/0015_s06_retention.sql
7d57b1ebdf0523371791fae4ba13c8c68a7cda169e2891753d8700e430489d09 apps/api/migrations/0016_s07_media.sql
f4b7d9df09c1df0e467354fbfc45156f63dc75dfa9d3ba15f92a15ab6ea622c6 apps/api/migrations/0017_s08_editorial.sql
cb50e5e40257f7c486b385ff8203ae132f83c4b45ce564700eea02e95715c5c1 apps/api/migrations/0018_m2_sql_boundary_repair.sql
d637e6ef4cdd429466d3e714ca9df1968dc7d0659bf3c853f2b87339a76b58b3 apps/api/migrations/0019_s07_public_reference_eligibility.sql
09ad831e81bbed43b2d3f2a74d617b7e9993c6ead02056f44b2ac79e3bff2fa6 apps/api/migrations/0020_s08_history_version_guard.sql
08a6b1d65ca9f3d4e4a9780b2d8fc711268621121d520bb1c07e155608e9f240 apps/api/migrations/0021_s06_claim_scheduled_jobs.sql
86d079fbee64b94607a65ce56df094b5dbe89a8af449470c08bd789795fc435e apps/api/migrations/0022_s08_public_cover_contract.sql
5818e4c43107fc0e7042572379c0eacec0953017dacd8d2e4475275f1ab72a8b apps/api/migrations/0024_s07_worker_current_claim.sql
2839bb95f275300d50065f59956e216cf99b95488281859ff4dc0dac5f5d36ca apps/api/src/modules/publication.service.ts
d3fe5065c8306c20989bd14dbad528e237023762ca1d878038e73834b8de0344 apps/api/src/modules/leads.service.ts
d928b5588e12f972fdb16574b374cae8b9b470a71e8c8757627024e3ad4ce32e apps/api/src/modules/media.service.ts
a7d95e8203ec26f4f659d743eb206eb90538fe5fda56d3e98b2844a0def4f684 apps/api/src/modules/retention.service.ts
fcf7530b7119e50d2da3bf3cdb559023ff0e5b872dc957c02e0d8cab38b90bcd apps/api/src/media/processor.ts
bb3d506462a0e1cb851738df2f0f0c35a84db6d04ac88529a6be4ab95329a108 apps/api/src/worker/media-worker.ts
938b64cbf29c803c941b22272640c5b7c56c538b37c7db81d7492d05e323ac45 apps/api/src/worker/retention-worker.ts
154778427f3f6d11fc4e5e1e4639e79ee26f61678be72a62c073dbb55143ba24 apps/admin/lib/lead-response.ts
2879ed1a5d131c7259de6d477dd7944f5362c9c558adaad3cc5262686a89e164 apps/admin/components/lead-history.tsx
0f0b6acc490405c24f270636f4fb23e6fc10f0269cc1ad2f228ec137a23efec6 apps/admin/components/lead-workspace.tsx
42acd985f0b1ece198049b1fcf3fade8e6b245dc0db355e11ef4353eca21288e apps/website/lib/public-service.ts
707587f7cfa60ecaf2f8fbff04f5cf1c04313d38579b940adc3e1942383fbcc9 apps/website/app/[tenant]/dich-vu/[slug]/page.tsx
b7c7780fda50d2b148437bd3d89f5078f94c0d08c194f04a94b60e4d582b6553 bun.lock
```

## Final bounded disposition — 2026-10-16

**CLOSED within assigned source/runtime scope.** Reviewer rechecked the changed boundaries and actual final evidence. No open actionable finding remains from R1–R7. This is independent review closure, not human M2 acceptance, a claim that all defects are absent, an audit PASS or production readiness.

The final native metadata check passed: kit-reviewer, expected parent, inherited gpt-6.1-sol, exact xhigh; turn `01a143b9-4453-7f53-8f79-b928b95e9415`. This verifies recorded configuration, not hidden reasoning or effective permission enforcement.

| Finding | Final result and actual supporting evidence |
| --- | --- |
| R1 — SQL unpublish input | **Resolved.** Forward0018 strict shape/type/range checks retain pointer/head/event/receipt on invalid commands. Latest S08 input/API/SQL report `s08-checks-1792137528582.json` passes2 input tests/7 assertions and12 API/SQL tests/295 assertions. Invalid null/missing/string/fractional/overflow versions are explicitly exercised. |
| R2 — Current media authority | **Resolved.** Forward0018 calls canonical current authorization before media commands. Final S07 actual HTTP/SQL suite passes tenant/Platform/CSRF boundaries and signed current-session/sign-out denial. The unchanged canonical AUTH/helper evidence is reused within its original scope. The filtered launcher and startup credential rejection are separately source- and test-verified. |
| R3 — Media/page eligibility | **Resolved.** Forward0019 and narrow public-cover contract use current tenant/site/slug/pointer eligibility. Final S07 actual suite exercises disabled-site derivative denial, shared-admin cross-tenant reference denial, private original/cover access, withdrawn-token denial and public block redaction. Actual browser `ui/s07-media.json` records decoded private/anonymous cover, publication, withdrawal denial and redaction with no errors. |
| R4 — Late private responses and history | **Resolved.** Request-start deadlines are retained across commands/extensions/comparisons/history, with earliest accumulated history expiry and disposal of private/dirty UI. Actual `ui/s06-privacy.json` completes with dirty modal closed, expired selected row/input removed, held history delivered but not applied, and no automatic recovery before Enter; Enter caused a new successful request. S06 history timing API case and controlled response tests pass. |
| R5 — History version integrity | **Resolved.** Forward0020 rejects content edits without the next version and rejects skipped versions, while allowing metadata-only slug locks. Latest S08 actual suite proves immutable history/events, draft-only restore, replay/conflict/rollback, source preservation and historical-pointer denial. New different-publisher regression verifies a current A2 can publish without rewriting already locked site content/history. |
| R6 — Decoder settlement and recovery identity | **Resolved.** Actual Docker lifecycle4 tests/20 assertions prove timeout/failed first kill/late creation handling and exact frozen container identity on Unknown. Forward0024 and real PostgreSQL tests prove durable native blocking before lock release, no fresh claims or generic retry after restart, safe purge, and no continuation when receipt writing fails. The private0600 receipt correlates exact ID/name/nonce/error with tenant/job/asset/fence; it contains no decoder message or credentials and does not authorize cleanup/unblock. Actual real-daemon operational recovery remains a distinct operator action; failure is never reported as settled success. |
| R7 — Coherent public page/cover | **Resolved.** Both STABLE public contracts execute in one MATERIALIZED SQL statement snapshot. Final S07 controlled race commits a different publication after the first read returns from PostgreSQL: first response retains its complete old page/cover; next response has the complete new page/cover. No mixed pair is accepted. |

Inspected actual suite summaries:

- `s06-checks-1792136411794.json`: **PASS19 tests/282 assertions** total;12 actual integration/236 assertions plus7 pure/46 assertions.
- `s07-checks-1792137448381.json`: **PASS35 tests/456 assertions** total; worker environment1/3, security7/73, decoder8/39, actual Docker lifecycle4/20, actual HTTP/PostgreSQL/S3/worker15/321. No failures or skips.
- `s08-checks-1792137528582.json`: **PASS14 tests/302 assertions** total;12 actual API/SQL/295 plus2 input/7. No failures or skips.
- Selected S05 evidence retains passing pure9/110, lead9/153 and worker8/162 suites in `s05-checks-1792136926720.json`; its overall FAIL is preserved because that run's races beforeAll failed. Latest standalone `s05races-checks-1792137383727.json` passes7/119. Redacted `session-diagnostic.json` confirms normal A1/A2 HTTP sign-in/session success; the earlier beforeAll causes remain Unknown and are not rewritten as auth fixes or passing historical runs.
- Reviewer independently ran `./node_modules/.bin/bun test apps/api/test/m2-worker-environment.test.ts apps/api/test/s07-security.test.ts apps/admin/lib/lead-response.test.ts`: **PASS16 tests/97 assertions**, Bun1.4.3. These are scoped pure/security/temporary-fixture checks; the reviewer did not rerun DB/Docker/browser suites or control runtime processes.

Rendered evidence inspected: actual JSON for S06 extension/privacy/Enter recovery, S07 media journey and S08 editorial journey; representative `s06-expiry-after.png` and `s07-public-cover.png` pixels. The remaining valid lead in the expiry screenshot is correctly a different identity. `ui/final-visual.json` records15 stable capture states across320/390/768/1024/1440 with no errors, page overflow or controls outside the checked containers. This reviewer did not visually inspect all15 final captures; the FE owner's final template-fidelity disposition remains separate. Screenshots/geometry do not prove every UI state.

`preservation-1792137501003.json` is PASS:31 retained-table projections match original columns;178/180 private files are unchanged, with only explicit launcher-metadata replacement and prefix-verified live-log append;487 protected files match. This proves the recorded retained projection/file boundaries, not restoration from backup or all possible volatile-session history. Root separately reports3 credential invariants preserved. Prior failed evidence remains preserved as failed evidence.

### Final dependency/trace disposition

Fresh local-M2 braces deferral above remains valid. Actual native audit is **FAIL, one high advisory**, not a passing gate. Lock SHA-256 remains `b7c7780fda50d2b148437bd3d89f5078f94c0d08c194f04a94b60e4d582b6553`. Refreshed final built traces: **34 (27 admin+7 website),0 advisory-chain references**. Sorted path+file-hash trace-set SHA-256: `1ffc019ef20a45972e831cf82919a5cb6e9e679b5c834bda6827ffd20250b5e5`. The decoder image still contains workspace development dependencies; no physical package-absence claim is made. Untrusted image input does not reach the braces glob path.

Reassess by2026-10-22 or earlier on patch/dependency/exposure change and before production. No upgrade, reminder automation or production waiver was performed or granted. Source/trace changes that affect a finding invalidate only the affected conclusion, not every unrelated result.

**Remaining outside this closed review:** root task/runbook/current-record integration and FE full final visual inspection; human M2 acceptance; operational backup restore and production/DNS/TLS/provider/deployment/Git delivery. Natural long-duration waiting is not claimed; retention timing uses newly owned controlled fixtures without system-clock changes. Existing historical FAIL/NOT_RUN limits remain.

### Final source and evidence hashes

Sampled 2026-10-16T08:05:07.662193+00:00. These pins identify the bounded inspected source and final evidence. Documentation-only root integration can continue separately. If an implementation input changes, re-review the affected conclusion.

Source manifest (38 files), SHA-256 `42553d13860371b2929e020f186e3f4d8cd651cb56486e8653ef00d7fc588ac4`:

```text
2879ed1a5d131c7259de6d477dd7944f5362c9c558adaad3cc5262686a89e164 apps/admin/components/lead-history.tsx
0f0b6acc490405c24f270636f4fb23e6fc10f0269cc1ad2f228ec137a23efec6 apps/admin/components/lead-workspace.tsx
1a4afaeece4f2ca0c2f181b97875e5e9d44f9488eebacf70e24f49e8c244fed4 apps/admin/components/use-retention-deadline.ts
85ffd05cb6461e71741360eb39e4075e58b71ddfb73ab81946b5fb0fb6608eb1 apps/admin/lib/lead-response.test.ts
154778427f3f6d11fc4e5e1e4639e79ee26f61678be72a62c073dbb55143ba24 apps/admin/lib/lead-response.ts
557d3268481685050ac0fa396d110440164de27ed6c1685576b23d126753440e apps/api/migrations/0015_s06_retention.sql
7d57b1ebdf0523371791fae4ba13c8c68a7cda169e2891753d8700e430489d09 apps/api/migrations/0016_s07_media.sql
f4b7d9df09c1df0e467354fbfc45156f63dc75dfa9d3ba15f92a15ab6ea622c6 apps/api/migrations/0017_s08_editorial.sql
cb50e5e40257f7c486b385ff8203ae132f83c4b45ce564700eea02e95715c5c1 apps/api/migrations/0018_m2_sql_boundary_repair.sql
d637e6ef4cdd429466d3e714ca9df1968dc7d0659bf3c853f2b87339a76b58b3 apps/api/migrations/0019_s07_public_reference_eligibility.sql
09ad831e81bbed43b2d3f2a74d617b7e9993c6ead02056f44b2ac79e3bff2fa6 apps/api/migrations/0020_s08_history_version_guard.sql
08a6b1d65ca9f3d4e4a9780b2d8fc711268621121d520bb1c07e155608e9f240 apps/api/migrations/0021_s06_claim_scheduled_jobs.sql
86d079fbee64b94607a65ce56df094b5dbe89a8af449470c08bd789795fc435e apps/api/migrations/0022_s08_public_cover_contract.sql
5818e4c43107fc0e7042572379c0eacec0953017dacd8d2e4475275f1ab72a8b apps/api/migrations/0024_s07_worker_current_claim.sql
11401517c2fe1c55fbf40ceb4bb0d919f51355dc1c1ff7442be333d0ca03a556 apps/api/package.json
05c003816e2f2370aea3e03f3f7973ab1515aca869bb41eb511e9572105f9b42 apps/api/src/media/Dockerfile
4172a10efd5af7db19de6c148d498621c2b090b5da128634497fffaf18254b54 apps/api/src/media/decoder.ts
9386ad93b2e1f3a4f2a13c5a327b235867c50127d588f8d8e8a793fbcf69323c apps/api/src/media/input.ts
4e18d655ec88a10517ddbcbf4728f91d12a18e182fa21706e1b6cd4cc78fee5e apps/api/src/media/processor.ts
750522eb263c8aef03c5a95b3fc3bfa78b90bae512cc0cf108932690b6ac8232 apps/api/src/media/signing.ts
e334d2d67dd123dbd25afbbce857142cea38f924dc63f44ddcceab4f3eb06374 apps/api/src/media/storage.ts
d3fe5065c8306c20989bd14dbad528e237023762ca1d878038e73834b8de0344 apps/api/src/modules/leads.service.ts
d928b5588e12f972fdb16574b374cae8b9b470a71e8c8757627024e3ad4ce32e apps/api/src/modules/media.service.ts
70792aedb2362cc1bbc5cf62f2993010a3ea06e326b58bbd523c6164f3c01801 apps/api/src/modules/publication.service.ts
a7d95e8203ec26f4f659d743eb206eb90538fe5fda56d3e98b2844a0def4f684 apps/api/src/modules/retention.service.ts
380b3bb3365d96e153dd3e21688e0e5f4b50934d2bc4ab63bb8edbd6d4d23c1f apps/api/src/worker/media-environment.ts
b8f32ab3dbcd0f1920ee8183bb8e50467d5d6484e20e4a6da8216d3e21b6b11b apps/api/src/worker/media-main.ts
4f37867912370a6141afb100be2599d9ba5f74404e5e47f245509b5b3ca0e34a apps/api/src/worker/media-recovery.ts
324eb7ce0d033ac740f9ec02b08297f405e7f887c568c330c8195f7b99bd4dae apps/api/src/worker/media-worker.ts
938b64cbf29c803c941b22272640c5b7c56c538b37c7db81d7492d05e323ac45 apps/api/src/worker/retention-worker.ts
3902b192b5ea2fa238e73662b70c75cfc684a54612e708dc9a3af126dd674e81 apps/api/test/s06-retention-integration.test.ts
1072ff1379eaaa378ffb9d8e1bc198403a3c226ace726c69265c2f2f270c27ea apps/api/test/s07-container-lifecycle.test.ts
589edfd18da861056052ecff14d7e9aaa25c071c84d60d2e1bce0824ace74ef9 apps/api/test/s07-media-integration.test.ts
41f2ac2f62917a3ad352c17249e696e32785d843a81045dd3d88e6b8b62fd450 apps/api/test/s08-editorial-integration.test.ts
707587f7cfa60ecaf2f8fbff04f5cf1c04313d38579b940adc3e1942383fbcc9 apps/website/app/[tenant]/dich-vu/[slug]/page.tsx
42acd985f0b1ece198049b1fcf3fade8e6b245dc0db355e11ef4353eca21288e apps/website/lib/public-service.ts
b7c7780fda50d2b148437bd3d89f5078f94c0d08c194f04a94b60e4d582b6553 bun.lock
7b898ef614bf2709228b17a97aae06ef58c161a13b7149f3a3fbbe3847a7c88a scripts/start-m2-worker.ts
```

Final evidence manifest (9 files), SHA-256 `a80c17ac1b38179585e1ee01bdb660325225d637c7494c17eca2a404eb844e8c`:

```text
86d1ac7a1ef45ebe90fd8a58bfe081a2b8f5c4d223db820864ff0e40f618b9ce docs/evidence/m2/audit.json
03ecc20e13128617bfec441ee4bdde0fed387d68c1d634f29cda4af74a9ed981 docs/evidence/m2/preservation-1792137501003.json
68d613a2f92596caf9cd069c96ae789d5f1f820b309713252b187932c823dc31 docs/evidence/m2/s06-checks-1792136411794.json
1efeabd054a1aaa50b04ea60a70fa20186dfd5a1fb779c3332153f234a4d9c9c docs/evidence/m2/s07-checks-1792137448381.json
6a02ea07d15f14cef31eccd0a320c07270fe7d0b1c25b6cf3dab493a0bd8195e docs/evidence/m2/s08-checks-1792137528582.json
43b5bc929d19bf5175410e1bc55588efdaeb5b1911bd87556085eb4dbf72bb7a docs/evidence/m2/ui/final-visual.json
4d1b1a6912c02f889497e59ac044bce187717792ffddb042addef1e8570d44ab docs/evidence/m2/ui/s06-privacy.json
dd18d4530a4d37a405c881071f3f6c238a284245f9096b15cbb821f63ca6508b docs/evidence/m2/ui/s07-media.json
8f0164186a45960bc302993568979e40c80c91dcc07a5f1a603c51e7fb836d9e docs/evidence/m2/ui/s08-editorial.json
```

## Post-closure CSS and trace refresh — 2026-10-16

Sampled 2026-10-16T08:22:54.038137+00:00. Root requested only the tenant-choice wrapping rule and final trace refresh. R1–R7 closure stands; all38 final core source pins above still match. No application writes, DB/Docker/browser execution or broad new review by this reviewer.

**CSS source/exposure — CLOSED.** `apps/admin/app/globals.css:28` limits `.workspace-options .btn` to available width and permits long text to wrap. The selector targets existing tenant-choice links in WorkspaceGate; it changes presentation only. `ui/s06-denied-final.json` records complete/no errors,320/390/768/1024/1440 px with matching page width and every checked panel/link inside its bounds, plus focused link/Enter selecting the owned permitted tenant PASS. Reviewer inspected the saved320 px capture: the long synthetic tenant name wraps inside the button. Root reports the final full build PASS; this reviewer did not rerun the build.

**Refreshed exposure assessment:**34 Next traces (27 admin+7 website),0 references to the existing braces/micromatch/fast-glob/@next-eslint-plugin/eslint-config-next advisory chain. Current sorted path+file-hash trace-set SHA-256 is `6f4320a036d64005f63198b1c68a7184c91b4326f5efe9ed2553bc42ce6e8dc6`; this supersedes only the previous built-trace pin. No dependency/lock/core implementation input changed. Audit remains FAIL/high braces under the same fresh bounded local-M2 deferral, reassessment2026-10-22/earlier patch/dependency/exposure/before production. No package-absence or production waiver claim follows.

**Separate harness source/evidence reconciliation — CLOSED.** `lead-journey.json` records an actual PASS journey for one newly accepted synthetic lead, with private generic notice capture, explicit extension, expired detail/history denial and physical ten-table graph deletion. During this refresh the reviewer found a PATH allowlist mismatch. Root verified that a post-run cosmetic constant rename accidentally replaced the literal PATH; the actual executed source retained PATH. Root restored only that literal. Reviewer rechecked `scripts/m2-lead-journey.ts:85` and the unchanged environment selector: both retain PATH/HOME/TMPDIR/NODE_ENV plus the S06 worker credential key, consistent with the saved receipt. The source-only correction is independently verified; pre-rename execution provenance is root-verified. The exclusive owned manifest and original actual evidence remain preserved, without creating a second journey or rerunning DB/process work. Root final type/lint verification of the corrected harness is separate. No application finding or reopened R1–R7 follows.

Refresh input pins:

```text
f624c25540d6dde8be9928d9777f9b64203fe43d1fc6a8b45f144ec1ce2467cf apps/admin/app/globals.css
2dbbf5dea0cd6d63fea583ec3064e539fc8009afd00f42248e257ba7a82db88b apps/admin/components/workspace.tsx
9973cd2174b17da6f5893a181c6a281360379b96e279715f848338cb54c402e3 scripts/m2-lead-journey.ts
ddc8e2b3f553c3d5d1e39d762dd048effebbcdc47b1a6b3e58046197d72cc408 docs/evidence/m2/ui/s06-denied-final.json
d448fa482cb69ab23554646bd7b2d94c245603f3b4e8e2627360878636017a89 docs/evidence/m2/lead-journey.json
```

Current Next trace manifest (path:SHA-256):

```text
apps/admin/.next/next-minimal-server.js.nft.json:554468d19cd58853361a108ff270c10625ca4eec6d92a280a917b4fc37e1f333
apps/admin/.next/next-server.js.nft.json:16c6d9043e0903fa5ad3e95a98c6ae991d77f05f3d71fc4f284fde3c20d98acc
apps/admin/.next/server/app/_global-error/page.js.nft.json:67b495225843ef72b59054d43092100e100bdbb5ea3753bef166507f893f9e9c
apps/admin/.next/server/app/_not-found/page.js.nft.json:c7d417f6a1f5809ab37171fbf502ca42bb22614758053311951ccafb9b5af29d
apps/admin/.next/server/app/account/page.js.nft.json:fb44da8005c9230d9454c480067fc279b35d2d4a9f1ff30d2ec1b822f9304b07
apps/admin/.next/server/app/cms/[...path]/page.js.nft.json:88054dbb4c08064243824151672ab46acf2195053988201442bbd50cfa95455e
apps/admin/.next/server/app/cms/leads/page.js.nft.json:c5c87340e58fd24aba0e44ae2642fe1ebee179c432b6264c678268b339e2147a
apps/admin/.next/server/app/cms/media/page.js.nft.json:063e0eac4bcf62f99afd7114b29c7278003ea77551e7470e513b45baf9b1a732
apps/admin/.next/server/app/cms/page.js.nft.json:e1f1c7db11ca763279babc693bea6c425f33b0e266c0255114acb7b874813aae
apps/admin/.next/server/app/cms/services/[id]/page.js.nft.json:9c56e0248e535458e516d57a904d9e872abc81855b1b14ec65a07834abeb4ce2
apps/admin/.next/server/app/cms/services/[id]/preview/page.js.nft.json:0265f96cc769055ef4c1658943b603adde38697f52f838b123d1999b41c18d59
apps/admin/.next/server/app/cms/services/new/page.js.nft.json:1cc44aa75b0e6c979234eb041018c6672dbf1036ad7928e41926bda43e2f9a6e
apps/admin/.next/server/app/cms/services/page.js.nft.json:1aa615a9b5933fec37e5a11d74a4853701b5c980840b68314c200c1998170f21
apps/admin/.next/server/app/cms/settings/members/page.js.nft.json:39714d7ea4b0227a6a6eddfdcf83a1c8b0b4737a76efafd116a41f389fae3901
apps/admin/.next/server/app/cms/settings/notifications/page.js.nft.json:a2b329190436671082901dabc95c3bee0c57fddc916fe74b5e6b4a524958c31f
apps/admin/.next/server/app/cms/settings/page.js.nft.json:29daad057a9ad86fb0b31b948f76db602bfb594ff068a5d4183f1178ccfd272c
apps/admin/.next/server/app/cms/settings/site/page.js.nft.json:9a175b3b6a6275688ed89088f3bf993b8b0b667b00053628862c4136208473ef
apps/admin/.next/server/app/forgot-password/page.js.nft.json:b5bc6e564b26cd75d11cf2f8a90ac6f8b140fae1215ee20ac50beb9d1a05e9eb
apps/admin/.next/server/app/invitations/page.js.nft.json:f1aa6ae97371d84e536e0e15f2477f983ab3fe03bb4cb139bd49f215df203765
apps/admin/.next/server/app/login/page.js.nft.json:228dd1d483879e8193e4d668ccf4e1957f46bec8d1c6dfe432644dcc5e39816a
apps/admin/.next/server/app/page.js.nft.json:2b5181c989a54f4284038134dd532e75012f8b3a10ba8b990de31cad98e8bc6b
apps/admin/.next/server/app/platform/[...path]/page.js.nft.json:0edf1a3837fd3e304c176550c102950a3c3dd2ea81b7f81390c7db15861aa6d0
apps/admin/.next/server/app/platform/accounts/page.js.nft.json:ac6cddc54b2a1f596876763bd79fb75c99c3044abe20d5fef718d93a96e61cf3
apps/admin/.next/server/app/platform/page.js.nft.json:7ab519c436ec3e6937f055baf7a0fdc3c5edee827f61a1e4da3a4422447e6735
apps/admin/.next/server/app/reset-password/page.js.nft.json:b0c6cd10051b566a72bd7f5aac282cd4b59d89c99be9ae46c7b022ddad548308
apps/admin/.next/server/app/verify-email/page.js.nft.json:7342d743362049b028e3593e8f8fb493536d07e1038dbd88f88191a5a6b2ade4
apps/admin/.next/server/middleware.js.nft.json:2983414cfe98cd2701d97e7c4ab942a6607adce1a35176499dd9521fc04ad54f
apps/website/.next/next-minimal-server.js.nft.json:554468d19cd58853361a108ff270c10625ca4eec6d92a280a917b4fc37e1f333
apps/website/.next/next-server.js.nft.json:16c6d9043e0903fa5ad3e95a98c6ae991d77f05f3d71fc4f284fde3c20d98acc
apps/website/.next/server/app/[tenant]/dich-vu/[slug]/page.js.nft.json:bd6407b3639982cbdee446554799343f41f119c8632d388268faef3b1651b262
apps/website/.next/server/app/_global-error/page.js.nft.json:d729a607df07134525f9bb09d610c3c6de83596c6127cf09cf622dcc4b96aeec
apps/website/.next/server/app/_not-found/page.js.nft.json:3a70bc94ff02889d9b5da8ead163d0a1f4effc2cbbfb3ab8e4ba191ea78d3c15
apps/website/.next/server/app/page.js.nft.json:75f11806dfc9747e762f6004a77fe1e29830a86b96395584d6499d81e9dd10e3
apps/website/.next/server/middleware.js.nft.json:d452d35f1ad004cbf2c2e9909eecf1265df9829d91fc26479739e6fd2e9f7e10
```

Refresh reconciliation completed 2026-10-16T08:23:20.305422+00:00. Prior core source pins and audit FAIL/local deferral limits remain unchanged.
