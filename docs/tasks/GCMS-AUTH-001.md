# GCMS-AUTH-001 — Approved password-only authentication v0.1

## Current authority, scope and initial state

**Current result — CODE_INTEGRATED / VERIFIED_LOCAL within recorded scope / READY_FOR_USER_REVIEW; HUMAN_ACCEPTANCE_PENDING.** Final actual results are appended below; initial plan/NOT_RUN and prior checkpoints remain historical. No automatic M1 closure.

**APPROVED_EXECUTION_PLAN v0.1 / PLAN_SAVED — 2026-10-16, Asia/Ho_Chi_Minh.** This complete approved plan is saved before dependent application writes. Initial AUTH implementation/migration/runtime/browser checks are **NOT_RUN**. S01–S05 HUMAN_ACCEPTED and their historical PASS/FAIL/NOT_RUN remain unchanged; approval of AUTH is not new technical proof or automatic closure of M1 UAT.

Khiêm (Project Lead) directly approved in desktop conversation `01a1402c-3c81-7933-9927-d974f70c9fbc`,2026-10-16 Asia/Ho_Chi_Minh:

> Duyệt GCMS-AUTH-001 v0.1. Lưu kế hoạch rồi triển khai bỏ MFA/TOTP đồng bộ UI, backend, database và chạy UAT tự động trong phạm vi local đã đề xuất. Chưa commit/push hoặc deploy.

Desktop verified the direct human message, with no later stop supplied. The original in-chat proposal below is now approved for local execution; its proposal/no-write phrasing is preserved only as historical source context. Approval comes from this direct human message, not a document, agent or status label. Silence grants no approval or explanation-level progression.

Goal: both Platform Admin and Tenant Admin authenticate with **verified email+password**. Remove active MFA/TOTP/backup-code UI, plugin/endpoints/contracts and runtime/SQL requirements coherently. Retain12–128-character passwords, login rate limits,8-hour maximum sessions,5-minute **password-only** recent reauthentication, CSRF, platform/tenant authorization, tenant isolation and last-admin protection. Revoke sessions on password reset/account disable. Existing MFA-enabled accounts use unchanged email/password; no reset is needed. Removing MFA reduces account protection; tenant/security controls still apply at API and database.

## Approved implementation invariants and local limits

- P02 includes **new forward migration0013**, never rewriting applied migrations0001–0012. New canonical SQL `has_current_membership(text)` checks the current policy. Existing `has_membership(text,bool DEFAULT true)` remains a compatibility wrapper only; its `p_mfa` argument no longer means active MFA enforcement. Update all active domain/publication/lead/assignee/recipient guards consistently.
- No `mfaVerified=true` fake bypass or pretend boolean proof. No active twoFactor plugin/MFA endpoints/session fields/TOTP/backup branches remain. Old encrypted factor rows/columns are retained **inert**; no DROP, factor reset or data deletion in this package. Historical factor data is not used by runtime or exposed through API.
- Preserve old user IDs/emails/password hashes/memberships/content/leads/notification backlog and existing credentials. No notification backlog drain or worker autostart. Do not reset retained fixture passwords/factors to ease testing.
- P05 one-time local cutover invalidates **all existing sessions and reauthentication grants** after draining in-flight owned requests/stopping owned API/worker as approved, then applies matched source/schema and restarts. Old session tokens are **not restored**. Migration retry must not repeat unrelated business mutations. Precommit failure rolls back; post-cutover fixes roll forward through a new migration when necessary.
- Approved local owned runtime/Docker, new owned fixture helpers/local email capture, existing installed Playwright in fresh isolated contexts without existing profile/cookies/CDP or downloads. Automatic creation/reset of **new UAT** passwords is approved; unchanged old-fixture passwords are preserved. Account secrets stay private ignored mode0600; no credentials/tokens/factors in public evidence/chat.
- Overall new fixture limit remains the prior UAT budget: **at most2new synthetic tenants/8new accounts/minimum leads**, not an additional unrestricted allocation. Approved CAPTCHA work uses the ordinary local arithmetic adapter, not counter resets/shared bypass or a production bot-protection claim.
- No dependency install/upgrade, external mail/provider, paid services, production/DNS/TLS/global configuration, real customer data, destructive reset/Git/commit/push/deploy or S06–S18 implementation. Dependency audit braces stays separate FAIL/open with its existing local-deferral/reassessment limits.
- Preserve18exact master-plan rows/13approved mockup pins/old S01–S05 and M1 evidence bytes. New AUTH evidence is separate. Update M1 UAT's current revision to the password-only policy; TOTP/MFA/backup-specific unrun cases become **SUPERSEDED / not applicable under the new policy**, never PASS. Revalidate auth-affected evidence and keep other API/browser proof scope distinct. AUTH does not automatically close M1.

