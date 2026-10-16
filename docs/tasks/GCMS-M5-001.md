# GCMS-M5-001 — Approved M5 v0.1 local execution

## Current authority and ownership

**Current result — ACCEPTED_UNDER_DELEGATED_AUTHORITY — 2026-10-17.** Khiêm directly delegated M5 local review/acceptance; desktop `/root` reviewed and accepted S16–S18 within that bounded scope. [Delegation, separate coordinator decision and proof](#delegated-m5-acceptance--2026-10-17). Technical CODE_INTEGRATED + VERIFIED_LOCAL remains unchanged. No fabricated direct HUMAN_ACCEPTED statement. Earlier pending/NOT_RUN/failed checkpoints and the original final snapshot are historical and preserved; no Git/deploy/Production authority follows.

**APPROVED_LOCAL_EXECUTION / PLAN_SAVED. Product implementation and verification initially NOT_RUN.** Khiêm directly approved the complete M5 v0.1 plan after approving S16-D02–D06 and S17-D01–D08 in this same desktop chat.

> Duyệt M5 v0.1. Lưu kế hoạch rồi triển khai toàn bộ S16–S18 trong phạm vi local đã đề xuất, gồm migrations, fixtures/workers mới, kiểm chứng và xóa tenant thử M5 mới. Bảo toàn dữ liệu cũ; chưa commit/push/deploy.


Source: direct human user message, desktop thread `01a14576-0038-7232-8531-e6395fab7975`, current turn `01a14585-42f6-7553-9fe6-60705af4f136`, 2026-10-16 Asia/Ho_Chi_Minh. Prior chat-only/no-write restrictions in the preserved source plan below are historical and superseded only by this bounded current approval.

Accountable coordinator and shared-record writer: desktop `/root` in this M5 thread. Base HEAD: `49f2a1a7be0188ebec019fee14a0dff9e4513726`, main, initially clean. M4 remains ACCEPTED_UNDER_DELEGATED_AUTHORITY; S01–S12/AUTH/M1–M3 acceptance and all historical FAIL/Unknown/NOT_RUN remain unchanged.

Authorized: save the complete plan before dependent application writes; implement S16–S18 locally, additive forward migrations, new owned M5 fixtures/technical workers/resources, scoped tests/browser/fault/concurrency/UAT, and confirmed deletion of positively identified new M5 test tenants only. Preserve all retained data/credentials/fixtures/snapshots/backlog/evidence and every applied migration checksum. Never enroll or drain old worker scopes. No Git/index changes, commit/push/deploy, Production, live DNS/TLS, external providers, paid services, global configuration, real patient data or destructive reset.

Required/requested/observed coordinator effort: xhigh; inherited gpt-6.1-sol, runtime-written current turn comparison PASS. Risks: tenant isolation, authorization, sensitive data, transaction concurrency, publication integrity and irreversible data changes. Native bounded implementation/review at xhigh is part of the approved ownership/review plan and applicable project instructions; child agents never delegate. Exact ownership and runtime observations will be appended before their substantive work.

Audit braces stays FAIL/open; fresh M5 bounded local exposure assessment required, reassess2026-10-22 or earlier patch/dependency/exposure and before Production. No inherited M4/Production waiver. Retain the known applied0035 cosmetic whitespace FAIL and all existing evidence bytes.

## Source-complete approved plan

The complete preceding final plan is preserved below. Only repository links are made task-relative. Original UTF-8 SHA-256: `9d7a3f744b1eeae0987d6685fa51e6cf29513542fe2fcebae439c2a07562d2b0`; characters: 28464. Earlier Proposed/chat-only/NOT_RUN wording records the planning checkpoint; the current authority above settles execution scope without fabricating runtime proof.

**M5 v0.1 — Kế hoạch hoàn thiện trong chat**

Các quyết định **S16-D02–D06 và S17-D01–D08 đã được Khiêm duyệt trực tiếp ngày 16/10/2026**. Kế hoạch dưới đây tích hợp các quyết định đó với GCMS-MASTER-PLAN-001 v0.2.

**Quyền hiện tại:** hoàn thiện kế hoạch trong chat. Chưa có quyền ghi file, triển khai, migration, fixtures, worker, xóa dữ liệu thử, commit/push hoặc deploy.

**Baseline đã xác nhận:** HEAD local `49f2a1a7be0188ebec019fee14a0dff9e4513726`, worktree sạch. M4 giữ **ACCEPTED_UNDER_DELEGATED_AUTHORITY**, technical **CODE_INTEGRATED + VERIFIED_LOCAL**. Kết quả triển khai và kiểm chứng M5 hiện là **NOT_RUN**.

Nguồn chuẩn: [master plan](../project-plan.md), [hồ sơ M4](GCMS-M4-001.md), [acceptance criteria](../acceptance-criteria.md), [delivery workflow](../delivery-workflow.md).

---

**1. Mục tiêu và ranh giới toàn M5**

M5 hoàn tất ba kết quả:

| Slice | Kết quả người dùng |
| --- | --- |
| **S16** | Hai entry phục vụ cùng website/lead list; custom primary và direct redirect hoạt động đúng trong local |
| **S17** | Platform quản lý quota/lifecycle; tenant giữ quyền đọc/export hợp lệ; confirmed deletion hoạt động có kiểm soát |
| **S18** | Toàn MVP local có evidence traceability, luồng tích hợp thật, review và UAT để nghiệm thu |

Giữ nguyên:

- Một tenant là một tổ chức/website; locations là content thông thường.
- Tenant Admin quản lý toàn bộ lead của tenant; assignment không chia quyền xem.
- Draft → explicit Publish; immutable snapshots, locale permissions và current revocation.
- AUTH password-only, session/reauth/CSRF/RLS và last-admin protections hiện hành.
- D4 retention, media withdrawal và purge contracts.
- Stack Bun/Next/Nest/PostgreSQL/Drizzle và local endpoints hiện tại.

Không thuộc M5 local: DNS/TLS thật, external providers, billing tự động, full Web Builder, Production topology, backup/restore vận hành và AC-09.

**Bảo toàn bắt buộc**

Baseline data, credentials, fixtures, backlog, snapshots, evidence và applied migration checksums phải được giữ nguyên. Migration mới chỉ đi tiến. Không sửa bytes migration cũ, gồm FAIL whitespace đã ghi tại migration `0035`.

API startup, migration, activation và reactivation không được tự enroll/start worker hoặc drain backlog cũ.

Confirmed-deletion testing chỉ dùng tenant M5 mới, có ownership và quyền xóa được cấp rõ ràng khi thực thi.

---

**2. Ownership và phương thức thực hiện đề xuất**

Đây là ownership cho kế hoạch, chưa phải lệnh giao việc.

| Owner | Trách nhiệm |
| --- | --- |
| **Coordinator M5** | Contracts chung, migration sequence, runtime/shared root, preservation, evidence map và tích hợp cuối |
| **API Domains** | Binding registry, verifier interface, entry resolution, primary commands và URL context |
| **Platform/Data/Lifecycle** | Quota, usage/reservations, suspension/reactivation và deletion orchestration |
| **Leads/Media/Publishing owners** | Admission, eligibility, export/deletion contracts thuộc dữ liệu module mình |
| **CMS owner** | Domain/quota/lifecycle/export UI và capability-aware controls |
| **Website owner** | Hai entry, routing, redirect, SEO, forms và media consumers |
| **QA/Security reviewer** | Kiểm chứng tích hợp và review độc lập phần M5 mới |

Một writer sở hữu mỗi shared contract/file. Module sở hữu dữ liệu cung cấp contract cho quota/export/deletion; Platform không ghi/xóa tùy ý xuyên bảng.

Các phần liên quan isolation, authorization, dữ liệu nhạy cảm, concurrency và deletion dùng **xhigh**. Writer ghi lại quyết định đã chốt dùng **medium**. Khi thực thi, phải kiểm tra runtime effort/role theo policy; metadata này không trở thành dependency của ứng dụng.

---

**3. S16 — Hai entry và custom primary local**

**3.1. Mục tiêu, actors và quyền**

Anonymous visitor truy cập đường dẫn Godent hoặc custom host nhưng đọc cùng site/publication/config/media và gửi về cùng lead list.

Current active Tenant Admin cùng tenant được quản lý binding và explicit activate primary. Platform-only không tự có quyền activate thay tenant hoặc đọc private leads.

**3.2. Các quyết định đã chốt**

| ID | Contract được đưa vào M5 v0.1 |
| --- | --- |
| **S16-D02** | Verifier interface với adapter synthetic-local; evidence gắn binding/host/tenant/site/generation và thời điểm; không tự nhận trạng thái verified/TLS-valid từ client |
| **S16-D03** | Activate dùng operation ID, expected versions, current authorization/reauth, transaction, revision và durable receipt |
| **S16-D04** | Trang Published tương đương cùng locale dùng direct 301; missing EN dùng một direct 302 tới primary VI |
| **S16-D05** | Exact ASCII host; `www` riêng; controlled replacement/removal/reverification; manual return-to-Godent có cảnh báo cached 301 |
| **S16-D06** | Giữ tracking allowlist hiện tại và query chức năng đã đăng ký; không mở rộng analytics |

Godent-first và same-tenant explicit activation tiếp tục kế thừa ADR-004.

**3.3. Workflow và trạng thái**

Luồng chính:

1. Tenant Admin đăng ký exact host.
2. Registry kiểm tra normalization, uniqueness và reserved/internal hosts.
3. Local verifier kiểm tra host thử trong manifest M5; ghi evidence đúng binding generation.
4. Hai entry phục vụ cùng eligible publication. Verification đơn thuần chưa đổi primary.
5. Admin xem readiness và xác nhận activate.
6. Transaction kiểm tra lại actor, tenant/site, binding, TLS eligibility và equivalent Published routes.
7. Commit primary revision, receipt và audit; URL-dependent output dùng primary hiện hành.

Tách độc lập:

- **Binding:** pending verification, active, inactive, removed.
- **TLS eligibility:** unknown, valid, invalid.
- **Primary:** Godent hoặc một custom binding cụ thể.

Không tự chuyển primary vì verification thành công, outage hoặc TLS failure.

**Ma trận redirect đã chốt**

| Điều kiện | Kết quả GET/HEAD |
| --- | --- |
| Godent VI có VI Published, custom đang primary | Một 301 tới custom VI tương đương |
| Godent EN có EN Published, custom đang primary | Một 301 tới custom EN tương đương |
| Godent EN thiếu EN, có VI fallback hợp lệ | Một 302 trực tiếp tới primary VI |
| Custom EN thiếu EN, có VI fallback hợp lệ | Một 302 tới custom VI |
| Không có eligible publication/fallback | Safe not-found |
| Backend/read failure | Lỗi phù hợp; không giả thành fallback |

HEAD giữ status/Location của GET và không có body.

**Invariants và ngoại lệ**

- Custom-host path không chọn tenant khác bằng segment đầu.
- Host/query/forwarded/internal headers từ client không thay authoritative binding.
- Activation không publish Draft hoặc viết lại immutable history.
- Cùng operation/payload retry không tạo effect lần hai. Receipt cũ không được activate ngược primary đã đổi tiếp.
- Lỗi trước commit giữ primary cũ; mất response sau commit được giải quyết bằng receipt.
- Race với publish/unpublish, membership revoke, binding change và lifecycle phải revalidate hoặc conflict.
- Body, metadata và navigation không được trộn các primary/publication/config revisions.
- API/admin/private preview/media/intake POST không thuộc blanket page redirect.
- Binding đã removed không dùng lại evidence cũ. Claim lại hostname cần binding/generation và verification mới.
- Return-to-Godent là explicit migration. Không phát reverse 301 từ custom cũ về Godent; cached 301 vẫn không có bảo đảm fallback tức thì.

**3.4. Dependencies và tác động kỹ thuật**

Kế thừa S03 registry/publication, S04/S05 intake, S07 media và S13–S15 presentation/locale/SEO.

Các vùng chính:

- [website proxy](../../apps/website/proxy.ts): mở rộng exact local host routing, vẫn loại credentials và untrusted forwarding hints.
- [public contracts](../../apps/api/src/contracts/s03.ts): tách validated entry/primary context khỏi constant origin.
- [builder routing](../../apps/website/lib/builder-routing.ts): phân biệt platform tenant prefix và custom root.
- [builder SEO](../../apps/website/lib/builder-seo.ts): không suy tenant từ canonical pathname.
- Intake/CORS/media consumers: xác minh current binding/context; không mở origin rộng.

Schema/contracts bổ sung dự kiến gồm binding registry, verification evidence, primary configuration, versions/receipts và redacted audit. URL projections dùng stable tenant/site/resource identity cùng mapping/primary revision; không sửa source snapshots lịch sử.

Giữ `no-store` và local noindex safeguards. Không thêm cache hoặc broker chỉ để triển khai S16.

**3.5. Tasks theo vertical slice**

| Task | Kết quả và kiểm chứng chính | Owner | Phụ thuộc |
| --- | --- | --- | --- |
| **S16-T01** | UI đăng ký/xem binding → API → registry; duplicate/reserved/cross-tenant denial | API Domains + CMS | Contract binding |
| **S16-T02** | Local verification → một trang thật qua hai entry; cùng publication/config IDs và ảnh thật | API Domains + Website | T01 |
| **S16-T03** | Service/landing form qua hai entry → một lead list; cross-entry same-key retry | Domains + Leads + Website | T02 |
| **S16-T04** | Readiness → activate → primary commit → direct VI GET/HEAD301 | Domains + CMS + Website | T02 |
| **S16-T05** | VI/EN fallback, listings, menu, canonical, alternates, sitemap, social/JSON-LD và query semantics | Website + Domains | T04 |
| **S16-T06** | Replacement/removal/reverification/return-to-Godent qua UI/API; stale binding denial | Domains + Data + CMS | T04 |
| **S16-T07** | Races/faults, media withdrawal, preview isolation và review tích hợp | Coordinator + QA/Security | T03–T06 |

T02 là luồng đại diện đầu tiên. T04 chứng minh primary trên một trang thật trước khi mở rộng URL consumers.

**3.6. Tiêu chí nghiệm thu và evidence**

S16 đóng khi:

- Hai entry dùng cùng site/publication/config/media và common lead list.
- Unknown/unverified/inactive/removed/forged bindings bị từ chối.
- Activation và migration đúng current quyền, versions và eligibility.
- Direct status/Location đúng; không loop, chain, open redirect hoặc homepage catchall.
- Cross-entry same-key/payload trong 24 giờ tạo đúng một lead/intent; changed payload conflict.
- Unpublish/withdrawal có hiệu lực qua cả hai entry.
- Private preview/originals và dedicated POST contracts giữ đúng quyền.
- Precommit fault, postcommit response loss và races không tạo trạng thái nửa chừng.

Dùng restricted-role SQL/API, HTTP không auto-follow redirect, browser thật qua loopback và DB correlation. Synthetic TLS chỉ chứng minh điều kiện local, không chứng minh TLS thật.

Tái sử dụng proof S03/S04/S05/S07/M3/M4 còn hợp lệ; bổ sung cross-entry/primary proof và kiểm tra lại consumers thực sự bị đổi.

---

**4. S17 — Quota và vòng đời tenant**

**4.1. Mục tiêu, actors và quyền**

Platform Admin quản lý quota, suspension, reactivation và thực thi confirmed deletion.

Tenant Admin thấy usage/capabilities, đọc/export đúng quyền và xác nhận yêu cầu deletion. Platform-only không được đọc private content/leads hoặc giả tenant confirmation.

**4.2. Các quyết định đã chốt**

| ID | Contract được đưa vào M5 v0.1 |
| --- | --- |
| **S17-D01** | Hai quota: `content_items` và `media_bytes`; không quota số lead, membership, locale hoặc chi nhánh |
| **S17-D02** | Phân biệt chưa cấu hình/theo dõi/áp dụng; không tự enforce tenant cũ; không có mức quota thương mại mặc định |
| **S17-D03** | DB admission chịu concurrency; idempotent usage/reservation; media chỉ giải phóng capacity khi có bằng chứng tương ứng |
| **S17-D04** | Suspended giữ read/export; chặn business writes; cho ngoại lệ hẹp unpublish/permission withdrawal/global media withdrawal |
| **S17-D05** | ZIP có manifest và JSONL; phạm vi dữ liệu đầy đủ, media binary tùy chọn theo current read rights; stream, không giữ export server lâu dài |
| **S17-D06** | Tenant Admin xác nhận request; Platform thực thi; không bắt buộc hai người khác nhau |
| **S17-D07** | `executeAfter` bắt buộc từng request; không scheduler tự xóa; local minimal tombstone chưa có TTL tự động |
| **S17-D08** | Explicit reactivation; readiness warnings và current eligibility; không tự publish/regrant/đổi primary/dispatch backlog |

**4.3. Workflow, invariants và ngoại lệ**

**Quota**

`content_items` đếm logical resource theo tenant/kind/resource ID:

- Draft/Published, VI/EN, revisions và references không bị tính lặp.
- Adoption giữ cùng identity thì tính một lần.
- Site/presentation singleton không tính; home tính một content item.
- Unpublish không giải phóng slot.
- Locations nằm trong content thông thường.

`media_bytes` gồm objects thực còn lưu và reservations cho ghi mới:

- Originals, derivatives và object còn tồn tại sau lỗi được tính.
- Retry không tính lại cùng reservation/object.
- Rejected/withdrawn không tự giảm usage.
- Timeout hoặc native settlement chưa rõ không phải bằng chứng object đã biến mất.

Mọi creation path liên quan, gồm legacy và M4, phải đi qua enforcement tại DB. Quota giảm dưới usage không xóa dữ liệu; chỉ chặn corresponding growth. Accepted lead/intent không chịu quota số lead và không bị mất vì quota thay đổi.

**Suspension**

| Thao tác | Khi suspended |
| --- | --- |
| Public website/media, intake mới, publish/republish | Chặn |
| Current-authorized content/history/private media reads và lead chưa hết hạn | Cho phép |
| Export cùng phạm vi đọc | Cho phép |
| Create/save/upload, grant permission, lead business commands, retention extension | Chặn |
| Unpublish, withdraw permission, global media withdrawal | Cho phép với current quyền, version/reason/reauth phù hợp |
| Retention/audit expiry/purge bảo vệ dữ liệu | Tiếp tục theo scope hợp lệ |

Private-read capability không được phân loại chỉ bằng HTTP method. Một POST cấp link đọc hợp lệ không mở quyền business writes.

**Export**

- ZIP chứa versioned manifest, JSONL datasets và tùy chọn lawful media binaries.
- Bao gồm website/config/content/history và leads chưa hết hạn cùng consent/source/history phù hợp.
- Không xuất secrets, sessions, credentials hoặc dữ liệu tenant khác.
- Đọc theo batch/keyset có giới hạn; recheck quyền/expiry trong quá trình xuất.
- Mỗi record mang version/thời điểm. Không hứa một snapshot đồng thời của toàn tenant.
- Chỉ ghi completion manifest khi toàn lượt thành công.
- Đã tải xuống thì hệ thống không thể thu hồi. Export không phải operational backup/restore.

**Deletion**

Workflow:

`Requested → Confirmed → Eligible after executeAfter → Executing → Completed / Failed`

- Tenant Admin xác nhận tenant, scope và `executeAfter` bằng reauthentication.
- Platform Admin xác nhận rồi explicit execute sau thời điểm đó.
- Chưa bắt đầu irreversible effect thì có thể hủy. Request/version/confirmation không còn hợp lệ phải được xác nhận lại.
- Khi execution bắt đầu, chặn tăng/đọc xuất mới theo contract và fence workers để không phát sinh dữ liệu mới.
- Xóa module-owned business graph, Draft/revisions/publication snapshots và media thuộc scope đã xác nhận.
- Giữ global identity/credentials, tenant khác và redacted audit theo thời hạn đã chốt.
- Local minimal tombstone chặn stale jobs/bindings/restored data; chưa có TTL tự động.
- Storage failure hoặc crash để lại checkpoint/failed state; retry tiếp tục đúng request/generation.
- Không báo hoàn tất active-data deletion khi DB/storage còn chưa được xác nhận.

Phạm vi này không tuyên bố xóa backup, file đã tải xuống hoặc mọi bản sao ngoài hệ thống. Existing fixtures/evidence/baseline không thuộc deletion test.

**Reactivation**

Platform explicit chuyển Suspended→Active bằng versioned command.

Không áp cho tenant đã vào irreversible deletion. Không reset quota usage, retention, permission, publication hoặc retry budgets. Over-quota chỉ tiếp tục chặn growth tương ứng.

Tenant có thể Active để sửa cấu hình dù domain chưa sẵn sàng; public vẫn kiểm tra binding/TLS/publication hiện tại. UI phải báo rõ website chưa sẵn sàng, không tự đổi về Godent.

**4.4. Dependencies và contracts**

Kế thừa AUTH/S02 authorization; S04/S05 durability và suspended lead read; S06 retention; S07 storage/purge/fencing; M4 source/locale/publication contracts; S16 entry/primary context.

Bổ sung dự kiến:

- Quota policy, usage/reservation và command receipts.
- Lifecycle request/version/reason và deletion checkpoints.
- Read/write/export/safety capabilities rõ ràng.
- Versioned export schema/manifest.
- Module-owned export/deletion interfaces.
- Narrow worker privilege gắn request/tenant/generation khi thực sự cần.

Các content/media reads dùng active-only guard hiện tại phải được tách đúng semantic capability. Không mở rộng mutation helper chung để cho mọi suspended action đi qua.

**4.5. Tasks theo vertical slice**

| Task | Kết quả và kiểm chứng chính | Owner | Phụ thuộc |
| --- | --- | --- | --- |
| **S17-T01** | Platform cấu hình quota → tenant thấy usage → tạo một content item tại boundary | Platform/Data + CMS | D01–D03 |
| **S17-T02** | Concurrency, retry, downgrade và direct runtime DB bypass negatives; legacy/adoption không đếm lặp | Platform/Data + Content | T01 |
| **S17-T03** | Media reservation → upload/process thật → settlement/release; lỗi không tạo free capacity giả | Media + Platform/Data | T01 |
| **S17-T04** | Suspend qua UI/API → hai entry/intake/publish bị chặn → read và safety withdrawal vẫn đúng | Platform + CMS + Domains | S16-T02 |
| **S17-T05** | ZIP/JSONL export từ Active/Suspended; media option, expiry/revocation/failure handling | Export + CMS + module owners | T04 |
| **S17-T06** | Reactivation với warnings; eligible output trở lại, revoked/expired/Draft không hồi sinh | Platform + Domains + CMS | T04 |
| **S17-T07** | Request → confirmation → executeAfter → deletion thật trên tenant M5 riêng | Lifecycle/Data + module owners | Quyền xóa fixture rõ ràng |
| **S17-T08** | Crash/retry và deletion-versus-export/reactivation/worker races; review tích hợp | Coordinator + QA/Security | T02–T07 |

Quota và lifecycle có thể phát triển độc lập khi contracts đã sẵn sàng. Media và export bắt đầu bằng luồng thật tối thiểu trước khi mở rộng failure coverage.

**4.6. Tiêu chí nghiệm thu và evidence**

S17 đóng khi:

- Concurrent growth không vượt quota; retry không tính lần hai.
- Usage/reservation khớp resource/object được chứng minh; không thay unknown bằng zero.
- Downgrade không xóa dữ liệu hoặc chặn chức năng không tăng dimension tương ứng.
- Suspension có hiệu lực trên hai entry và workers phù hợp, vẫn giữ read/export và safety actions đã duyệt.
- Export đủ manifest, không vượt quyền/expiry; lỗi không giả thành hoàn tất.
- Reactivation không tự hồi sinh dữ liệu/quyền/binding hoặc backlog.
- Chưa có confirmation hợp lệ thì không deletion.
- Deletion failure quan sát được và retry an toàn; completed active-data scope không còn phục vụ qua API/public/media/jobs.
- Tenant khác, global credentials và baseline cũ được bảo toàn.

Tái sử dụng AUTH/S02/S04–S07/M4 đúng pins và phạm vi. Không chạy lại mutating suites cũ trên accepted fixtures để tạo proof M5.

---

**5. S18 — Tích hợp và nghiệm thu toàn MVP local**

**5.1. Mục tiêu, actors và phạm vi**

Chứng minh toàn bộ capability MVP qua dữ liệu và đường đi thật: Platform/CMS → publication → website hai entry → intake → lead operations → media/retention → quota/lifecycle.

Actors kiểm chứng gồm Platform-only, Tenant A Admin A1/A2, Tenant B Admin, multi-membership identity, anonymous visitor và narrow workers.

Coordinator chịu trách nhiệm tích hợp evidence. Reviewer độc lập đánh giá phần M5 mới. Khiêm quyết định nghiệm thu; ủy quyền nghiệm thu M4 không tự áp sang M5.

**5.2. Workflow và nguyên tắc closure**

1. Xác nhận baseline/source/build/evidence validity.
2. Phân loại từng AC thành valid reuse, affected recheck hoặc missing proof.
3. Chạy một luồng tích hợp tối thiểu thật.
4. Bổ sung missing rights/concurrency/UI/fault cases.
5. Review độc lập M5 và đóng findings.
6. UAT, preservation, final evidence map và bàn giao.
7. Ghi quyết định nghiệm thu riêng với technical result.

Giữ riêng:

`CODE_INTEGRATED → VERIFIED_LOCAL → READY_FOR_ACCEPTANCE → quyết định nghiệm thu`

Nếu có API/UI/library error, dừng luồng phụ thuộc, giữ evidence và lập repair plan cụ thể trước khi sửa. Không dùng reseed/reset/restart mù. Sửa thông thường tiếp tục trong execution authority còn hiệu lực; material change phải được review lại.

**5.3. Dependencies và contracts**

S18 phụ thuộc capability/proof S01–S17, gồm S02b và AUTH hiện hành.

S18 không tự mở tính năng/schema mới chỉ để hoàn thành checklist. Khoảng trống behavior phải được gắn AC, module owner, repair scope và phép kiểm tra xác nhận.

Các điểm tích hợp trọng tâm:

- Entry/primary revision với publication/config/locale.
- Lifecycle với public/media/intake/read/export.
- Quota với DB transactions, receipts và storage reservation.
- Deletion với sources/history/intents/worker effects.
- Browser state với current authority, conflict và unknown outcome.

**5.4. Tasks và thứ tự**

| Task | Kết quả | Owner |
| --- | --- | --- |
| **S18-T01** | AC/evidence map và preservation baseline; chỉ rõ proof cần bổ sung | Coordinator + QA |
| **S18-T02** | Publish VI/EN → hai entry → activate → form → một lead list → A1/A2 xử lý | Coordinator + API/CMS/Website |
| **S18-T03** | Pending/history/restore/unpublish và withdrawal xuyên hai entry, cả hai theme | QA + Publishing/Media |
| **S18-T04** | Quota → suspension → read/export/safety withdrawal → reactivation → confirmed deletion tenant riêng | QA + Platform/Lifecycle |
| **S18-T05** | Desktop/mobile/keyboard và meaningful empty/loading/error/denied/conflict/unknown-result gaps | CMS/Website QA |
| **S18-T06** | Restricted-role/worker/Bun checks, affected builds/type/lint, preservation và fresh exposure assessment | Coordinator + QA/Security |
| **S18-T07** | Independent review M5, repair và affected recheck | Reviewer + owners |
| **S18-T08** | UAT/demo, final dispositions, limits và acceptance handoff | Coordinator + Khiêm |

**5.5. Cách tái sử dụng evidence**

| Nguồn | Phần tiếp tục dùng khi còn hợp lệ |
| --- | --- |
| **M1/AUTH** | Password-only onboarding/session/reset/revoke/last-admin, local CAPTCHA, browser lost-ACK retry, paging/loading và controlled-boundary proof |
| **M2** | Retention/expiry clearing, lead deletion graph, media processing/purge/retry, editorial history/restore/unpublish |
| **M3** | Dental content breadth, ordinary locations/prices, permission history và current withdrawal |
| **M4** | Hai theme/shared schema, builder/campaigns, VI/EN, SEO, source/consent và media/worker proof |
| **Review trước** | Kết luận đúng source/artifact pins; review lại phần bị M5 đổi hoặc evidence mới làm thay kết luận |

Không chạy mọi tổ hợp page × theme × locale × width × state. Dùng coverage theo rủi ro và tác động.

Historical FAIL runs và NOT_RUN modes giữ nguyên. Equivalent proof chỉ đóng criterion tương ứng; không đổi lịch sử thành một lượt chạy PASS mới.

**5.6. Điều kiện đóng S18**

- Từng local AC bắt buộc có proof hoặc equivalent proof hợp lệ.
- Có real integrated journeys, không chỉ mocks/build/screenshots rời.
- Không còn blocking finding về authorization, isolation, data loss, idempotency, publication integrity hoặc deletion.
- UI mới và UI bị tác động có authenticated desktop/mobile/keyboard/state evidence phù hợp.
- Preservation, source/build/evidence pins và redaction checks đạt đúng phạm vi.
- Review M5 và UAT có kết quả thực tế.
- Báo rõ technical completion, quyết định nghiệm thu và mọi residual limits.

---

**6. Thứ tự tích hợp toàn M5**

| Wave | Nội dung | Điều kiện chuyển tiếp |
| --- | --- | --- |
| **W0 — Chuẩn bị được cấp quyền** | Lưu plan trước dependent writes; xác nhận owner, baseline, fixtures/workers và preservation scope | Có execution authority cụ thể |
| **W1 — Hai entry và quota đại diện** | S16-T01–T03; S17-T01–T02 có thể tiến hành độc lập | Một trang/ảnh/form thật qua hai entry; quota boundary thật |
| **W2 — Primary và delivery** | S16-T04–T07; media quota S17-T03 | Direct redirects, SEO/locale/media/current mapping nhất quán |
| **W3 — Lifecycle và export** | S17-T04–T06 | Suspension/read/export/safety actions/reactivation đúng |
| **W4 — Confirmed deletion** | S17-T07–T08 trên tenant thử riêng | Quyền xóa rõ; fault/retry/races và preservation đạt |
| **W5 — Full local closure** | S18 integrated gaps, final review, UAT và handoff | Tất cả applicable local AC có disposition đạt |

S18-T01 bắt đầu sớm để tránh phát hiện proof gap ở cuối. Chỉ block consumers có dependency thực; không yêu cầu freeze toàn bộ đội.

---

**7. Ma trận truy vết S16–S18**

| AC | Đóng góp S16 | Đóng góp S17 | S18 xác nhận |
| --- | --- | --- | --- |
| **AC-01** | Host/path/binding isolation, activate đúng tenant | Quota/lifecycle/export/delete authorization | Hai tenant, multi-membership, Platform-private denial |
| **AC-02** | Activation không publish hoặc sửa snapshots | Lifecycle không tự đổi Draft/live | Save/preview/publish/history/restore/unpublish |
| **AC-03** | Hai entry cùng current media eligibility | Suspended safety withdrawal, deletion/purge | Outstanding access, revocation và purge proof |
| **AC-04** | Cross-entry 24h idempotency và common lead list | Không quota lead; không mất accepted lead/intent | Form thật → DB → A1/A2 operations/capture |
| **AC-05** | Page identities/base đúng cho content families | Không thêm branch semantics | Reuse M3 và recheck phần URL/display bị đổi |
| **AC-06** | Primary, direct 301/302, actual-language SEO | Lifecycle loại resource không eligible | HTTP/HTML/browser consistency |
| **AC-07** | Binding/verifier/TLS eligibility local, migrations/races | Current lifecycle eligibility | Đóng local; live DNS/TLS riêng |
| **AC-08** | Domain/primary UI thật | Quota/lifecycle/export UI thật | Capability breadth và responsive/state coverage |
| **AC-09** | Ngoài phạm vi | Không tự chọn Production policy | Deferred, không tuyên bố Production-ready |
| **AC-10** | Routing/consumer paths mới dùng Bun | Export/lifecycle/worker paths mới dùng Bun | Actual entrypoints và affected runtime/build |
| **AC-11** | Entry change không đổi retention/receipt expiry | Export/reactivation/deletion tôn trọng D4 | Reuse S06 và integration mới |
| **AC-12** | Shared site/data, revisions, URL/jobs | Lifecycle/quota xuyên entry và worker | Integrated journeys, stale mapping và preservation |

---

**8. Kiểm chứng, giới hạn và điều kiện bàn giao**

Khi được cấp execution authority, kiểm chứng theo từng vertical slice:

- Restricted-role PostgreSQL/API integration cho constraints, RLS, admission, receipts và races.
- HTTP status/headers/Location/HEAD/body checks cho routing và redirects.
- Browser thật với normal authentication, dữ liệu thật và positive fixture ownership.
- Actual storage/decoder/worker effects trong scope M5 mới.
- Existing root `typecheck`, `lint`, `build` và focused tests phù hợp thay đổi.
- Preservation trước/sau trên original-column hashes và protected file hashes/modes; named volatile exceptions phải có căn cứ.
- Fresh M5 exposure review tại source/build pins tương ứng.

Giữ audit **braces FAIL/open**, reassess **2026-10-22** hoặc sớm hơn theo patch/dependency/exposure trigger và trước Production. Không đổi deadline hoặc coi M4 deferral là M5/Production waiver.

Giữ mọi historical FAIL/Unknown/NOT_RUN, gồm natural waiting, operational backup/restore, unavailable historical navigation, browser-engine/exhaustive combinations và các phạm vi chưa thực thi. Không dùng “full MVP local” để suy ra indexing, live DNS/TLS, external delivery, Production SLO hoặc AC-09.

**Không còn quyết định chính sách local nào đang chờ trong S16-D02–D06 và S17-D01–D08.** Numeric quota thương mại vẫn được nhập thủ công; không cần một default chung để triển khai capability. Production grace/backup/tombstone retention dùng thật vẫn thuộc track riêng.

**Trạng thái cuối lượt:** M5 v0.1 đã hoàn thiện trong chat theo các quyết định đã duyệt. Không ghi file, sửa source/data/configuration hoặc chạy kiểm chứng sản phẩm M5.

**Bước tiếp theo**

1. **Khuyến nghị:** cấp quyền lưu M5 v0.1 và provenance vào hồ sơ dự án; kết quả là kế hoạch được lưu chính thức, vẫn chưa triển khai.
2. Khi muốn bắt đầu, cấp quyền riêng cho execution M5 local, nêu rõ additive migrations, fixtures/technical resources mới, scoped workers/fault checks và deletion trên tenant thử mới; Git/deploy/Production tiếp tục tách riêng.

## Complete approved decision recommendations

Khiêm directly stated “Duyệt toàn bộ khuyến nghị S16-D02–D06 và S17-D01–D08. Hoàn thiện kế hoạch M5 v0.1 trong chat theo các quyết định này; chưa ghi file hay triển khai.” before the finalized plan and current execution approval. Original recommendation source UTF-8 SHA-256: `1f064761aeed863458c6b195fe1ebb7b0b450b4d296bb4a923e3232f482e562a`; characters: 20053. Its Proposed/review wording is historical; these recommendations are approved within the current local scope.

**Khuyến nghị: chốt M5 theo cơ chế cấu hình thủ công, kiểm tra quyền và dữ liệu tại thời điểm thực hiện, không tự động chuyển primary hoặc xóa tenant theo một thời hạn mặc định.**

Các phương án dưới đây đều là **Proposed**, chưa trở thành quyết định đã duyệt. Tôi giữ nguyên [primary/301 policy](../decisions/004-primary-url-and-301-redirects.md), [locale/fallback M4](../decisions/013-local-m4-builder-campaigns-locales.md) và [quota/lifecycle boundary](../workflows.md).

**S16-D02 — Cơ chế xác minh binding và TLS trong local**

**Khuyến nghị:** dùng một interface verifier và một adapter **chỉ dành cho kiểm chứng local**.

- UI có nút yêu cầu kiểm tra; người dùng không được tự gửi `verified: true` hoặc `tlsValid: true`.
- Kết quả kiểm tra gắn với `bindingId`, normalized host, tenant/site, binding generation và thời điểm quan sát.
- Bằng chứng TLS có hostname được kiểm tra và thời điểm hết hiệu lực. Đổi host hoặc generation làm bằng chứng cũ mất giá trị.
- Adapter local chỉ nhận host thử được khai báo trong manifest M5 và đi tới loopback. Không truy vấn DNS hoặc cấp chứng chỉ thật.
- Bằng chứng ghi rõ `synthetic-local`; không được hiển thị như xác minh DNS/TLS thật.
- Nếu cấu hình adapter local ngoài chế độ local được cho phép, hệ thống từ chối cấu hình. Chưa có verifier thật thì không được activate domain thật.

**Trade-off:** chứng minh được workflow và các điều kiện từ chối, nhưng chưa chứng minh ownership DNS, certificate chain, TLS renewal hoặc live serving. Tích hợp verifier thật vẫn là việc riêng sau này.

**Anh cần chốt:** chấp nhận local synthetic verifier cho S16; DNS/TLS thật tiếp tục ngoài M5 local.

---

**S16-D03 — Transaction, version và retry khi đổi primary**

**Khuyến nghị:** một lệnh activate có `operationId`, expected binding version và expected primary version.

Trong cùng transaction, hệ thống:

1. Kiểm tra current actor, membership, tenant và password reauthentication trong cửa sổ **5 phút đã có**.
2. Khóa tenant theo thứ tự thống nhất với publication/lifecycle.
3. Kiểm tra binding hiện tại, verification/TLS và khả năng phục vụ các route Published tương đương.
4. Ghi primary mới, tăng revision, lưu command receipt và redacted audit.

Retry cùng operation/payload trả kết quả đã ghi sau khi kiểm tra quyền hiện tại. Cùng operation nhưng payload khác bị conflict. Nếu receipt là của lần activate cũ và primary đã đổi tiếp, response phải phân biệt **kết quả lịch sử** với **primary hiện hành**; retry không activate ngược lại.

Readiness trên UI chỉ là thông tin chuẩn bị. Nếu publication, quyền hoặc binding đổi trước commit, lệnh phải kiểm tra lại hoặc trả conflict.

**Trade-off:** cần bổ sung revision/receipt và phối hợp lock giữa modules. Đổi lại, không có primary nửa chừng hoặc retry làm đảo cấu hình.

**Anh cần chốt:** chấp nhận cơ chế này trong gói kỹ thuật M5. Không cần anh chọn SQL hay tên bảng.

---

**S16-D04 — Phối hợp direct 301 với fallback EN→VI**

**Khuyến nghị:** chọn status theo **publication thực sự tồn tại**, rồi tính destination cuối cùng một lần.

| Điều kiện sau activation | Kết quả |
| --- | --- |
| Godent VI có VI Published đủ điều kiện | `301` trực tiếp tới custom VI tương đương |
| Godent EN có EN Published đủ điều kiện | `301` trực tiếp tới custom EN tương đương |
| Godent EN thiếu EN, có VI fallback đủ điều kiện | `302` trực tiếp tới custom VI |
| Custom EN thiếu EN, có VI fallback đủ điều kiện | `302` tới custom VI |
| Không có publication hoặc fallback hợp lệ | Not-found an toàn |
| Backend lỗi | Trả lỗi; không giả thành thiếu bản dịch |

HEAD có cùng status/Location với GET và không có body.

**Trade-off:** trường hợp thiếu EN cần một ngoại lệ rõ trong ma trận routing: request đó không phải alias của một trang EN Published. Dùng `301` sang VI sẽ biến thiếu bản dịch tạm thời thành chuyển hướng vĩnh viễn; dùng `301 → 302` tạo chuỗi redirect.

**Anh cần chốt:** chấp nhận **missing EN → một 302 trực tiếp tới primary VI**, giữ 301 cho các trang Published tương đương cùng ngôn ngữ.

---

**S16-D05 — Phạm vi hostname và vòng đời domain**

**Khuyến nghị cho M5:**

- Nhận **hostname chính xác dạng ASCII**, chuẩn hóa chữ thường. Chưa nhận Unicode hostname trực tiếp, wildcard, IP, URL có scheme/path/query hoặc port tùy ý.
- Apex và `www` là hai host riêng; không tự suy quyền hoặc tự tạo alias cho nhau.
- Chặn host nền tảng, namespace nội bộ và các hostname local ngoài manifest thử.
- Mỗi host chỉ có một binding hiện hành. Binding đã removed không được bật lại bằng evidence cũ.
- Claim lại cùng hostname phải tạo binding/generation mới và xác minh lại; không chuyển tiếp quyền, receipt hoặc job của binding cũ.
- Đổi primary sang custom domain mới cần readiness và explicit activation như lần đầu.
- Nếu vẫn kiểm soát host cũ và binding còn hợp lệ, host cũ có thể redirect **trực tiếp** tới primary mới. Nếu không còn hợp lệ thì dừng phục vụ.
- Không cho remove binding đang là primary mà để primary treo. Phải chọn phương án thay thế rõ ràng trong cùng thao tác có version.
- TLS mất hiệu lực làm mất delivery eligibility; không tự chuyển primary về Godent. Khi có bằng chứng TLS mới hợp lệ, cùng binding còn active có thể phục vụ trở lại; binding đã removed thì không.

Với thao tác **chủ động trở về Godent**, khuyến nghị cho phép nhưng yêu cầu cảnh báo cached 301. Không phát reverse 301 từ custom host cũ về Godent; nếu host đó vẫn hợp lệ, có thể phục vụ cùng site với canonical Godent. Điều này tránh tạo cặp redirect ngược nhau.

**Trade-off:** phạm vi exact-host dễ kiểm soát hơn nhưng chưa tiện cho wildcard/IDN. Trở về Godent cũng không bảo đảm khôi phục tức thì trên trình duyệt đã cache 301.

**Anh cần chốt:**

- M5 chỉ hỗ trợ exact ASCII host; `www` phải đăng ký riêng.
- Cho phép manual return-to-Godent theo quy tắc trên, hay chỉ cho thay bằng custom domain khác trong M5.

---

**S16-D06 — Query parameters, tracking và URL**

**Khuyến nghị:** dùng hai nhóm allowlist rõ ràng.

| Nhóm | Hành vi |
| --- | --- |
| Tracking hiện có | Giữ `utm_source`, `utm_medium`, `utm_campaign` khi hợp lệ; canonical loại tracking |
| Query chức năng đã đăng ký | Giữ search/filter/cursor theo đúng route và context |
| Query không được hỗ trợ | Không đưa vào redirect hoặc attribution |
| Query chức năng sai/nhập nhằng | Trả validation error; không âm thầm biến thành truy vấn khác |

Cùng locale, filter và dữ liệu tenant/site thì chuyển host không tự làm mất cursor. Khi fallback EN→VI, reset cursor vì locale context đã đổi; giữ search/filter còn có nghĩa theo contract hiện tại.

Không bổ sung raw referrer, first-touch cookie hoặc tracking fields mới.

**Trade-off:** một số query ngoài allowlist sẽ không được chuyển tiếp. Đổi lại, không tạo open redirect hoặc biến URL khách gửi thành nguồn attribution tùy ý.

**Anh cần chốt:** giữ allowlist hiện tại và query chức năng đã có; chưa mở rộng analytics trong M5.

---

**S17-D01 — Quota áp cho tài nguyên nào và đếm thế nào**

**Khuyến nghị:** M5 có hai quota:

| Quota | Cách tính đề xuất |
| --- | --- |
| `content_items` | Một logical resource theo tenant/kind/resource ID tính một đơn vị |
| `media_bytes` | Dung lượng object thực còn lưu cộng dung lượng đã reservation cho ghi mới |

Quy tắc `content_items`:

- Draft và Published của cùng resource tính một.
- VI/EN, revisions, publication snapshots và references không tạo thêm đơn vị.
- Service được M4 adoption giữ cùng identity nên không bị đếm hai lần.
- Site/presentation config là cấu hình singleton, không tính như content item.
- Home là một content item.
- Unpublish không giải phóng đơn vị vì resource vẫn tồn tại.
- Locations là content thông thường; không thêm quota “chi nhánh”.

Quy tắc `media_bytes`:

- Tính originals, derivatives và object còn tồn tại sau lỗi.
- Retry không tính lại cùng reservation/object.
- `rejected` hoặc `withdrawn` không tự giảm usage. Chỉ giảm khi xác nhận object đã được xóa.
- UI phân biệt dung lượng đang lưu với phần đang giữ chỗ.

**Không đặt quota số lead trong M5.** Giữ abuse/rate controls và D4 retention hiện tại. Cũng chưa đặt quota membership, số locale hoặc từng loại nội dung.

**Trade-off:** tổng content count đơn giản nhưng không phân biệt một FAQ với một landing page lớn. Media bytes kiểm soát storage tốt hơn nhưng cần reservation và đối soát object thật.

**Anh cần chốt:** chọn hai dimensions trên và không giới hạn số lead trong M5. Chưa cần chọn mức quota thương mại.

---

**S17-D02 — Quota chưa cấu hình, chế độ áp dụng và giá trị**

**Khuyến nghị:** không dùng `null` để ngầm hiểu zero hoặc unlimited.

Platform nhìn thấy ba tình trạng rõ ràng:

- **Chưa cấu hình:** giữ behavior hiện tại; hiển thị chưa có quota policy.
- **Theo dõi:** đo usage nhưng chưa chặn tăng.
- **Áp dụng:** bắt buộc có giới hạn cụ thể cho từng dimension được bật.

Tenant cũ không bị tự chuyển sang chế độ áp dụng. Với tenant mới, Platform Admin phải chọn chế độ trước khi bàn giao tenant. Chọn áp dụng thì phải nhập quota rõ ràng.

Giá trị `0`, nếu được nhập và xác nhận, nghĩa là chặn tăng mới của dimension đó; dữ liệu đã có vẫn được giữ.

UAT dùng quota thử riêng trên tenant M5 mới, chẳng hạn quota bằng usage ban đầu cộng đúng một lần tạo. Đây là tham số thử, không thành default của sản phẩm.

**Trade-off:** cần thao tác cấu hình rõ ràng hơn. Tenant chưa áp dụng quota vẫn có thể tăng trong các technical limits hiện hành; Platform phải nhìn thấy tình trạng này.

**Anh cần chốt:** chấp nhận chế độ “theo dõi” và bảo toàn tenant cũ như trên. Các mức thật để Platform nhập thủ công; không tự đặt trong M5.

---

**S17-D03 — Enforcement, concurrency và quota failure**

**Khuyến nghị:** kiểm tra tại DB trong transaction tạo tài nguyên, dùng tenant lock hiện tại và operation receipt.

- Hai request tranh slot cuối chỉ một request được nhận.
- Retry thành công không chiếm thêm slot.
- Request bị từ chối trước commit không tạo tài nguyên hoặc receipt thành công.
- Nếu quota được nâng sau đó, request chưa từng được chấp nhận có thể thử lại.
- Quota giảm dưới usage không xóa dữ liệu hoặc chặn đọc/export/sửa nội dung hiện có chỉ vì số item không tăng.
- API trả lỗi riêng `QUOTA_EXCEEDED`, kèm dimension, usage và limit; không dùng thông báo lỗi quyền hoặc thanh toán.

Media cần reservation trước khi ghi original, đồng thời bảo đảm có ngân sách cho output xử lý được phép. Object hoặc I/O chưa xác định kết quả phải tiếp tục chiếm reservation. Không giải phóng chỉ vì timeout; stale worker không được settlement lần hai.

**Trade-off:** serialize các lệnh tăng tài nguyên cùng tenant có thể tạo chờ lock. Đổi lại, quota có hiệu lực dưới concurrency. Chưa cần thêm broker hoặc distributed counter.

**Anh cần chốt:** chấp nhận DB enforcement và reservation. Đây là quyết định kỹ thuật; không cần chọn thuật toán lock chi tiết.

---

**S17-D04 — Quyền khi tenant suspended**

**Khuyến nghị:** suspended giữ đọc/export, chặn thay đổi nghiệp vụ; có ngoại lệ hẹp cho hành động **giảm phơi lộ dữ liệu**.

| Thao tác | Suspended |
| --- | --- |
| Public website/media, intake mới, publish/republish | Chặn |
| Đọc content/draft/history, lead chưa hết hạn, media được quyền đọc | Cho phép theo current authorization |
| Export | Cho phép cùng phạm vi đọc |
| Save/create/upload, thêm permission, quản lý lead, retention extension | Chặn |
| Unpublish, withdraw publication permission, global media withdrawal | Cho phép với current quyền, reason/version và reauthentication phù hợp |
| Retention deletion, audit expiry, purge bảo vệ dữ liệu | Tiếp tục theo scope hợp lệ |
| Password/session security | Giữ lifecycle AUTH độc lập |

Việc cấp link private media cho một lượt đọc hợp lệ phải được phân loại là read capability, dù endpoint dùng POST. Không mở mọi POST cho suspended tenant.

**Trade-off:** ngoại lệ withdrawal làm permission matrix phức tạp hơn strict read-only, nhưng giúp xử lý yêu cầu thu hồi ngay mà không phải mở lại website trước.

**Anh cần chốt:** có cho phép ba hành động an toàn **unpublish/withdraw permission/media withdrawal** khi suspended hay giữ strict read/export-only. Tôi khuyến nghị cho phép ngoại lệ hẹp này; đây là thay đổi rõ so với nhiều active-only guards hiện tại.

---

**S17-D05 — Export phạm vi gì, định dạng gì và nhất quán ra sao**

**Khuyến nghị:** export có version, dạng **ZIP chứa manifest và dữ liệu JSONL**, stream trực tiếp tới người dùng.

Các nhóm xuất:

- Website/config/content, Draft/Published/history trong phạm vi được đọc.
- Leads chưa hết hạn, notes/history, consent và source snapshots.
- Media metadata/permission records được phép đọc.
- Tùy chọn kèm binary media mà actor **hiện có quyền tải**. Manifest ghi rõ phần bị loại hoặc không khả dụng.

Không xuất password hashes, session/token/secret, storage credentials, internal worker credentials hoặc dữ liệu tenant khác. Không xuất signed URL như một bản sao media lâu dài.

Consistency đề xuất:

- Đọc theo batch/keyset có giới hạn.
- Mỗi record mang version và thời điểm xuất.
- Kiểm tra lại authorization/expiry trước khi xuất từng batch; mất quyền thì dừng.
- Không hứa snapshot đồng thời của toàn tenant.
- Manifest hoàn tất chỉ được ghi khi export thành công. Download lỗi không được hiển thị như bản export đầy đủ.
- Không giữ bản export server lâu dài, nên chưa phát sinh một retention period cho export artifacts.

**Trade-off:** format đầy đủ hơn CSV nhưng cần công cụ đọc JSONL. Dữ liệu có thể thuộc các thời điểm khác nhau trong lượt xuất. Đây là **business export, không phải backup có thể restore toàn hệ thống**. Những bytes đã tải xuống không thể thu hồi.

**Anh cần chốt:** ZIP/JSONL và tùy chọn media binary; hoặc chỉ muốn export leads trước. Tôi khuyến nghị phạm vi đầy đủ trên để quyền export khi suspended có giá trị thực tế.

---

**S17-D06 — Ai yêu cầu, ai xác nhận và ai thực thi deletion**

**Khuyến nghị:** hai bước theo hai vai trò hiện có, không thêm Owner role.

1. Một current Tenant Admin gửi yêu cầu, xác nhận đúng tenant, phạm vi xóa và thời điểm sớm nhất được thực hiện; dùng password reauthentication.
2. Platform Admin kiểm tra request, xác nhận phạm vi rồi ra lệnh thực thi khi đủ điều kiện.

Platform-only không được tự tạo một “tenant confirmation”. Không mặc định yêu cầu tất cả Tenant Admin đồng thuận.

Tài khoản có cả hai quyền có thể làm hai bước, nhưng phải ghi riêng hai hành động. Nếu anh muốn hai người khác nhau thì đó là policy bổ sung cần chọn rõ.

Trước bước không thể đảo ngược, tenant có thể hủy request. Nếu confirmation bị hủy, version đổi hoặc người xác nhận mất membership trước khi bắt đầu, phải xác nhận lại. Khi đã vào bước irreversible, không cung cấp nút “undo” giả; worker tiếp tục hoàn tất cleanup theo execution đã được chấp nhận.

**Trade-off:** hai bước giảm thao tác nhầm nhưng chưa phải nguyên tắc hai người kiểm soát độc lập nếu cùng một người có cả hai quyền.

**Anh cần chốt:** một Tenant Admin đủ quyền có thể xác nhận yêu cầu; Platform thực thi; không bắt buộc hai người khác nhau. Tôi khuyến nghị phương án này cho MVP.

---

**S17-D07 — Grace, phạm vi xóa, tombstone và backup**

**Khuyến nghị về grace:** M5 local dùng **thời điểm `executeAfter` bắt buộc trên từng request**, được tenant xác nhận. Không có default hoặc scheduler tự xóa khi hết giờ.

Platform chỉ được thực thi sau thời điểm đó. Chưa có thời điểm được xác nhận thì request chưa đủ điều kiện. Cách này cho phép kiểm chứng local mà không tự chọn một grace period chung.

**Khuyến nghị về phạm vi xóa:**

- Khi bắt đầu execution: chặn public, intake, writes và export mới; fence worker để không tạo thêm dữ liệu.
- Xóa dữ liệu nghiệp vụ tenant, kể cả Draft/revisions/publication snapshots, leads/private graph, permission evidence và media objects thuộc phạm vi đã xác nhận.
- Xóa theo contracts từng module, có checkpoint và retry; không dùng blanket cascade xuyên hệ thống.
- Giữ global identities/credentials và dữ liệu tenant khác.
- Giữ audit redacted theo **365 ngày đã chốt**, không gia hạn audit cũ do tenant deletion.
- Giữ tombstone tối thiểu để chặn stale job/binding hoặc dữ liệu phục hồi xuất hiện trở lại. Tombstone không chứa tên, email, contact hoặc narrative content.

Đối với **local**, đề xuất giữ tombstone kỹ thuật mà chưa có TTL tự động; cần anh duyệt rõ giới hạn này. Retention tombstone dùng thật và backup retention vẫn phải chốt trước live use.

Chỉ báo hoàn tất phạm vi dữ liệu đang hoạt động khi DB graph và storage objects đã được xác nhận xử lý. Không gọi đó là “mọi bản sao đã bị xóa” khi backup hoặc file người dùng đã tải nằm ngoài phạm vi.

**Trade-off:** thao tác thủ công nhiều hơn, nhưng không tạo một chính sách grace chưa có căn cứ. Tombstone giúp chống hồi sinh dữ liệu nhưng vẫn là dữ liệu kỹ thuật cần quản lý retention.

**Anh cần chốt:**

- Local dùng `executeAfter` theo từng request, hay muốn một grace period cố định và cung cấp thời lượng.
- Phạm vi xóa gồm cả snapshots/media của tenant được xác nhận.
- Local giữ minimal tombstone chưa có TTL tự động; Production retention tiếp tục mở.

Mọi thử nghiệm xóa chỉ được dùng **tenant M5 mới, được cấp quyền xóa rõ ràng**. Không áp vào baseline, fixtures, snapshots, backlog hoặc evidence cũ.

---

**S17-D08 — Reactivation**

**Khuyến nghị:** Platform Admin chủ động chuyển Suspended→Active với reason, expected version, operation ID và reauthentication.

Reactivation:

- Không áp cho tenant đã bắt đầu irreversible deletion hoặc đã deleted.
- Không đổi primary, publish Draft, phục hồi membership/permission đã revoke hoặc reset retention.
- Không bị chặn chỉ vì usage đang vượt quota; quota chỉ tiếp tục chặn corresponding growth.
- Không enroll/start worker hoặc dispatch backlog. Deadline và retry budgets cũ không được gia hạn.
- Hiển thị readiness: binding/TLS, publication/media eligibility và tài khoản quản trị còn hợp lệ.

Tách **tenant Active** khỏi **mọi trang đều phục vụ được**. Nếu custom primary chưa hợp lệ, tenant có thể Active để Tenant Admin sửa cấu hình, nhưng public delivery vẫn bị chặn theo current eligibility. UI phải báo rõ website chưa sẵn sàng; không tự chuyển về Godent.

**Trade-off:** reactivation không đồng nghĩa website lập tức hoạt động đầy đủ. Đổi lại, tránh tình trạng tenant bị suspended nên không thể sửa domain, nhưng lại phải sửa domain mới được reactivated.

**Anh cần chốt:** cho phép reactivation với readiness warnings và current delivery checks, thay vì buộc mọi domain/media phải sẵn sàng trước khi trở về Active. Tôi khuyến nghị phương án này.

---

**Những lựa chọn cần anh quyết định**

Các chi tiết transaction/version/query có thể duyệt theo khuyến nghị kỹ thuật. Những lựa chọn ảnh hưởng trực tiếp nghiệp vụ là:

| Nhóm | Lựa chọn khuyến nghị |
| --- | --- |
| Domain | Local synthetic verifier; exact ASCII host; `www` riêng; cho manual return-to-Godent có cảnh báo |
| Redirect | Missing EN dùng một 302 trực tiếp tới primary VI |
| Quota | `content_items` + `media_bytes`; không quota số lead; mức thật nhập thủ công |
| Quota chưa áp dụng | Hiển thị rõ chưa cấu hình/theo dõi; không tự enforce tenant cũ |
| Suspension | Read/export và ngoại lệ hẹp cho unpublish/withdrawal |
| Export | ZIP/JSONL đầy đủ, media binary tùy chọn theo current rights |
| Deletion authority | Tenant Admin xác nhận, Platform thực thi; chưa bắt buộc hai người khác nhau |
| Deletion timing/retention | `executeAfter` từng request; local minimal tombstone chưa TTL; backup/Production policy vẫn mở |
| Reactivation | Explicit; readiness warnings; không tự phục hồi publication/quyền/backlog |

**Lượt này không ghi file hoặc triển khai.** Kiểm chứng sản phẩm mới vẫn **NOT_RUN**. M4 và mọi FAIL/Unknown/NOT_RUN được giữ nguyên; braces tiếp tục **FAIL/open**, reassess **2026-10-22** hoặc sớm hơn theo trigger, không có Production waiver.

**Bước tiếp theo**

1. **Khuyến nghị:** anh chốt bảng lựa chọn trên hoặc sửa từng ID; kết quả là bộ quyết định cụ thể để hoàn thiện M5 v0.1 trong chat.
2. Sau khi quyết định đã chốt, anh có thể cấp quyền riêng để lưu hồ sơ M5; việc duyệt phương án trong lượt này chưa cho phép ghi file hay triển khai.

## Execution ledger — initial plan save

Complete plan and decision source saved before application/schema/fixture/worker mutations. Initial task has no runtime/product PASS claim. Desktop owns root/runtime/contracts/migration integration and preservation; bounded assignments follow. Human M5 acceptance remains pending; the M4 delegated acceptance does not transfer.

## Local execution checkpoint — 2026-10-17

**IN_PROGRESS.** The direct approval dated2026-10-16 remains the execution authority across the local midnight boundary. No M5 human acceptance, Git delivery, deployment or Production proof is implied.

- Preservation capture:72tables /233213rows /1458protectedfiles. Preflight compared49applied migration checksums; all matched. Source function definitions were captured privately for exact guard repairs.
- Created only the new `gcms_m5_worker` credential and owned namespace. Existing credentials were not reset. Migrations0051–0056 applied forward after rolled-back compilation; every prior checksum matched. Migration/startup dispatched no workers.
- Created three positively owned synthetic M5 tenants and five new identities. Initial quota policy is an explicit synthetic monitor choice. Only the new Deletion tenant is enrolled for irreversible deletion; enrollment itself did not execute a worker. Four exact local hosts have owner-only attestation with explicit test expiry. DNS/TLS remains unverified outside this synthetic adapter.
- Native implementers own domain, platform and frontend boundaries. An independent native kit-reviewer inspected the new scope. Actual roles, parents, inherited model and required/requested/observed xhigh are recorded in [M5 evidence](../evidence/m5/). No independent runtime quality guarantee follows from effort metadata.
- Actual API/SQL journey:7tests/108assertions PASS, covering auth/isolation, real M3/M4 publication, concurrent quota, primary CAS/replay, two-entry intake with actual CAPTCHA, suspension/read/export/safety, and forged safety selectors. [Current run](../evidence/m5/api-local-challenge.xml).
- Direct restricted-role attestation tests:4tests/5assertions PASS. Forged proof, unlisted host, revoked legacy function and owner-only attestation access fail closed. [Evidence](../evidence/m5/domain-attestation-sql.xml).
- Actual storage/worker journey:2tests/51assertions PASS. Concurrent upload quota reserves once; real PUT/HEAD and Docker decoding settle usage; withdrawal does not free capacity until actual derivative purge; a lost PUT acknowledgment retains reservation until idempotent retry. Original retention remains unchanged. [Evidence](../evidence/m5/media-local-first.xml).
- Actual built website:6tests/110assertions PASS for GET/HEAD direct301, direct302 EN fallback, functional/tracking query, sitemap/robots, return-to-Godent custom200/canonical/navigation and forged headers. [Evidence](../evidence/m5/website-http-root-routing-repairs.xml).
- Four actual ZIP downloads independently passed Python zipfile CRC and completion-manifest validation with the declared25datasets. They are business exports, not operational backups. Raw downloads stay private; [sanitized receipt](../evidence/m5/export-zip-validation.json).

### Historical failures and bounded repairs

All failed checkpoints remain historical. They are not relabelled PASS:

1. Initial SQL compilation rolled back because database CREATE is unavailable to the migration role. Bootstrap had already created the empty owned namespace. Removed the unnecessary CREATE before first application; privileges were not expanded.
2. New fixture initialization rolled back because Bun bound a direct jsonb parameter as a JSON string. A SELECT-only probe confirmed string/null versus object/monitor. Fixture and provision transport now use `::text::jsonb`; no applied migration changed.
3. Independent review found caller-manufactured domain evidence and omitted deletion read fences. Forward0054 adds owner-only attestation and revokes the former execution seam;0055 covers13omitted private tables and current read helpers. Source re-review passed; deletion runtime proof remains pending below.
4. First API journey retained6PASS/1FAIL: Express query records have a null prototype. The entry query boundary now accepts only plain/null-prototype records, retaining exact keys and command validation. A resumed active binding requires explicit reverify, not a second verification in the same generation.
5. Repeated intake legitimately reached the existing CAPTCHA threshold. The harness now completes the real challenge without resetting counters. The preceding failed runs are preserved beside the final7PASS run.
6. Initial website HTTP journey retained3PASS/3FAIL. Forward0056 fixes custom-root canonical `/`. Installed Next16.4.1 normalizes loopback proxy URLs; an app-local `skipProxyUrlNormalize` setting plus a plain loopback internal rewrite prevents an external rewrite/self301 loop. The current six real HTTP cases pass; no global or Production configuration changed.
7. Initial ZIP checker expected26datasets. Source comparison confirmed the declared25. Only the checker expectation was corrected; no ZIP bytes changed.
8. Extended domain lifecycle currently retains2PASS/2FAIL. www binding/collision and direct controlled replacement passed. Binding generation is scoped by the fresh binding identity; the test must verify the identity tuple and non-reuse of old proof. Current-primary private address/readiness needs a bounded follow-up, separate from the content-only activation precondition.

Pending: authenticated browser UAT, final controlled-domain checks, confirmed deletion/fault/retry/concurrency on the new owned Deletion tenant, effective deletion read-fence probes, final preservation/source/build pins, scoped independent re-review and final local acceptance handoff. Audit braces remains FAIL/open; fresh M5 source/build exposure reassessment and the2026-10-22/earlier-trigger/before-Production boundary remain required. No Production waiver.


### Bounded ownership and shared integration contract

Desktop /root keeps scripts/**, package/workspace/runtime, apps/api/src/app.ts and auth/runtime-environment.ts, media.service integration, shared records/manifests and final migration/application/runtime/UAT/preservation. Three disjoint native xhigh assignments are authorized by the approved team/independent-review plan; no child delegation. All workers preserve other edits and may not run migrations/fixtures/workers against retained data. Root performs actual apply/fixture/runtime integration.

- Domains implementer: new m5-domains contract/module/service/helpers; migrations/0052_m5_domains.sql; focused m5-domains tests; existing public portions of publication.service.ts, content.service.ts, builder.service.ts, intake.service.ts, builder-intake.service.ts, http-security.ts and intake-security.ts. No database/index.ts, app.ts, scripts, UI or shared docs.
- Platform implementer: new m5-platform contract/module/services/export and m5-lifecycle worker; migrations/0051_m5_platform.sql; database/index.ts; focused m5-platform tests. No existing domain/public/media service files, app.ts, scripts, UI or shared docs.
- FE implementer: apps/admin/** and apps/website/** only, against the two canonical new API contracts. No API/contracts/SQL/scripts/shared docs.

Canonical shared SQL gate supplied by0051: gcms_m5.is_live(t text) boolean (active tenant and no deleting/deleted lifecycle); gcms_m5.is_readable(t text) boolean (active/suspended, no deleting/deleted); gcms_m5.require_read(t text) checks current membership/context/readability; gcms_m5.require_safety(t text) same current membership plus scoped safety action/reauth at commands. Platform owns lifecycle metadata/version/phase and quota. Domains owns binding/primary and gcms_m5.delete_domain_data(t) for confirmed tenant cleanup. Migration0051 precedes0052. Gate/read helpers never grant blanket platform-private access.

Database helpers supplied by Platform: withReadTenant and withSafetyTenant (same callback signature as withTenant), preserving current session/membership locks; normal withTenant stays active/live-only. Root adapts existing private read/safety consumers after Domains releases their files.

New domain and platform contracts are canonical inputs for FE; owners publish routes/types early and notify changes. Exact schema mechanics are engineering detail within settled policy; no changing approved product/data boundaries. Unknowns/failures require a focused repair plan before affected edits.


### Preservation and ownership checkpoint

Initial sandbox-local DB/socket access was refused before any DB writes; the same authorized read-only capture through reviewed local access passed. Fresh baseline72tables/233213rows/1458protected files, with no raw data emitted; preflight49applied migrations all disk/checksum matching. Newgcms_m5namespace and narrowgcms_m5_worker role created; old credentials unchanged and dispatch not started. Native3implementers role/parent/inheritedgpt-6.1-sol/xhigh PASS in evidence/m5/native-runtime.json.

Root transfers new0053_m5_read_safety.sql and private read/safety adaptations of publication/content/builder services to Domains implementer before any root0053 edit. Root retains media.service and runtime/app wiring. Explicit scoped safety commands must branch on validated command action; no client-settable GUC grants generic mutation access. Domains0052 released; Platform0051/ReadSafety0053 pending release/apply.

## Final local handoff — 2026-10-17

**CODE_INTEGRATED + VERIFIED_LOCAL / READY_FOR_USER_REVIEW. M5 human acceptance PENDING.** The original complete plan/recommendations above were saved before dependent writes. Direct local authority remains the quoted2026-10-16approval; no M5 acceptance was fabricated. Technical UAT completion is separate from Khiêm's decision. Earlier IN_PROGRESS/NOT_RUN/FAIL checkpoints are preserved.

### Delivered behavior and vertical-task closure

| Tasks | Actual integrated result and evidence |
| --- | --- |
| S16-T01–T02 | Exact binding registry, protected synthetic verification, two entries/same current publication/config/media; restricted-role forged proof/old-function negatives. [API](../evidence/m5/api-local-challenge.xml), [attestation](../evidence/m5/domain-attestation-sql.xml), [S18 two-theme flow](../evidence/m5/mvp-local-first.xml). |
| S16-T03 | Both service and landing intake use one tenant-scoped24hreceipt/lead list; actual CAPTCHA, A1/A2 management and B-only local capture. [API](../evidence/m5/api-local-challenge.xml), [browser](../evidence/m5/ui/68965643-e47c-415d-a127-d2b8fc3350bd/results.json), [MVP](../evidence/m5/mvp-local-first.xml). |
| S16-T04–T05 | Explicit CAS/receipt primary, deep same-language GET/HEAD301, direct missing-EN302VI, actual-language canonical/navigation/SEO/metadata/query and dedicated API/POST contracts. [Built HTTP](../evidence/m5/website-http-root-routing-repairs.xml), [frontend193/1243](../evidence/m5/frontend-final.xml), reused M4 SEO breadth. |
| S16-T06–T07 | Distinct www/cross-tenant collision, controlled replacement/deactivation/remove/re-register, no old-receipt resurrection, pending-current-primary recovery, stale context409, return-to-Godent custom200/absolute navigation. [Three reused successful cases](../evidence/m5/domain-lifecycle-readiness-repair.xml), [focused final case](../evidence/m5/domain-verification-response-configured.xml), browser and independent review. |
| S17-T01–T02 | Manual explicit policy, atomic initial policy before invitation, zero boundary, identity dedup, concurrency/downgrade and restricted direct-write denial. [API](../evidence/m5/api-local-challenge.xml), [provision](../evidence/m5/provision-local.xml), [pure33/267](../evidence/m5/api-unit-final.xml). No commercial default added. |
| S17-T03 | Real PUT/HEAD/decoder/worker settlement, concurrent reservation, lost PUT acknowledgment and physical purge/accounting. [Media2/51](../evidence/m5/media-local-first.xml). Withdrawal alone does not free stored bytes. |
| S17-T04–T06 | Suspension denies public/intake/business writes; current members retain private reads, signed media, ZIP and narrow safety unpublish/withdrawal. Explicit reactivation retains publication/config/primary and does not dispatch backlog. [API](../evidence/m5/api-local-challenge.xml), browser lifecycle cases and [export revocation](../evidence/m5/export-authority-local.xml). |
| S17-T05 | Actual active/suspended ZIP downloads include optional authorized binaries; CRC and25dataset/final manifest checks. Revocation between batches stops the export before final manifest/EOCD; a new download is denied. [ZIP receipt](../evidence/m5/export-zip-validation.json), browser and revocation test. Export remains a bounded current-authorized batch view, not restore backup. |
| S17-T07–T08 | New Deletion fixture only: request/cancel/confirmation, executeAfter, revoked confirmation, concurrent execute, immediate private read fences, actual storage DELETE/HEAD, lost ACK, retry/fence/competing worker and explicit71-table graph cleanup. [One-shot1/333](../evidence/m5/deletion-local-first.xml). No reset/rerun after completion. |
| S18-T01–T04 | AC/evidence map and old-proof reuse; VI/EN/two themes/two entries, real intake/lead/capture, pending/history/restore/explicit publish/unpublish, quota/lifecycle/deletion. [Unique29cases/987assertions](../evidence/m5/integration-summary.json). |
| S18-T05 | Browser31cases covered:19priorPASS retained as REUSED +12newPASS, not31fresh passes. Domain/Data320/390/1440; Platform additional320/390/1440; signed private media, suspended/active ZIP, primary outage/recovery and zero uncaught page errors. Read-only state probes add loading/error/keyboard Enter→real GET recovery. Existing M4 breadth/state/width evidence is reused only where unaffected. |
| S18-T06–T07 | Final API/admin/website/root typechecks, lint, pure suites; current built application pins,3actualBun listeners/6diagnostics, retention/checksum/file preservation and known-value scan. [Independent review](../evidence/m5/review.md) closes all identified source findings with fresh local audit disposition. |
| S18-T08 | Technical UAT/demo and review handoff complete. **Khiêm's M5/full-local-MVP acceptance remains PENDING**. Production/AC-09 is outside this milestone. |

### Actual verification totals and boundaries

- API/SQL/HTTP/storage/worker integration: **29unique successful cases /987assertions**, selected from matching artifacts in integration-summary.json. Controlled-domain cases combine three valid prior cases and the focused fourth repair; historical failed suite status is untouched. Pure subsets overlap and are not added to this total.
- Final pure API contracts/ZIP/safety/worker/onboarding: **33tests/267assertions**, zero failure/skip. Final CMS+website: **193tests/1243assertions/49files**, zero failure/skip.
- Final API source/test, admin, website and root-script TypeScript checks: PASS. Full lint with max-warnings0: PASS. Current production builds were produced during scoped implementation; later test/docs/helper/package-alias changes do not alter application bundles. Admin build2Oi7ckr5DWDg32fqJlDDR; websiteXKbZmddv6fbA50oGKeQxX; API82compiledJS. Final source/serving checks and gates are in final-checks.json.
- Original protected baseline: **72tables /233213rows /1458files**. Midstage, post-deletion and post-S18 comparisons PASS with zero unexpected old-row/file differences. Original49migration checksums and new0051–0058 match disk; every forward repair compiled in an intentional rollback before application. No applied bytes changed. Named volatile expiry/session rows, owned launcher metadata and original-prefix log appends retain their declared exceptions; this is not backup/restore proof.
- New Deletion tenant business graph and original/derivative objects are gone. Minimal technical tenant/tombstone, global users/accounts/credentials and original audit365policy remain. A/B and old data are preserved. A is active with original custom primary; B remains active after its own landing unpublish and its notification worker scope is disabled. The additional newly provisioned quota-zero tenant/invitation is retained for review; no old tenant was deleted.
- B-only notification proof enrolled exactly its one new lead/recipient and processed one private local capture, then disabled only that enrollment. Old S04/S05/M2/M3/M4 backlog was not enrolled/drained. API startup/migrations/reactivation dispatched nothing.

### AC traceability and valid inherited evidence

| AC | Local disposition and current proof | Reused evidence / residual boundary |
| --- | --- | --- |
| AC-01 | VERIFIED_LOCAL: current roles/membership, exact hosts, forged SQL denial, quota races, suspension/export,36deletion private-read surfaces and worker fences. | S02/S02b/AUTH + M2–M4 isolation proof; Platform-only remains excluded from private content/leads. |
| AC-02 | VERIFIED_LOCAL: two-entry same heads/config, pending/preview/history/restore then explicit publish, immutable history hash, unpublish GET/HEAD404. | S03/S08/M3/M4 publication/race/catalog tests reused; no draft auto-publication. |
| AC-03 | VERIFIED_LOCAL: real M5 image processing/quota/withdrawal/purge, suspended signed reads and safety control, deletion storage effects. | M2/M3/M4 permission/format/size/unsafe-decode/D4timing proof remains valid. Downloaded/third-party copies are not erased. |
| AC-04 | VERIFIED_LOCAL: service+landing real forms/CAPTCHA, same-key cross-entry concurrency, shared A1/A2 lead/note, B assignment/note and one redacted local capture. | S04/S05/AUTH/M4 validation/abuse/recipient/retry/24hboundaries reused; no real email provider/booking claim. |
| AC-05 | VERIFIED_LOCAL: M5 URL/base consumers exercised with existing dental/service models; no location/branch permission change. | M3 full dental-kind/ordinary location/precise price breadth and M4 themed rendering reused; no reason to rerun every resource. |
| AC-06 | VERIFIED_LOCAL: direct301/302, actual language, query/canonical/navigation, sitemap/robots and immutable source/config pins. | M4 locales/social/JSON-LD/eligible alternates/SEO breadth reused plus M5 affected pure tests; no search ranking/indexing promise. |
| AC-07 | VERIFIED_LOCAL only: exact registry/owner proof/TLS-eligibility seam, activate/replace/remove/reverify/stale context/no outage flip. | **Live DNS/TLS/real certificates remain NOT_RUN**, separate future authority. Synthetic proof never counts as live verification. |
| AC-08 | VERIFIED_LOCAL: new Domain/Data/Platform controls, current quotas/lifecycle/export, desktop/mobile and loading/error/keyboard retry. | M1/M3/M4 content/editor/theme/width/state breadth reused; pure conflict/unknown-result recovery checks are separate from actual browser paths. Exhaustive Cartesian combinations remain NOT_RUN. |
| AC-09 | **DEFERRED beyond local MVP.** | No Production provider/topology/backup/RPO/RTO/HA/SLO/ops approval or launch claim. |
| AC-10 | VERIFIED_LOCAL: actualBun1.4.3API/admin/public/worker paths, native storage/decoder, export and current listener diagnostics. | Prior AUTH/M1/M2/M3/M4 supported-runtime proof reused; worker CLI denies completed unscoped Deletion target as expected. |
| AC-11 | VERIFIED_LOCAL: new export/reactivation/intake/confirmed-deletion retain current D4; audit original values/365policy and global identities preserved. | S06 controlled deadline/extension/expiry/deletion proof reused. Natural waiting and operational restore safeguards outside executed mode remain NOT_RUN. No new backup retention period. |
| AC-12 | VERIFIED_LOCAL: same site/publication/config/media/lead receipt across entries/themes/locales, explicit primary revisions/binding-generation pins, stale/revoked/deleting denial. | Existing module worker invalidation/current rights proof reused, with actual M5 capture/cleanup/fault/race checks. |

Inherited sources remain [M1/AUTH](GCMS-M1-UAT-001.md), [AUTH ledger](GCMS-AUTH-001.md), [M2](GCMS-M2-001.md), [M3](GCMS-M3-001.md), [M4](GCMS-M4-001.md) and their original immutable evidence. Acceptance of these packages and the M4 commit49f2a1a are unchanged. Original final-checks PENDING fields, historical FAIL/Unknown/NOT_RUN, unavailable historical navigation, natural8-hour waiting, operational backup/restore, external delivery and Production limits are not relabelled.

### Additional historical failures and focused repairs

- Domain lifecycle initially retained two then three successful cases beside failed harness/readiness assertions. Fresh binding identity+generation replaces the invalid host-global generation assumption. Forward0057 preserves configured private origin and fail-closed current readiness; content-only activation eligibility remains separately usable to repair a bad old primary. Stale public context returns explicit409, not the harness's initial404expectation. The original failed artifacts remain.
- Independent review then found verify response readiness computed before attestation linkage. Forward0058 recomputes it after closure and preserves receipt fields/ACL/replay. Focused1PASS/17assertions compares response with subsequent GET; an earlier attempt missing migration-env configuration failed before business work and remains recorded.
- First browser run retained19PASS/1FAIL/11NOT_RUN. The failed exact select-label locator included option text. Only the harness selector changed. Strict resume guards compare fixture/demo/current publication/config/primary before marking19cases REUSED and running12remaining cases. No consultation/note/export prefix was repeated.
- Supplemental read-only UI run completed four checks before its Data loading assertion failed: the browser fault also blocked the parent capability GET. Focused injection lets that parent read succeed and blocks the component's own GET. Data-only rerun PASS; the original4checks/screenshots and failed checkpoint are retained separately, not recast as an all-pass run.
- Lifecycle CLI initially expected idle after cleanup. Actual cleanup removes the worker scope, so SQL correctly denies it; the CLI exits1with a generic message. The diagnostic confirmed Lifecycle worker scope denied. No role expansion/re-enrollment/reset was used; lifecycle-cli.json records the fail-closed outcome.
- Final static checks found a script NodeList iterable mismatch and an unused test import. Array.from and type-only import repair those authoring issues; root typecheck/lint pass. Runtime business assertions were not weakened or rerun for these nonbehavioral edits.

### Remaining risks, acceptance and next action

Audit **braces FAIL/open** remains high3.0.3. Independent fresh M5 assessment supports a bounded local deferral at current45Next traces/82APIcompiledJS with zero advisory-chain references. Reassess **2026-10-22** or earlier patch/dependency/exposure triggers and before Production. No Production waiver. Applied0035 EOF whitespace FAIL stays untouched.

No mandatory local implementation/test gap is left open in this bounded handoff. Khiêm still decides M5/full-MVP-local acceptance. Review the active A demo, Domain/Data/Platform screens and evidence above; no re-execution of valid earlier suites is required. Numeric commercial quotas remain manual input, not a missing default. Real DNS/TLS, production deletion/backup/tombstone retention, external providers, operational restore and AC-09 require a separate concrete scope.

**No commit/push/deploy was performed.** HEAD remains49f2a1a; the complete M5 changes remain unstaged in the worktree. Private fixture credentials/captures/ZIPs remain private. Any later Git delivery or Production action needs its own explicit authority.

<a id="delegated-m5-acceptance--2026-10-17"></a>

## Delegated M5 acceptance — 2026-10-17

**Kết luận: ACCEPTED_UNDER_DELEGATED_AUTHORITY cho M5 v0.1 S16–S18 và toàn MVP trong phạm vi local đã ghi nhận.** Technical status giữ **CODE_INTEGRATED + VERIFIED_LOCAL**. `/root` không phát hiện lỗi chặn nghiệm thu về quyền, isolation, dữ liệu, publication integrity hoặc các luồng local bắt buộc được đối chiếu. Đây là quyết định của coordinator theo ủy quyền; không phải câu nói HUMAN_ACCEPTED do Khiêm trực tiếp tự nghiệm thu, cũng không chứng minh Khiêm đã tự chạy UAT.

### Nguồn ủy quyền, người quyết định và thời điểm

Sau final local handoff, Khiêm trực tiếp yêu cầu trong desktop thread `01a14576-0038-7232-8531-e6395fab7975`, turn `01a145c0-6994-7483-a348-f5cb5f487e24`:

> Review và nghiệm thu M5 local (S16–S18) cho tôi. Giữ nguyên các giới hạn kiểm chứng và audit braces FAIL/open; chưa commit/push/deploy.

Khiêm là người giao quyền; desktop `/root` trong cùng M5 thread là người review và quyết định. Quyết định được ghi lúc2026-10-17T00:30:14+07:00 theo múi giờ client Asia/Saigon. Phạm vi là M5 local hiện hành đã triển khai theo v0.1 và các quyết định S16-D02–D06/S17-D01–D08. Không kế thừa ủy quyền M4 để tự cấp quyền M5; quyền hiện tại đến từ chính yêu cầu trực tiếp trên.

Required/requested/observed coordinator effort **xhigh/PASS**, modelgpt-6.1-sol, đúng thread/cwd/turn. Native reviewer hiện tại kit-reviewer/gpt-6.1-sol/xhigh/đúng parent PASS. [Runtime metadata](../evidence/m5/acceptance-native-20261017.json) là bằng chứng cấu hình, không thay thế bằng chứng sản phẩm. Áp dụng code-review-and-quality, TechNote, security-and-hardening và documentation-and-adrs trong phạm vi review/ghi quyết định.

### Review và kiểm chứng thực tế

- [Final snapshot gốc](../evidence/m5/final-checks.json) giữ nguyên SHA-256 `deb0b697fd7d9e428d60af0fa848a5bc3fbedc9bc52d6590d621cc94e6458f13`. Toàn bộ **479source /82compiled /76evidence pins** khớp; hai Next BUILD_ID và dependency/lock inputs không thay đổi. Trường pending của checkpoint gốc là lịch sử, được bảo toàn.
- Root đọc các điểm domain/verifier/CAS/receipt/URL, quota/provision, read/safety/export fences, deletion/storage acknowledgment và UI capability/retry; đối chiếu task/AC/dependencies và rendered evidence. Không sửa ứng dụng hoặc rebuild trong lượt này.
- [Review độc lập lượt nghiệm thu](../evidence/m5/acceptance-review.md) không có blocking finding. Tám finding trước vẫn CLOSED. Bổ sung review source S18 B-only test không có lỗi chặn; positive ownership/backlog/capture/enrollment cleanup đúng scope. Reviewer không chạy DB/browser/workers và không đưa quyết định nghiệm thu thay root.
- Evidence integration được đối chiếu lại: **29unique successful cases /987assertions** từ10artifacts, không cộng trùng rerun. Browser **12newPASS+19REUSED** khớp từng priorPASS; original19PASS/1FAIL/11NOT_RUN vẫn giữ nguyên. APIpure33/267, frontend193/1243 được tái sử dụng đúng source pins.
- Fresh focused pure: **15tests/171assertions PASS**. Đây là subset chồng với suite cũ, không cộng vào totals. [JUnit](../evidence/m5/acceptance-focused.xml).
- Fresh authenticated UI: **5checks PASS** — Platform320/390/1440, Domain/Data loading→error→keyboard Enter→real GET recovery. [Receipt/screenshot](../evidence/m5/ui-readonly-e6512cdd-0b2a-4c3d-803f-c6a4c5c35f59/results.json). Root đã xem rendered mobile Platform.
- Fresh public: **7checks PASS** — VI home390/ENservice1440, ảnh thật đã load, language/canonical/publication/config pins; same-language GodentGET/HEADdirect301 và missingENdirect302primaryVI; zero uncaught page errors. [Receipt/screenshot](../evidence/m5/acceptance-public-fa62e551-2eae-44fb-bc01-029774482368/results.json). Không submit lại form hoặc thay primary.
- Fresh runtime: **3actualBun1.4.3listeners/6diagnostics PASS**; point-in-time availability, không restart/configuration. Fresh preservation **72tables/233213rows/1458files PASS**, không có unexpected old-row/file difference. Exact dated paths nằm trong [acceptance snapshot](../evidence/m5/acceptance-checks.json).
- Các proof cần ghi thật đã có: concurrent quota/reservation, storage PUT/HEAD/decoder/purge, accepted cross-entry receipt/lead/capture, suspended reads/export/safety/reactivation, current primary/reverify/remove/replacement và confirmed deletion333assertions. Chỉ tái sử dụng chúng trong lượt nghiệm thu; **không chạy lại migrations, fixtures, worker dispatch hoặc deletion**. Không reset/enroll/drain old backlog.

### Phạm vi nghiệm thu và giới hạn giữ nguyên

S16/S17 được nghiệm thu local cho các hành vi và contracts đã duyệt. S18 hoàn tất tích hợp/review/UAT/traceability và được nghiệm thu theo ủy quyền trong giới hạn local; local AC-01–08/10–12 dùng ma trận hiện hành cùng evidence M1/AUTH/M2/M3/M4 còn hợp lệ. S18-T08 không còn pending quyết định trong scope này. Các trạng thái pending ở final handoff/snapshot cũ vẫn là checkpoints lịch sử.

- **Audit braces vẫn FAIL/open/high** với bounded local-M5 deferral tại source/dependency/build pins không đổi. Reassess **2026-10-22**, hoặc sớm hơn theo patch/dependency/exposure trigger, và trước Production. Không có Production waiver; không nâng dependency hay đổi audit thành PASS.
- **AC-07 live DNS/TLS/real certificate vẫn NOT_RUN**. Synthetic-local binding/TLS eligibility không phải xác minh thật. AC-09/Production topology/provider/budget/HA/SLO/backup/recovery/ops vẫn deferred.
- External email/CAPTCHA provider thật, operational backup/restore, natural waiting, unavailable historical navigation, exhaustive browser/theme/locale/state combinations và mọi FAIL/Unknown/NOT_RUN cũ giữ nguyên phạm vi/mode. Fresh scoped checks chỉ bổ sung bằng chứng được nêu, không biến lịch sử thành lượt chạy PASS mới.
- D4 retention/audit365, original snapshots, credentials, old fixtures/backlog/data và applied checksum giữ nguyên. Applied0035 EOF whitespace FAIL không bị sửa. Deletion fixture đã hoàn tất không được khôi phục/chạy lại; A/B và fixture provision mới vẫn giữ để review theo hồ sơ cũ.
- **HEAD49f2a1a, không stage/commit/push/deploy**. Không production/global/DNS/TLS/provider action hoặc destruction mới. Nghiệm thu local không tạo quyền cho các hành động này.

### Bước tiếp theo trong đúng ranh giới

1. **Khuyến nghị:** sử dụng bản MVP local đã nghiệm thu và hồ sơ này làm baseline cho công việc tiếp theo; không cần chạy lại các bằng chứng còn hợp lệ.
2. Khi cần bàn giao Git hoặc chuẩn bị Production, Khiêm cấp phạm vi riêng. Commit/push/deploy và AC-09 không được suy ra từ quyết định này.

<a id="m5-git-delivery-authority--2026-10-17"></a>

## M5 Git delivery authority — 2026-10-17

Khiêm trực tiếp yêu cầu sau quyết định nghiệm thu local, trong desktop thread `01a14576-0038-7232-8531-e6395fab7975`, turn `01a145c6-d9f5-7be0-baf8-8128bac8cff8`:

> Commit và push gói M5 đã nghiệm thu lên main. Giữ nguyên các giới hạn kiểm chứng và audit braces FAIL/open; chưa deploy.

Đây là quyền Git riêng, không suy ra từ quyền triển khai hoặc nghiệm thu. Desktop `/root` được stage đúng gói M5 hiện có, commit và normal push lên `origin/main`; không force-push, amend, reset, rebase/viết lại lịch sử hoặc trộn thay đổi ngoài phạm vi. Ngay trước bàn giao: main/origin-main cùng49f2a1a7be0188ebec019fee14a0dff9e4513726, divergence0/0, index trống;234file thay đổi đều thuộc ứng dụng/scripts/docs/evidence M5, không có thay đổi ngoài phạm vi. Git-delivery metadata bổ sung được ghi riêng trước commit. Không có hook local hoặc file workflow/deploy được cấu hình trong repository để thực thi deploy từ gói này.

Source479/compiled82/evidence76 pins và12documentation pins từ lượt nghiệm thu khớp trước khi bổ sung hồ sơ quyền Git. Application source, applied migrations, dependencies/lock và evidence cũ không bị sửa trong lượt Git. Chỉ metadata/current pointers/maintained AGENTS-README hashes được cập nhật có provenance. Kiểm tra static/integrity/whitespace/known-value và staged bytes phù hợp; không chạy lại luồng nghiệp vụ, migrations, fixtures, workers, reset hoặc deletion để tạo bằng chứng mới.

Required/requested/observed coordinator effort xhigh/PASS, modelgpt-6.1-sol, đúng thread/cwd/turn hiện tại; đây là metadata điều phối, không phải bằng chứng sản phẩm. M5 vẫn ACCEPTED_UNDER_DELEGATED_AUTHORITY, technical CODE_INTEGRATED + VERIFIED_LOCAL. Original final snapshot pending checkpoint, historical FAIL/Unknown/NOT_RUN, D4/audit365, dữ liệu/credentials/fixtures/backlog/snapshots và applied checksums giữ nguyên. Git delivery chứng minh bàn giao source, không thêm runtime/UAT/Production proof.

**Audit braces vẫn FAIL/open/high** với bounded local-M5 deferral hiện hành. Reassess **2026-10-22 hoặc sớm hơn theo patch/dependency/exposure trigger và trước Production**; không có Production waiver. AC-07 live DNS/TLS/real certificate, external providers, operational backup/restore, natural waiting/exhaustive modes và AC-09/Production giữ nguyên NOT_RUN/deferred. **Chưa deploy**, không Production/global/DNS/TLS/provider/configuration/destruction mới. Các câu no-Git/HEAD49f2a1a ở checkpoint cũ là lịch sử; quyền mới chỉ supersede phần Git cho gói M5 này.

Kết quả commit SHA, normal push, đối chiếu local/remote SHA/divergence và final worktree được báo ở kết quả Git thực tế. Không ghi trước rằng push đã thành công. Bước tiếp theo trong quyền hiện tại là hoàn tất đúng chuỗi stage → staged review → commit → normal push → verify; deploy cần phạm vi riêng.


### Staged whitespace finding — applied0053 preserved

Full `git diff --cached --check` trả **FAIL/exit2** tại `apps/api/migrations/0053_m5_read_safety.sql:520`: new blank line at EOF. Migration này đã áp dụng và source SHA khớp exact accepted pin; không được sửa bytes/checksum chỉ để làm check xanh. Đây là một dòng trống định dạng, không thay đổi SQL behavior hoặc phát hiện integrity mới. Root ghi nhận là **non-blocking format-only** cho bàn giao Git hiện tại; full-check FAIL được giữ nguyên trong [receipt](../evidence/m5/git-staged-whitespace.json).

Phép kiểm riêng các staged paths còn lại PASS/exit0. Không đổi Git whitespace configuration, tắt hook/test, giảm assertion hoặc sửa migration để bypass. Known applied0035 EOF whitespace FAIL cũ tiếp tục giữ nguyên; nay0053cũng được ghi rõ để các lượt sau không sửa applied migration. Các kết quả `git diff --check` trước staging chỉ áp dụng tracked/unstaged scope lúc đó, không chứng minh untracked migrations đã qua full staged check. Audit braces FAIL/open và mọi giới hạn nghiệm thu/Production giữ nguyên.
