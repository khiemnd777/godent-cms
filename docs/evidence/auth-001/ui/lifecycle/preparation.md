# Bounded AUTH lifecycle UI helper

**Prepared; browser execution NOT_RUN.** The coordinator assigned only the new private helper/checkpoint and this evidence subtree. Primary UI resources and common UI driver are read-only. No application, migration, account, tenant, lead or browser changes occurred during preparation.

Runtime effort check PASS for test-development with authorization/tenant-isolation risk floors: native kit-implementer, model gpt-6.1-sol, required/requested/observed xhigh, child01a142fd-b53b-72a0-9dd1-bb7fdc66f45c, parent01a1402c-3c81-7933-9927-d974f70c9fbc, current turn01a14317-7e74-7e91-b96a-50a5e6648fd0.

Coordinator command after explicit worker checkpoint release:

```sh
node_modules/.bin/bun --no-env-file .local/auth-001-data-ui-lifecycle.ts --local-auth-001 --worker-checkpoint-pass
```

Preconditions: worker local-capture result PASS; primary UI resources contain exactly the new verified Owner and Peer with A/B memberships and exactly three identified B leads; the helper's own checkpoint/result do not exist. The helper refuses blind replay of a partial run. A failed phase requires read-only diagnosis and a bounded continuation from confirmed private checkpoints.

The ordinary UI sequence revokes Peer from A, checks A private content clears while B remains available, checks sole Owner A self-revoke and platform global disable both return409, then globally disables Peer and checks old session/password denial. Only after those guards does the helper create one new Recovery account, verify local email, accept A, open two private sessions, request reset, change to a distinct persisted password, and prove old-session/old-password/token replay denial plus new-password access.

The helper uses fresh installed Chrome contexts with the existing common launcher, no existing profile/cookies/CDP/downloads. Each invitation/reset URL gets a new Page. Two reset forms open while the token is valid; after the first form consumes it, the second ordinary form must return400. Installed Better Auth redirects a freshly opened consumed link to INVALID_TOKEN, so reopening it after consumption would not exercise the POST replay criterion.

Private checkpoint: `.local/auth-001-data-ui-lifecycle-resources.json`, mode0600. `identities[0]` has the exact common Recovery shape: label/name/email/password/userId/registered/verified/memberships. Recovery remains A-only. The identity password updates only after confirmed reset success; pending/old passwords remain private in the reset checkpoint. Owner/Peer observed state is separate. The frontend owner merges only the final Recovery identity into primary resources after actual PASS.

Public evidence contains phase/assertion flags, counts and HTTP status codes. It excludes credentials, reset/invitation tokens and raw errors. Screenshots capture cleared auth fields, reset completion or denied private pages.

Actual preparation checks PASS:

- `node_modules/.bin/bun --bun tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck --esModuleInterop --allowImportingTsExtensions --types bun,node .local/auth-001-data-ui-lifecycle.ts .local/auth-001-ui-driver.ts`
- `node_modules/.bin/bun --bun eslint --no-ignore .local/auth-001-data-ui-lifecycle.ts --max-warnings 0`

Runtime UI, database behavior and human acceptance remain separate and NOT_RUN by this child.

## Minimal final-login continuation

The coordinator executed the initial helper. Its immutable `result.json` retains FAIL after19confirmed checkpoints, including both last-admin409 denials, Peer revocation/disable, new Recovery A onboarding, distinct password reset200, two old sessions401/clear and consumed-token400. The final old-password assertion did not record its actual HTTP status; that original status remains Unknown.

Source inspection confirms the installed Better Auth sign-in limit is3attempts in10seconds and updates the window timestamp after each allowed request. The initial helper's oldest-request pacing can attempt too early relative to the latest allowed request. This supports a throttle hypothesis; it does not establish the missing original HTTP status.

Prepared continuation, NOT_RUN by this child:

```sh
node_modules/.bin/bun --no-env-file .local/auth-001-data-ui-lifecycle.ts --local-auth-001 --finish-password-logins
```

The continuation performs only two sign-ins for the existing Recovery account. It waits11seconds before each, persists actual status/code before assertions, and writes `password-login-continuation.json`. Only actual old-password401 plus new-password200/private access permits `final-result.json`, which cites the preserved original FAIL/hash/19checkpoints and the two new observations. It does not reset/register accounts or repeat membership/disable actions. The final artifact reports the original whole-run factor-request count as NOT_RECORDED and the continuation count separately.

Current continuation metadata PASS: native kit-implementer/gpt-6.1-sol/xhigh, same child/parent, turn01a14328-8ce1-7a51-9a62-321b0a902396. Standalone helper typecheck and scoped ESLint PASS.