## Ownership, effort and sequencing

Desktop `/root` remains accountable Project Coordinator/contracts/runtime/final-integration owner. P01 settled writer is native Kit implementer/medium/documentation only; P02/P04 API+Data sensitive auth/database work and independent security review require native xhigh. P03 FE owns its disjoint auth consumers; sensitive auth testing follows native xhigh. Exact future file owners/runtime metadata are recorded by coordinator before dispatch; no multiple writers to the same file. P05 mechanical runtime integration is coordinator-owned. The original P01–P07 task/dependency/acceptance table is preserved in full below; no speculative estimate is introduced.

Writer current-turn runtime PASS before writes: agent-artifact-generation, required/requested/observed medium/medium/medium, native kit-implementer/gpt-6.1-sol, child `01a141fb-3c88-7972-ac27-5ee18b0e6c80`, exact parent above, turn `01a142fc-25d3-73e1-96b5-5027459f5ae4` at04:33:03.512Z. Writer owns only this task/current-pointer/M1-current-revision/maintained AGENTS+README hash provenance records and releases after static checks. No app/SQL/scripts/package/lock/runtime/private/evidence JSON/DB/browser/Git writes or child delegation by this writer.

## Approved plan source and initial verification

The following exact assistant-plan source retains P01–P07, dependencies, new UAT criteria and completion conditions. Its opening proposal status is historical; the direct human approval above is current. P01 approved-plan save is written; P02–P07 implementation/runtime/UAT remain NOT_RUN at save. Human acceptance of this new package remains pending.

Original assistant plan: 6387characters; UTF-8 SHA256 `b102e3b42b096571c5434bc6e9709105bd1d266e87ca685b340e329d3f67734c`. Only the specifically relevant assistant message was read from authorized parent history; no other message/tool/secret content is imported.

## Historical in-chat proposal — now approved as v0.1

**Đề xuất GCMS-AUTH-001 v0.1: chuyển MVP sang email + mật khẩu cho cả Platform Admin và Tenant Admin, rồi cập nhật UAT theo chính sách mới.** Đây là kế hoạch để duyệt; chưa ghi file hoặc triển khai.

**1. Hành vi sau thay đổi**

- Người dùng đăng nhập bằng email + mật khẩu, vào đúng khu vực theo quyền.
- Nhận lời mời không còn bước thiết lập MFA.
- Không còn màn hình nhập TOTP, khóa thiết lập hoặc mã dự phòng.
- Tài khoản đã bật MFA vẫn dùng **email và mật khẩu hiện có**, không cần reset.
- Giữ xác minh email, mật khẩu 12–128 ký tự, giới hạn thử đăng nhập, session tối đa 8 giờ và đăng xuất.
- Giữ xác thực lại trong 5 phút cho thao tác nhạy cảm; chỉ yêu cầu mật khẩu.
- Giữ phân quyền Platform/Tenant, tenant isolation, CSRF, bảo vệ quản trị viên cuối cùng và thu hồi session khi reset mật khẩu/vô hiệu hóa tài khoản.

Bỏ MFA làm giảm một lớp bảo vệ tài khoản. Các kiểm tra quyền và tenant vẫn phải được thực thi tại backend và database.

**2. Cách chuyển đổi database và tài khoản cũ**

Đề xuất **migration mới**, không sửa các migration đã áp dụng:

