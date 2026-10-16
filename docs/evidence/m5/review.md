# M5 independent source review — 2026-10-17

Reviewer: native `/root/m5_review`, kit-reviewer thread01a14595-8e3f-7602-a4e5-d536b981b075; actual inheritedgpt-6.1-sol/xhigh/parent role checks are in the timestamped native evidence. Root records this handoff; reviewer changed no files. No R numbering was assigned.

## Findings and disposition

All identified source findings are CLOSED within the reviewed scope:

| Finding | Source closure |
| --- | --- |
| Caller-manufactured domain verification | Forward0054 requires owner-only expiring attestation, rejects caller proof and revokes the former callable body/ACL seam. |
| Incomplete deletion private-read fence | Forward0055 covers13omitted private tables and three read/authorization helpers; own global identity access remains available. |
| Suspended legacy reads denied | Four DomainService reads use withReadTenant; inspected mutations retain active/live guards. |
| Metadata paths rejected by entry parser | Exact sitemap/robots paths admitted; parser/proxy/installed-Next-adapter cases added. |
| Custom entry navigation with Godent primary | Navigation and forms use absolute current-primary URLs. |
| Pending primary had no recovery control | UI exposes verify-local while retaining configured primary identity. |
| Failed deletion showed unusable execute button | New execution controls require confirmed, unstarted deletion. |
| Stale readiness in verification response | Forward0058 recomputes the view after linking protected attestation, preserving receipt fields/ACL/OID/auth/replay. |

Initial reviewer pure checks47PASS/344assertions/nine files; repair checks59PASS/542assertions/12files. These overlap final root suites and are not added to their totals. Reviewer inspected root-owned focused0058evidence1PASS/17assertions with three unrelated cases filtered, without rerunning the DB.

Deletion-test source safety PASS: both explicit opt-ins, owned0600manifest, exact new Deletion fixture/name/slug, scope enrollment, immediate pre-execution checks, scoped storage object identities, no reset,36private SELECT surfaces,71business-table graph assertions and preserved audit/global credentials/A+B digests. Root subsequently executed1PASS/333assertions. Reviewer did not execute the DB, browser or workers; those modes are NOT_RUN by reviewer.

Final reviewed SHA-256 pins:

- 0055: `865f6b358677e084cccfd623fa16a704195e490df058d4ba4b89c859f92c007f`
- 0058: `2bd8c9cc6dff98471fb934b629c0796fbfab15bfda1766669f23d30d7fb3373a`
- Deletion test: `d13e531f6bf32d469e49a53b99a6fb497ac41f20d9f0510f2340ba86e0479f78`
- Focused lifecycle test: `46fc0f0408ebb35592f2a12350caf2d1ae2b78d81d30721b7065b4d15dde3a1f`

The later S18 B-only gap test is root-reviewed/runtime-verified and outside this completed independent source review. It changed no application code. Later read-only UI helper/static repairs, runbook/current records and package aliases are root integration work; they do not extend the independent review claim.

## Fresh dependency disposition

Native audit remains **FAIL/open**, highbraces3.0.3. Reviewer checked the [official advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): no patch listed. Dependency versions/workspace membership/lock remain unchanged; later root package edits add script aliases only. Chain: dev eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces.

| Current build | Fresh reviewed exposure |
| --- | --- |
| Admin2Oi7ckr5DWDg32fqJlDDR |29Next traces/5513references; zero advisory-chain references; trace aggregate8160dd85c614f7c1926eb7154d1fdeed32c167db44d729dce18b6f8023c1e3d7 |
| WebsiteXKbZmddv6fbA50oGKeQxX |16Next traces/3174references; zero chain references; trace aggregatef019e270a5fa86d5c3db69fde26ccfcf22942c7bb59336159e0c11d57357a16d |
| API |82JavaScript files/zero chain literal imports; aggregate40506a2c7b0fd19be84560470c24c36dfa0eca4dc5324791d72563c5dba9f267 |

A fresh bounded **local M5** deferral is supported at these pins. Reassess2026-10-22 or earlier patch/dependency/exposure changes, and before Production. No Production waiver. Zero trace references is a scoped exposure observation, not proof that no dependency vulnerability exists.

Root owns final integration, runtime result/preservation reconciliation and human acceptance handoff. Historical FAIL/Unknown/NOT_RUN remain. No live DNS/TLS, external delivery, operational backup/restore or Production/AC-09 proof follows.