- Gỡ điều kiện MFA khỏi kiểm tra membership, xuất bản, truy cập lead, phân công và người nhận thông báo.
- Xác thực lại trong database dựa trên session hiện hành và bằng chứng đã kiểm tra mật khẩu.
- Không đặt giả `mfaVerified=true` để vượt các kiểm tra cũ.
- Giữ bảng/cột TOTP cũ dưới dạng **legacy không còn được runtime sử dụng**. Chưa xóa dữ liệu factor trong gói này; ứng dụng và API không còn cung cấp chức năng MFA.
- Giữ nguyên user ID, email, password hash, memberships, nội dung, lead và backlog thông báo.

Khi chuyển phiên bản local, **kết thúc toàn bộ session và reauth grant hiện có một lần**. Sau đó đăng nhập lại bằng mật khẩu. Cách này tránh để cookie cũ hoạt động với chính sách mới.

**3. Tasks, ownership và dependencies**

| Task | Nội dung | Owner đề xuất | Phụ thuộc / nghiệm thu |
|---|---|---|---|
| P01 — Chốt và lưu quyết định | Lưu kế hoạch đã duyệt; ghi quyết định thay thế phần MFA trong ADR-006 và các nguồn hiện hành. Lập baseline bảo toàn. | Coordinator | Sau duyệt; lịch sử nghiệm thu cũ được giữ nguyên |
| P02 — Backend và database | Bỏ plugin `twoFactor`, endpoints MFA và các nhánh TOTP/backup; sửa session contract, password-only reauth, domain guards và migration mới. | API + Data | P01; password-only session được chấp nhận đúng quyền ở cả API và DB |
| P03 — Luồng giao diện | Đơn giản hóa login, onboarding, trang tài khoản và reauth; sửa thông báo lỗi/reset; bỏ MFA gate nhưng giữ role/session gate. | Frontend | Contract P02 đã chốt; đăng nhập và nhận lời mời không gặp bước OTP |
| P04 — S03–S05 và fixtures | Sửa điều kiện xuất bản, assignee/recipient eligibility và helper đăng nhập fixtures. Kiểm tra worker dùng eligibility mới. | API + Data; Frontend xử lý consumer UI | P02; quản trị viên không có MFA vẫn xuất bản, được phân công và nhận thông báo local đúng chính sách |
| P05 — Chuyển runtime local | Tạm dừng API/worker đang chạy, hoàn tất request đang xử lý; áp migration và source tương ứng; thu hồi session cũ; khởi động lại. | Coordinator + Data | P02–P04; cùng phiên bản code/schema, migration chạy lại không thay đổi dữ liệu lần nữa |
| P06 — Kiểm chứng và UAT | Chạy tests bị ảnh hưởng và luồng trình duyệt thực tế; rà quyền độc lập; đối chiếu bảo toàn và secrets. | QA + reviewer độc lập | P05; đạt các tiêu chí bên dưới |
| P07 — Bàn giao | Cập nhật UAT ledger, runbook và file tài khoản riêng với hướng dẫn email + mật khẩu. | Coordinator | P06; báo đúng PASS/FAIL/NOT_RUN |

Phần auth/database và review dùng **xhigh** theo policy dự án. Coordinator chịu trách nhiệm contracts và tích hợp cuối; mỗi file chỉ có một owner khi triển khai.

Các điểm sửa chính đã xác định: [auth/index.ts](/Users/khiemnguyen/Works/godent-cms/godent-cms/apps/api/src/auth/index.ts), [database/index.ts](/Users/khiemnguyen/Works/godent-cms/godent-cms/apps/api/src/database/index.ts), [schema.ts](/Users/khiemnguyen/Works/godent-cms/godent-cms/apps/api/src/database/schema.ts), các hàm SQL trong migrations và nhóm component login/onboarding/account/reauth.

**4. Điều chỉnh UAT**

| Nhóm | Tiêu chí mới |
|---|---|
| Đăng nhập | Platform Admin và Tenant Admin đăng nhập bằng mật khẩu; kiểm tra cả tài khoản cũ từng bật MFA và tài khoản mới |
| Onboarding | Lời mời → tạo tài khoản → xác minh email → nhận quyền; không có bước MFA. Giữ kiểm tra binding, hết hạn, gửi lại, thu hồi và dùng lại lời mời |
| Session/quyền | Sai mật khẩu, chưa xác minh email, session hết hạn, logout, revoke, disable và truy cập chéo tenant vẫn bị xử lý đúng |
| Reset mật khẩu | Phản hồi chung, token dùng một lần, session cũ bị thu hồi; đăng nhập lại bằng mật khẩu mới, không yêu cầu OTP |
| MFA/TOTP/backup | Ghi **“Không còn áp dụng — chính sách MVP mới”**, giữ kết quả lịch sử; không đổi các ca chưa chạy thành PASS |
| S03–S05 | Soạn/lưu/xuất bản, đọc lead, phân công và chọn người nhận thông báo hoạt động với password-only session |
| CAPTCHA/T07/T08/T09 | CAPTCHA vẫn là kiểm chứng riêng. Tái sử dụng bằng chứng cũ còn phù hợp; chạy lại phần bị thay đổi auth làm mất hiệu lực |

Đề xuất thực hiện UAT tự động bằng **Playwright đã cài, browser biệt lập và capture email local**. Cho phép tự tạo/reset mật khẩu của tài khoản UAT mới; giữ mật khẩu các fixture cũ. Khiêm không cần nhập liệu trong luồng dự kiến.

**5. Điều kiện hoàn tất**

- UI, API và các hàm SQL đang hoạt động không còn bắt buộc MFA.
- Endpoints MFA cũ không còn sử dụng được; payload session không còn field MFA.
- Đăng nhập đúng quyền bằng mật khẩu được chứng minh trên trình duyệt.
- Các kiểm tra từ chối quyền, tenant isolation, password-only reauth và last-admin vẫn đạt.
- Session trước chuyển đổi không còn dùng được.
- Tests auth/domain/publication/lead/worker bị ảnh hưởng, cùng typecheck, lint và build đạt; kiểm tra database thật, không chỉ mocks.
- Tài khoản, password hash và dữ liệu nghiệp vụ cũ được bảo toàn ngoài những thay đổi thử đã định danh.
- Bằng chứng mới được lưu riêng, không ghi đè evidence S01–S05.

Nếu migration thất bại trước commit, transaction phải rollback. Sau chuyển đổi, sửa tiếp bằng migration mới khi cần; **không phục hồi session token cũ**.

Phạm vi đề nghị duyệt gồm sửa UI/API/DB/tests/fixtures/tài liệu, migration và kiểm chứng **local**. Không nâng dependency, gửi email ngoài, xử lý backlog cũ, commit/push hoặc deploy. Dependency audit `braces` tiếp tục được ghi riêng là FAIL/open.

## Initial documentation verification and ownership release

PLAN_SAVED was sent immediately after this complete task save, before dependent pointer/static completion. Required/requested/observed medium native Kit role/model/parent check PASS is recorded above. Actual ordinary verifier PASS81maintained hashes/9adaptations/28mirror pairs/17skills per root/3native roles per client/124Markdown/1286local links; unchanged original integrity recipe20original/6adapted;13immutable UI pins/18exact master rows;11owned text whitespace/final newline; exact6387-character assistant-plan source/hash preserved. AGENTS/README maintained digests+appended provenance only. No application/source/SQL/scripts/runtime/private/DB/browser/evidence JSON/Git changes by this writer. All11documentation paths RELEASED to desktop. Initial AUTH implementation/runtime/P02–P07/UAT remain NOT_RUN; no new human acceptance or automatic M1 closure.

## Settled policy reconciliation — 2026-10-16

[ADR-010](../decisions/010-password-only-mvp.md) records only approved AUTH rules and the reduced-account-protection trade-off. Current access/architecture/workflow/acceptance prose reconciles password-only publication/lead/assignee/recipient/settings/worker policy; ADR-006–009 bodies are retained with current supersession notes, D06/D07 factor rules superseded, not erased or PASS. Historical S01–S05 human acceptances/evidence remain intact. Code/runtime/UAT remains IN_PROGRESS/NOT_RUN until actual owner callbacks; no new technical result is claimed.

Bounded native settled writer medium metadata PASS before writes: Kit implementer/gpt-6.1-sol/exact parent, turn01a142fe-add1-7ad0-b3ed-9b19d7dd2f9a at04:35:49.368Z. Only ten assigned ADR/policy/task-bookkeeping files changed; no app/source/SQL/scripts/runtime/private/DB/browser/evidence JSON/Git writes or children. Ordinary documentation integrity/pins/whitespace results are recorded at handoff.

Settled-policy documentation checks actual PASS: ordinary verifier81hashes/9adaptations/28mirror pairs/17skills/3roles/125Markdown/1306links; unchanged original integrity recipe20original/6adapted;13immutable UI pins/18exact master rows;10owned text whitespace/final newline. All4prior ADR bodies byte-preserved after removing the newly prepended supersession note/header for comparison to the M1 source baseline. All10assigned policy/ADR/task paths RELEASED; no new application/runtime/UAT proof or production claim.

## Actual source and UI checkpoint — 2026-10-16

**Historical source/UI checkpoint, superseded by the final local handoff below.** This is a factual checkpoint, not final AUTH human acceptance or full M1 closure. Complete approved6387-character plan/hash, initial NOT_RUN, earlier S01–S05/M1 evidence and human acceptances remain unchanged. Final bounded API/lifecycle/recovery suites, final data/file preservation, independent final review and known-secret scan are pending actual coordinator callbacks. Estimates are not introduced.

### Actual owners and source/check boundaries

Coordinator owns approved runtime/cutover/mechanical integration/shared contracts/evidence. Native sensitive API+Data owns backend/SQL/eligibility/test helpers; disjoint FE owns admin consumers and isolated actual browser helpers/UI evidence; independent native xhigh reviewer owns boundary review. Settled writer uses medium/current exact parent+model. Actual sensitive metadata is coordinator-verified; no source owner delegates again and this writer performs no app/runtime/private/evidence JSON/DB/browser/Git writes.

[API source handoff](../evidence/auth-001/api/implementation-handoff.md) reports scoped source/tests/scripts typechecking+lint and49unitPASS/103integrationSKIP/257assertions; skips are NOT_RUN, not database proof. FE initial source/unit checkpoint34tests/118assertions PASS; final logic/source/build evidence is distinct from UI execution. Root full source type/lint/build and migration checks pass at checkpoint; final full integration snapshot remains pending. Root bounded API boundaries currently3tests/25assertions PASS; lifecycle/recovery paced suites are still running, not inferred from appearing files.

### Cutover, preservation and genuine user-ID repair

Approved0013invalidated105sessions/4reauth grants to0/0; old valid cookie200→401 and checksum replay skips application, not a repeat invalidation. Old users/password hashes/business content and encrypted factor storage remain preserved/inert. Forward0014is applied/replayed without rewriting0013or repeating cutover. Current catalog checks12PASS and exact assignment replay PASS version2/history1/receipt1. [Cutover checks](../evidence/auth-001/cutover-checks.json), [catalog](../evidence/auth-001/data/catalog.json), [exact replay](../evidence/auth-001/api/assignment-exact-replay.json).

A genuine app-contract defect appeared when ordinary Better Auth32-character opaque user IDs were rejected by UUID-only S05assignment/filter/recipient validation. TypeScript canonical parser repair RED→GREEN10tests/123assertions/fulltype+lint+APIbuild PASS still left an actual SQL400. Independent P1 confirmed the old SQL predicate; forward0014narrowly fixes assignment IDs, retaining null-unassign and tenant/resource UUID rules. Original failures/private attempts are preserved; no repeated public intake or invented original assignment status. [Forward review](../evidence/auth-001/security/forward-0014-review.json), [UI400](../evidence/auth-001/ui/operations-resume-result.json), [SQL continuation](../evidence/auth-001/ui/operations-sql-resume-result.json). The earlier generic exact-replay helper failure was separately repaired without further application/database changes.

Preliminary protected349source files unchanged/private106files only allowed process metadata change verified at coordinator checkpoint. This is not final preservation/secret proof; final counts and dispositions await the actual callback. All applied migrations remain immutable. No old session token is restored, old credentials reset or retained backlog dispatched.

### Actual automatic browser and local worker evidence

| Group | Actual checkpoint proof / boundary |
| --- | --- |
| Login/onboarding | Existing PlatformOnly/A2 password-only login PASS; new Owner invitation→registration→unverified denied→local verification→explicit membership acceptance→CMS PASS. Both admin roles reach correct area, no factor UI. [UI progress](../evidence/auth-001/ui/progress.md) preserves initial same-path/mail-tab/harness failures and later distinct continuations. |
| Publication/intake | New owned B service/publication PASS. Exactly3ordinary public-form leads: third challenge-required428→invalid400 leaves count2→valid local arithmetic answer200/count3; one frozen key/no counter reset. Complete later headers show actual localhost Origin and no cookie/Authorization/XFF; original L1header observation remains Unknown. This is local adapter proof, not production CAPTCHA. |
| No-factor operations | New32-character Peer never enrolled: assignment200/v2/filter200exactL1, selectedOwner-only settings200 PASS after0014; no extra submissions/accounts in operations continuation. Current verified active membership/expiry/CSRF/recent-password checks remain. |
| Worker/replay | Explicit newB-only worker3of3exact intents/local0600generic captures PASS, newly verified unenrolled recipient, stale fence denied/repeatclaim0/other-tenant backlog unchanged. Current recipient email is private destination metadata, not customer contact/message in delivery. Exact rejected assignment operation replay remainsv2/history1/receipt1. [Worker proof](../evidence/auth-001/api/worker-local-capture.json). |
| Lifecycle | [Consolidated result](../evidence/auth-001/ui/lifecycle/final-result.json) preserves original19completed checkpoints/failure/hash plus2bounded login-tail observations. PeerA revoked whileBretained; last-Owner self-revoke/global-disable409; Peer disabled+old-session/login denied; Recovery local registration/verification/Aacceptance/two sessions; generic reset/distinctnewpassword/bothold sessions401/privateclear/tokenreplay400 PASS. Later oldpassword401/currentpassword200+Aaccess PASS without new reset/registration. Original unrecorded response/cause remain Unknown. |
| Invitation negatives | [10checkpoint result](../evidence/auth-001/ui/invitation-negatives-result.json) PASS: usedOwnerBlink409; RecoveryBresend/oldlink409/newlink200/privateB; wrongactor409; probe revoked andregistration400with0successfulnewaccounts. Bmembership added only after sole-admin cases. Fresh browser invitation-expiry remains NOT_RUN; historical/API expiry proof is separate. |
| Render/keyboard | [Five-width result](../evidence/auth-001/ui/final-visual-result.json)320/390/768/1024/1440nohorizontaloverflow/threeaccountsections/emptyonlypassword/noMFAcontrols/Tab sequence/factorrequests0 PASS within that bounded flow. Earlier768/1024repeated-strip fullpages retained as image artifacts; [fresh-page recapture](../evidence/auth-001/ui/visual-recapture-result.json) top/bottom at both widths PASS without app repair; no global compositor diagnosis. |
| Private handoff | `.local/auth-001-ui-login-handoff.md` actualnonempty2064bytes/0600/ignored,4entries unchangedPlatformOnly/A1/A2+usableOwner, email/password only/noTOTP/backup secrets. A1fresh AUTHbrowserlogin not claimed at this checkpoint; Peer explicitly unusable. No private value is copied here; old fixture/handoff files unchanged. |

Exactly3UIaccounts(Owner/Peer/Recovery), prior M1tenantA+one additionalB, one new Bservice/publication/3public-form leads. API's2disjoint additional accounts are pending actual final suite results; total stays within prior2tenant/8account/minimumlead budget. No old business content or credential/factor changes. Browser fresh natural8-hour session wait and fresh invitation-expiry NOT_RUN; API boundary/clock proof and historical last-admin race reuse remain separate. MFA/TOTP/backup cases SUPERSEDED, never converted from old NOT_RUN to PASS. No external mail/provider/production/Git/deploy/S06+ proof.

Current settled writer metadata PASS: agent-artifact-generation/native kit-implementer/gpt-6.1-sol/exact parent/medium required-requested-observed, turn01a14336-b22d-7840-8970-9e0f6807c691 at05:37:04.133Z. Current pointers/M1 criteria revision preserve partial/historical status. Final actual suite/preservation/review/scan callback is awaited before final package status/freeze; no new approval gate or extra manual request.

## Final local handoff — 2026-10-16

**CODE_INTEGRATED / VERIFIED_LOCAL within recorded scope / READY_FOR_USER_REVIEW; HUMAN_ACCEPTANCE_PENDING.** Desktop supplied the final actual suite/preservation/review callback. Historical complete approved plan/source hash/initial NOT_RUN/failed attempts/earlier checkpoints remain intact. S01–S05 HUMAN_ACCEPTED unchanged. This AUTH technical handoff does not automatically close M1 UAT, full-MVP/production or any later slice.

| Final group | Actual result and limits |
| --- | --- |
| API integration/source | [Bounded runner](../evidence/auth-001/api/bounded-checks.json) exit0, all3suites/9tests/79assertions:boundaries3/25,lifecycle2/30,recovery4/24. Real auth limiter remains enabled; paced test execution, no rate-limit bypass. [Final source checks](../evidence/auth-001/final-source-checks.json):fulltypecheck/lint exit0, latest admin/API builds PASS, unchanged website build reused after initial AUTH build. No unchanged app rebuild is invented. Source49unitPASS/103gatedSKIP/257assertions and FE34/118 remain separate dated suites; counts are not summed as unique full-product coverage. |
| Password-only/cutover | Both role browser login/new unenrolled onboarding/publish/lead+recipient operations PASS.0013one-time105sessions/4grants→0/0, oldcookie200→401, replay skips;0014opaque-user-ID assignment predicate forward repair applied without rewriting0013or reinvalidating sessions. No fake MFA flag/active plugin/endpoints/session fields. Old encrypted factors retained inert; no deletion/reset. Current SQL/session/RLS/last-admin/CSRF/5minpassword assurance retained. |
| Browser proof | Consolidated lifecycle19original checkpoints+2bounded login observations PASS; original failed/unrecorded response remains Unknown. Invitation negatives10PASS. Ordinary local CAPTCHA invalid leaves2leads/valid makes3, no counter reset. Final five-width/Tab/no-factor controls and768/1024fresh-page recapture PASS; earlier repeated-strip artifacts retained, no invented app defect. Hand-off/current/new Owner usable, Peer disabled/unusable; private email+password only. Fresh A1login is not inferred from handoff. |
| Worker/replay/catalog | NewB-only worker exact3captures/0600/generic/stalefence denial/repeatclaim0/other backlog unchanged PASS. Exact successful browser assignment operation replay remainsv2/history1/receipt1. Catalog12checks PASS;14applied migrations immutable. Existing user IDs are opaque text; tenant/resource UUID requirements unchanged. |
| DB preservation | [Final data preservation](../evidence/auth-001/data/preservation.json)31of31PASS after exact classification of2approved global identity.disabled audit events; original764audit rows all unchanged. [Initial preservation FAIL](../evidence/auth-001/data/preservation-before-global-audit-rule.json) and read-only diagnosis retained. Allowed new UAT state is distinguished from retained data; no broad exception/counter reset. Existing password hashes/credentials/factor storage/business content/backlog preserved. Old session revocation is the intentionally approved exception, never token restoration. |
| File/private preservation | [Protected-file snapshot](../evidence/auth-001/final-file-preservation.json)349old protected files unchanged/private106only permitted process metadata change/13pins PASS at preclosure snapshot. Final file inventory is mechanically refreshed after document freeze; no invented later count. No dependency/lock upgrade or old evidence rewrite. |
| Secret review | [Preclosure exact-known-value scan](../evidence/auth-001/secret-scan.json) PASS140known/167representations/57textfiles/18newcaptures/no matches. This checks known forms, not comprehensive detection/OCR. Coordinator refreshes final file preservation and writes `docs/evidence/auth-001/knownsecret-scan-final.json`/static receipt after this final text freeze; no PASS is preclaimed for that ordered last step and no additional writer callback is required. |
| Independent review | Native xhigh source/runtime repair/opaqueID/forward0014/UI/replay proof reviews CLOSED with no open actionable finding at callback; [review ledger](../evidence/auth-001/security/review.md). Earlier P1 assignment finding is closed by actual0014proof, not hidden. Coordinator reviewed owner handoffs/current data and actual UI images. |

### Failures, reuse and remaining NOT_RUN

Retain initial fixture/setup/resume failures, initial onboarding/mail-tab and header-selector assertions, initial TypeScript-rejected opaque IDs, actual SQL400before0014, replay-helper/catalog-helper repairs, initial API bounded attempt and preliminary global-audit classification FAIL in their named AUTH artifacts. Later observed results close only their exact condition; they do not invent original response status/cause or turn a failed attempt into a successful run. No assertion weakening/security disable/dependency change was used.

Fresh **browser invitation-expiry** and **natural8-hour session wait** remain NOT_RUN. Historical invitation expiry/last-admin concurrency evidence and current API boundary/clock proof are explicit separate reuse, not fresh browser execution; a fresh last-admin race rerun is NOT_RUN. MFA/TOTP/backup-only cases are SUPERSEDED under approved policy, never historical NOT_RUN→PASS. T07/T08/T09 historical proof remains bounded to its dataset/component/auth contract; AUTH does not automatically declare all M1 gaps closed. Backup restore/production/custom domain/TLS/S06+ are outside scope. No full-product/all-technical-debt closure.

Audit braces remains FAIL/open with scoped local exposure deferral; desktop reassesses2026-10-22 or earlier patch/dependency/exposure/before production. No automation/production waiver or external mail/provider claim. Current UI/account handoff has unchanged PlatformOnly/A1/A2 credentials plus current usable Owner in ignored `.local/auth-001-ui-login-handoff.md`0600; no secrets copied here. Old MFA handoffs remain historical, not current instructions. No human AUTH acceptance has been reported.

### Coordinator and writer handoff

Coordinator verified continuing direct human approval/disjoint owners/native sensitive effort, read API/FE/reviewer handoffs, integrated contracts/schema/cutover/opaqueIDrepair, inspected representative and final responsive images, reconciled exact allowed UAT data/audit differences and protected data/source proof. No open actionable source finding remains; after-doc scan/static receipt is the ordered final mechanical integration step. No new permission gate/manual-entry question is introduced.

Settled writer current-turn native medium/kit-implementer/gpt-6.1-sol/exact parent PASS turn01a14336-b22d-7840-8970-9e0f6807c691 at05:37:04.133Z; same approved writing turn/settings reused for final actual callback. Only16assigned documentation/ADR/current-policy/provenance paths changed across this closure scope. No app/SQL/scripts/package/lock/runtime/private/evidence JSON/DB/browser/Git writes by writer. Historical pins/master rows/accepted tasks/evidence preserved. Static results and FROZEN/RELEASED ownership are reported after execution; no further document callback needed for mechanical final receipts.

Final settled documentation check actual PASS: ordinary verifier81maintained hashes/9adaptations/28mirror pairs/17skills per root/3native roles per client/129Markdown/1416local links; original unchanged integrity recipe20original/6adapted;13immutable UI pins/18exact master rows;16owned text whitespace/final newline; original6387-character plan/hash intact. AGENTS/README maintained digests+append provenance updated only. All16assigned documentation paths FROZEN/RELEASED to desktop. Coordinator performs its ordered after-document exact-known-secret/file-preservation/static receipt with no further writer pass required. Human AUTH acceptance pending; no new runtime/UAT proof or automatic M1 closure follows from these static checks.
