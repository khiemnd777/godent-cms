# GCMS-M4-001 — Approved M4 v0.1 local execution

**Current result — ACCEPTED_UNDER_DELEGATED_AUTHORITY — 2026-10-16.** [Khiêm’s direct review/acceptance delegation and /root’s local acceptance decision](#delegated-m4-acceptance--2026-10-16) are separately recorded. Technical CODE_INTEGRATED + VERIFIED_LOCAL and all historical proof/limits remain unchanged. The original final handoff’s HUMAN_ACCEPTANCE_PENDING and final-checks.json PENDING remain historical. Later direct M4 commit/push authority is recorded [separately](#m4-git-delivery-authority--2026-10-16); no deploy, Production or S16–S18 execution.

## Current authority and ownership

**APPROVED_EXECUTION_PLAN v0.1 / PLAN_SAVED — 2026-10-16 Asia/Ho_Chi_Minh.** Khiêm directly approved in desktop thread `01a144ca-5b34-7a52-b1f7-2a36f6c206f1`, approval turn `01a144d4-e576-7152-a79f-3b22f3e04258`:

> Duyệt M4 v0.1 và toàn bộ quyết định S13–S15. Giao /root điều phối, lưu kế hoạch rồi triển khai local gồm migrations, fixtures và kiểm chứng. Kế thừa 813a8c9, giữ dữ liệu và giới hạn cũ. Chưa commit/push/deploy.

The approval accepts the full M4 v0.1 plan below and all decisions S13-D01–D06, S14-D01–D06 and S15-D01–D06. Desktop `/root` in this thread is the current M4 Project Coordinator and owns canonical contracts, migration ordering, shared records/root/runtime and final integration. Prior M3 ownership and evidence remain historical within their recorded scopes. This complete plan save precedes dependent application changes. The latest instruction is this direct approval; no later stop is recorded at this checkpoint.

**Authorized local scope:** implement S13–S15, with additive migrations, new owned synthetic fixtures and scoped verification under the complete approved plan. Inherit baseline HEAD `813a8c90952348a5f46e6d5ac1e398096dfe6a1f`. Preserve existing data, credentials, resources, migration history/checksums, retained fixtures, backlog and evidence. Do not enroll or drain old worker scopes. No commit, push, deploy, Production, live DNS/TLS, external delivery/providers, paid services, global configuration, real patient data, destructive reset or S16–S18 execution is authorized.

**Initial evidence boundary:** M4 application tests/build/API/SQL/browser/worker/runtime/UAT are **NOT_RUN** at plan save. This document is not product verification or human acceptance. M1/M2/M3/AUTH/S01–S12 remain HUMAN_ACCEPTED only within their recorded local scopes. Existing [M3 final local proof](GCMS-M3-001.md#final-local-handoff--2026-10-16), historical failures, Unknowns and NOT_RUN limits are immutable; M3 proof does not verify M4 themes, campaigns, EN or SEO. Audit `braces` remains **FAIL/open**, reassess **2026-10-22** or earlier patch/dependency/exposure change and before Production. M4 requires its own exposure assessment; no M3 or Production waiver is inherited. Operational backup/restore, natural waiting, production scale/SLO, external delivery and DNS/TLS retain their old limits.

## Source-complete approved plan

The complete assistant final from 2026-10-16T13:04:22.848Z follows. Its Proposed, review-only, no-write and NOT_RUN statements preserve the historical planning checkpoint. The direct human approval above supersedes only the proposal/no-execution authority statements within approved M4 local scope. It does not change historical verification results. Repository link targets alone are normalized from local absolute paths to relative paths; source prose, decisions, workflows, contracts, task tables, dependencies, acceptance checks, integration waves and limits remain complete. Original source SHA-256: `e82f6e5b097dbf5c8fdb3150dd33eed314dc4e7ce6596df13afa0145fb44a321`; source characters: **30694**. The source contains **18 decision rows** and **22 task rows**: S13-T01–T08, S14-T01–T07 and S15-T01–T07.

**Đề xuất Chặng 4 — M4 v0.1:** giữ nguyên ba slice S13–S15 của GCMS-MASTER-PLAN-001 v0.2. Triển khai một luồng builder tối thiểu trước, sau đó mở S14 và S15 theo dependency thực tế; hoàn thiện theme 2 trước khi nghiệm thu toàn chặng.

Đây là **kế hoạch để review**. Các lựa chọn dưới đây mang trạng thái **Proposed**, chưa trở thành quyết định được duyệt. Tôi chưa ghi file, chạy ứng dụng, migration, tests/build hoặc thay đổi Git.

**Cơ sở đã xác minh — Verified**

- HEAD là `813a8c9`; working tree sạch. HEAD và bản `origin/main` đang lưu tại máy không có divergence. Trạng thái push được kế thừa theo xác nhận của bạn; tôi chưa fetch để kiểm tra remote trực tiếp.
- M3 S09–S12 đã **HUMAN_ACCEPTED** trong phạm vi local. Technical status vẫn là **CODE_INTEGRATED + VERIFIED_LOCAL**, cùng các giới hạn đã ghi trong [hồ sơ M3](GCMS-M3-001.md).
- Định nghĩa S13–S15 và dependency được giữ theo [master plan v0.2](../project-plan.md).
- Source hiện tại phục vụ VI, có immutable publication, history/restore/unpublish, reference pins và current media eligibility. Chưa có đầy đủ builder hai theme, promotion/landing hoặc publication EN.

Có ba điểm hiện trạng ảnh hưởng trực tiếp đến thiết kế M4:

| Hiện trạng trong source | Hệ quả đối với M4 |
|---|---|
| Tên/footer của website được đưa vào snapshot khi xuất bản từng tài nguyên; CMS hiện hướng dẫn xuất bản lại dịch vụ để cập nhật thông tin này | S13 cần chốt cách xuất bản cấu hình chung cho toàn website, tránh mỗi trang mang một thương hiệu/menu khác nhau |
| Intake, lead source và một số ràng buộc SQL đang gắn với service publication | S14 cần mở rộng nguồn lead thực sự; không thể chỉ thêm form vào landing rồi giả landing là một dịch vụ |
| DTO public giới hạn `locale: 'vi'`; HTML root cố định `lang="vi"`; URL/menu/metadata có logic VI | S15 tác động cả DB, publication, API, routing, renderer, form và SEO |

Nguồn đối chiếu chính: [site settings](../../apps/admin/components/site-settings.tsx), [publication contracts](../../apps/api/src/contracts/s03.ts), [intake contracts](../../apps/api/src/contracts/s04.ts), [M3 contracts](../../apps/api/src/contracts/m3.ts), [website layout](../../apps/website/app/layout.tsx).

**Các ranh giới giữ nguyên cho toàn M4**

- Một tenant là một tổ chức nha khoa với một website. Cơ sở vẫn là nội dung thông thường; không thêm branch permissions hoặc lead queues.
- Tenant Admin hiện hành được lưu và xuất bản. Không thêm clinical reviewer hoặc trạng thái Reviewed.
- Save chỉ thay đổi Draft. Restore tạo Draft mới. Chỉ explicit Publish mới thay đổi live.
- Snapshot và reference versions bất biến; current eligibility, unpublish và withdrawal vẫn có quyền chặn phân phối.
- Giữ Bun, stack, local ports và các trust boundaries hiện hành. Không thêm broker, analytics service, CDN hoặc cache nếu chưa có nhu cầu được chứng minh.
- Bảo toàn dữ liệu, credentials, backlog, fixtures đã có và migration lịch sử. Không reset demo hoặc chạy lại broad mutating suites để lấy kết quả xanh.
- Custom-domain activation/301 thuộc S16; quota/lifecycle thuộc S17; nghiệm thu full local MVP thuộc S18. M4 chỉ chuẩn bị contracts tương thích với các phần đó.

---

**S13 — Builder dùng schema chung và hai theme gốc**

**Mục tiêu người dùng**

Tenant Admin có thể tạo trang, sắp xếp các section được hỗ trợ, chọn giao diện và cấu hình thương hiệu/menu. Admin xem trước bản đã lưu rồi chủ động xuất bản. Visitor nhận cùng nội dung hợp lệ qua hai theme có bố cục khác nhau.

**Phạm vi đề xuất**

- Trang chủ và trang nội dung thông thường được tạo từ catalog section có giới hạn.
- Thêm, sửa, sắp xếp, ẩn hoặc bỏ section trong Draft.
- Chọn tài nguyên đã Published bằng reference picker; không sao chép thủ công dữ liệu bác sĩ, giá hoặc FAQ vào nhiều trang.
- Brand, menu, footer, theme và style presets có Draft, preview, history và explicit Publish.
- Hai theme áp dụng cho cả trang builder và các listing/detail hiện có của S03/M3.
- Tái sử dụng Media Library, private preview và gateway kiểm tra quyền hiện hành.

Không đưa vào S13: canvas kéo thả tự do, arbitrary CSS/HTML/scripts, plugin marketplace, remote embeds hoặc import website từ nguồn ngoài.

**Dependencies**

- Publication/editorial của S03/S08.
- Media và consent của S07/S11.
- Các public content/reference contracts S09–S12.
- Review catalog section và hai hướng theme trước phần triển khai phụ thuộc.

S13 không cần đợi campaign hoặc EN hoàn chỉnh. Schema phải có điểm mở rộng rõ để S14/S15 bổ sung mà không tạo builder thứ hai.

**Các quyết định cần chốt**

| Mã | Đề xuất để review | Lý do |
|---|---|---|
| S13-D01 — Catalog | Hero/CTA; rich text; danh sách dịch vụ có chọn specialty/group; bác sĩ; cơ sở; bảng giá; case; gallery trước/sau; testimonial; bài viết; FAQ. S14 bổ sung promotion và consultation form bằng cùng schema | Bao phủ nội dung đã có, tránh tạo trước section giả chưa có nghiệp vụ |
| S13-D02 — Hai theme | Theme 1 thiên về nội dung, khoảng trắng và phân cấp rõ. Theme 2 thiên về hình ảnh và các khối nội dung nổi bật. Cùng dữ liệu, section và khả năng thao tác | Theme 2 phải có khác biệt bố cục thực sự, đồng thời giữ parity |
| S13-D03 — Style | Chỉ chọn palette, font stack hỗ trợ VI/EN và một số layout presets đã kiểm tra. Không nhập CSS/font URL tự do | Giữ khả năng bảo trì và giới hạn bề mặt thực thi |
| S13-D04 — Cấu hình toàn site | Có publication cấu hình hiển thị cấp site. Một lần explicit Publish cập nhật brand/menu/theme/footer cho các trang live; không xuất bản pending content | Giải quyết việc cấu hình hiện đang nằm trong snapshot từng trang |
| S13-D05 — Chuyển tiếp legacy | Trước lần chủ động publish cấu hình S13, giữ output legacy. Sau lần đó, public render dùng content snapshot cùng config snapshot đã publish, có định danh cả hai | Bảo toàn lịch sử và tránh tự đổi website chỉ vì migration |
| S13-D06 — Menu và references | Menu nội bộ trỏ resource/route identity hợp lệ; section chọn publication cụ thể. Reference không còn eligible bị loại hoặc chặn theo tính bắt buộc đã khai báo | Không đọc mutable drafts hoặc tự mở rộng phạm vi áp dụng |

**S13-D04/D05 là thay đổi contract cần duyệt**, chưa phải quyết định đã có. Snapshot cũ vẫn giữ nguyên; lần publish cấu hình mới không sửa hồi tố lịch sử hoặc bulk-publish bản nháp.

**Workflow**

1. Admin mở Trang hoặc Giao diện/Menu trong tenant hiện tại.
2. Admin sửa Draft, chọn references và lưu với expected version.
3. Private preview hiển thị bản đã lưu, theme/config được chọn và các reference chưa hợp lệ.
4. Admin xác nhận Publish đúng tenant, tài nguyên, revision và phạm vi ảnh hưởng.
5. Backend kiểm tra quyền hiện hành, recent reauthentication, versions, reference/media eligibility; ghi snapshot, pointer và durable intent trong transaction.
6. Visitor nhận một bộ content/config nhất quán. Hai admin lưu hoặc publish cạnh tranh nhận conflict; input không bị mất.
7. Unpublish trang chặn public output. Restore trang hoặc cấu hình chỉ tạo Draft mới.

**Contracts/schema/UI bị tác động**

- **Website Configuration:** versioned brand, logo/media reference, menu, theme ID/version và style tokens.
- **Page Builder:** page identity, route, draft revisions, ordered typed sections, reference pins, publication head và command receipts.
- **Public read model:** định danh content publication, config publication và schema/theme version thực sự dùng trong response.
- **Media:** thêm scope sử dụng phù hợp cho logo/hero/page; không coi quyền `service_cover` là quyền chung cho mọi vị trí.
- **Database:** migration mới với tenant-consistent keys, constraints, FORCE RLS và transaction boundaries; SQL migrations tiếp tục là nguồn có thẩm quyền.
- **CMS:** các khu vực Trang/Giao diện/Menu đang có trong navigation trở thành luồng thật; tái sử dụng patterns và Lucide đã duyệt.
- **Website:** shell, menu, renderer và route registry. Trang tự tạo không được chiếm namespace của API, preview, locale hoặc các content routes hiện hành.

**Tasks theo vertical slice**

Mỗi hàng bao gồm UI → API → DB → public result và kiểm tra tương ứng.

| Task | Kết quả bàn giao | Tiêu chí/check chính |
|---|---|---|
| S13-T01 — Trang đại diện | Tạo trang chủ với Hero + rich text; save → reload → private preview → publish bằng theme 1 | Nội dung tồn tại thật; anonymous không xem Draft; save V2 giữ live V1 |
| S13-T02 — Brand và theme | Chỉnh brand/style, preview và publish config cấp site | Các trang live dùng cùng config publication; pending content không bị xuất bản |
| S13-T03 — Menu | Tạo menu có thứ tự, liên kết nội bộ hợp lệ, trạng thái mobile | Keyboard dùng được; không link sang tenant khác hoặc preview; xử lý target unpublish |
| S13-T04 — Trang nội dung và lifecycle | Tạo trang thường; thêm/sắp xếp/bỏ section; history, restore, conflict, unpublish | Route không xung đột; restore chỉ tạo Draft; stale command không ghi đè |
| S13-T05 — Section catalog | Hoàn thiện từng nhóm section với reference picker và projection thật | Giá giữ decimal chính xác; reference pins không tự đổi khi tài nguyên con có Draft mới |
| S13-T06 — Theme 1 hoàn chỉnh | Phủ trang chủ, trang thường và các listing/detail S03/M3 | Không có page family rơi về layout tạm; media/form/navigation vẫn hoạt động |
| S13-T07 — Theme 2 parity | Chuyển cùng bộ trang sang theme 2 qua Draft/preview/publish | Không mất dữ liệu/section; hai theme đều xử lý empty, long text, withdrawn media và lỗi |
| S13-T08 — Tích hợp bảo toàn | Hoàn thiện compatibility cho dữ liệu cũ và review publication/media | Snapshot lịch sử không đổi; migration không tự bật theme hoặc publish nội dung |

**Nghiệm thu S13 và cách kiểm chứng**

- **AC-02:** browser authenticated chứng minh save/preview/publish/history/restore/unpublish; API/SQL chứng minh conflict, retry và atomic failure không tạo nửa publication.
- **AC-08:** cả hai theme phủ đầy đủ catalog đã duyệt và các page families; có actual rendered evidence riêng, không dùng một screenshot đại diện để đóng toàn bộ.
- **AC-01/03 liên quan:** hai tenant, revoked membership, forged references, cross-tenant assets và withdrawn media đều bị chặn đúng phạm vi.
- Theme/config publish không thay đổi pending content; service/content publish không tự xuất bản config Draft.
- So sánh CMS với shared design patterns đã duyệt tại cùng viewport. Hai theme public cần được review như thiết kế mới; mockup admin không tự phê duyệt thiết kế website.
- Kiểm tra desktop/mobile, keyboard, focus, validation, empty/loading/error/conflict; bước đổi thứ tự section phải dùng được bằng bàn phím, không chỉ drag.

---

**S14 — Khuyến mãi và landing page tạo lead có nguồn rõ ràng**

**Mục tiêu người dùng**

Admin tạo chương trình có thời hạn và phạm vi áp dụng rõ, xây landing từ section có sẵn, rồi nhận yêu cầu tư vấn vào danh sách lead chung. Admin biết lead đến từ landing/campaign nào và phiên bản nào.

**Phạm vi đề xuất**

- Promotion có nội dung, điều kiện, thời gian hiệu lực và references tới dịch vụ/cơ sở phù hợp.
- Landing page dùng cùng page builder, có promotion block và consultation form.
- Public chỉ trình bày ưu đãi đang đủ điều kiện.
- Form tạo lead thật với source snapshot và campaign attribution tối thiểu.
- CMS lead list/detail hiển thị nguồn dịch vụ hoặc landing một cách thống nhất.

Không bổ sung booking, thanh toán, coupon redemption, ad-platform integration, marketing automation hoặc dashboard ROI trong slice này.

**Dependencies**

- S04 intake, S05 lead operations/notification, S06 retention.
- Các section, media và references thực sự dùng từ S13/S03/M3.
- Contract nguồn lead mở rộng được chốt trước form landing.

S14 không chờ toàn bộ catalog hoặc theme 2. Bản VI tối thiểu có thể tích hợp trước EN; S15 sẽ hoàn thiện localization bằng cùng contracts.

**Các quyết định cần chốt**

| Mã | Đề xuất để review | Hành vi cần rõ |
|---|---|---|
| S14-D01 — Thời gian | Promotion có start/end; lưu absolute instants và timezone dùng khi biên soạn. Khoảng hiệu lực là `[startAt, endAt)` | Hết hiệu lực đúng tại `endAt`; đổi timezone tenant không âm thầm dời chương trình cũ |
| S14-D02 — Phạm vi | Dịch vụ/cơ sở được chọn bằng references. Không chọn cơ sở nghĩa là chưa chỉ định, không tự tuyên bố áp dụng mọi nơi | Mất một reference bắt buộc không được làm ưu đãi mở rộng thành toàn tổ chức |
| S14-D03 — Trước/sau hiệu lực | Promotion đã Published có thể hiện thông báo chưa bắt đầu/hết hạn; không hiện CTA nhận ưu đãi. Landing vẫn có trang thông tin nhưng ngừng nhận yêu cầu ưu đãi | Không redirect hết về homepage hoặc tiếp tục quảng bá điều kiện đã hết |
| S14-D04 — Nguồn lead | Source phân biệt `service` và `landing`; server xác nhận tenant/resource/publication và lưu snapshot lúc nhận | Landing không cần tạo một service giả; dịch vụ quan tâm vẫn có thể để trống |
| S14-D05 — Attribution | Attribution theo lần gửi form: landing, publication, promotion đã xác nhận; chỉ nhận tracking tokens được giới hạn/allowlist nếu cần | Không thêm first-touch cookies hoặc lưu raw query/referrer |
| S14-D06 — Giá ưu đãi | Mô tả điều kiện và tham chiếu giá được chọn; không tự tính lại toàn bảng giá hoặc áp phần trăm vào giao dịch | Giữ exact decimal/currency/unit và tránh biến landing thành pricing engine |

`Chưa bắt đầu/đang hiệu lực/hết hạn` là trạng thái tính từ thời gian và eligibility. Editorial workflow vẫn chỉ **Draft/Published**.

**Workflow**

1. Admin tạo promotion, nhập thời gian và điều kiện, chọn references.
2. Admin lưu/preview rồi explicit Publish promotion.
3. Admin tạo landing, chọn promotion publication, thêm nội dung và form, rồi publish landing.
4. Visitor mở landing hợp lệ; server xác định promotion hiện còn hiệu lực và các lựa chọn service/location được phép.
5. Visitor gửi phone hoặc email, preferred language/channel và consent.
6. Transaction lưu lead cùng durable notification intent trước acknowledgement.
7. Hai Tenant Admin cùng thấy lead trong danh sách chung; nguồn vẫn giữ đúng snapshot khi landing/campaign thay đổi sau đó.

Nếu form đã mở nhưng landing được republish, unpublish hoặc promotion hết hạn trước lần gửi mới, backend từ chối nguồn cũ và UI giữ input để người dùng xử lý. Nếu yêu cầu đã được nhận trước đó, retry hợp lệ vẫn tuân thủ receipt/idempotency hiện hành, không tạo lead mới hoặc kéo dài retention.

**Contracts/schema/UI bị tác động**

- **Promotion:** draft/revisions/publication, validity, timezone, applicability và reference pins.
- **Landing:** page kind, route namespace, section schema, promotion/form configuration.
- **Intake:** source context có loại nguồn, source publication và form configuration version; challenge cũng phải gắn đúng nguồn.
- **Lead:** mở rộng source model bằng migration mới; dữ liệu nguồn của lead cũ giữ nguyên. Không điền giả `source_service_id` cho landing.
- **Idempotency:** vẫn một namespace tenant trong 24 giờ; payload/source khác với cùng key phải conflict. Nhánh legacy không bị đổi fingerprint chỉ vì có thêm fields tùy chọn.
- **Retention:** attribution nằm trong cùng private lead graph và bị xóa theo S06; không tạo bản sao marketing tồn tại ngoài vòng đời lead.
- **Notification:** tiếp tục local capture theo scope được duyệt sau này; không thêm contact/message vào delivery.
- **CMS:** promotion editor, landing editor và source presentation của lead list/detail.

**Tasks theo vertical slice**

| Task | Kết quả bàn giao | Tiêu chí/check chính |
|---|---|---|
| S14-T01 — Promotion VI | Tạo, save, preview, publish và xem promotion qua đường dẫn thật | Invalid dates/references bị từ chối; Draft không xuất hiện công khai |
| S14-T02 — Landing tối thiểu | Hero + nội dung + một promotion + form; publish theme 1 | Landing đọc đúng published versions, không lấy Draft của promotion |
| S14-T03 — Lead từ landing | Gửi form → SQL → acknowledgement → A1/A2 cùng xem lead và nguồn | Có source snapshot thật; không có service giả; source/interest tách biệt |
| S14-T04 — Retry và abuse | Unknown timeout, retry, changed payload, CAPTCHA và rate limit | Một accepted request tạo một lead; không mở đường bypass qua endpoint landing |
| S14-T05 — Hiệu lực tại thời điểm gửi | Bắt đầu/hết hạn, republish/unpublish và reference withdrawal khi form đang mở | New request bị chặn đúng; accepted replay không tạo dữ liệu hoặc activity mới |
| S14-T06 — Attribution và vòng đời | Hiển thị nguồn/tracking tối thiểu; assignment/status/retention tiếp tục hoạt động | Không lưu raw URL/referrer; S06 xóa đầy đủ dữ liệu nguồn cùng lead |
| S14-T07 — Hai theme và EN | Landing/form hoạt động với theme 2 và locale contracts của S15 | Không lệch consent, source locale, preferred language hoặc applicability |

**Nghiệm thu S14 và cách kiểm chứng**

- **AC-04:** journey browser landing → form → API/DB → lead list/detail; phone-only và email-only đều hoạt động; validation và consent giữ nguyên yêu cầu.
- **AC-02:** sửa promotion/landing Draft không đổi live; parent chỉ nhận reference version mới sau hành động publish phù hợp.
- **AC-08:** landing dùng được trên mobile/keyboard; form giữ input khi lỗi, tập trung vào lỗi/acknowledgement đúng chỗ.
- API/SQL kiểm tra đồng thời hai lần gửi, changed-payload conflict, crash trước/sau durable write và source giả/cross-tenant.
- Boundary tests cho trước start, đúng start, sát end và đúng end; dùng clock có kiểm soát, không gọi đó là đã chờ thời gian tự nhiên.
- Kiểm tra hết hạn/withdrawal trong HTML, promotion card, CTA, form validation và metadata liên quan.
- Kiểm chứng worker chỉ trên fixture/scope M4 được chủ động cho phép; không drain backlog S04/S05/M2/M3.

---

**S15 — VI/EN và SEO nhất quán với ngôn ngữ thực**

**Mục tiêu người dùng**

Admin xuất bản VI và EN độc lập. Visitor yêu cầu EN nhận EN đã Published; nếu chưa có bản EN hợp lệ thì được dẫn tới Published VI hợp lệ. HTML, menu, canonical, sitemap và các thông tin SEO phải mô tả đúng nội dung thực sự được phục vụ.

**Phạm vi đề xuất**

- Locale variants cho service, các content kinds M3, builder pages, promotion và landing.
- Brand/menu/footer/text của website có publication theo locale khi cần.
- Locale-aware public routing và language switch.
- Form copy, validation, consent và acknowledgement VI/EN.
- Metadata, canonical, hreflang, sitemap, robots, social previews và structured data có dữ liệu hỗ trợ.

Không thêm dịch tự động, locale thứ ba, đổi slug hàng loạt, custom-domain activation hoặc cam kết thứ hạng tìm kiếm.

**Dependencies**

- Publication/reference/schema hiện hành và contract cấu hình S13.
- Chốt page-level fallback, locale URL và source/consent locale.
- Từng content family chỉ cần schema tương ứng đã ổn định.

S15 có thể bắt đầu bằng service VI/EN trước theme 2. Phần bao phủ cuối phải gồm builder và landing sau khi các loại trang này có source hoàn chỉnh.

**Các quyết định cần chốt**

| Mã | Đề xuất để review | Lý do |
|---|---|---|
| S15-D01 — URL | Giữ nguyên URL VI hiện có. EN thêm `/en` sau tenant: `/<tenant>/en/<site-page-path>` | Không phá URL đã khóa hoặc phải migrate toàn bộ đường dẫn M3 |
| S15-D02 — Slug | MVP dùng chung route/resource slug đã khóa cho VI và EN; nhãn giao diện được dịch. Không dịch các technical path segments trong đợt này | Giảm thay đổi registry và xác định được resource khi bản EN chưa tồn tại |
| S15-D03 — Fallback | Fallback toàn trang. Request EN thiếu bản eligible chuyển tạm thời `302` tới canonical VI hợp lệ | Khi EN được publish sau này, URL EN có thể phục vụ EN; không tạo permanent redirect do thiếu bản dịch |
| S15-D04 — Fields/references | Không tự lấy field văn bản từ VI để lấp vào EN. Reference nhúng bắt buộc phải có publication cùng locale; link tới nội dung chưa dịch có thể đi VI với nhãn rõ | Tránh trang EN chứa các mảnh Draft hoặc nội dung pha ngôn ngữ không được kiểm soát |
| S15-D05 — Publish độc lập | Mỗi resource có draft/publication head theo locale; common facts vẫn versioned và được pin tại lúc publish | Publish VI không tự thay nội dung live EN và ngược lại |
| S15-D06 — Consent | Copy/version consent được server chọn theo form thực sự hiển thị; preferred language là lựa chọn liên hệ riêng | Người đọc VI vẫn có thể yêu cầu liên hệ bằng EN; không gán consent EN chỉ vì chọn preferred language EN |

Tên riêng, địa chỉ, định danh, số tiền và currency có thể giữ nguyên giữa hai locale theo bản chất dữ liệu. Đó không phải fallback ngầm cho văn bản chưa dịch.

**Bảng hành vi fallback đề xuất**

| Tình huống | Kết quả |
|---|---|
| Request EN, bản EN Published và đủ eligibility | `200`, HTML `lang="en"`, canonical EN |
| Request EN, chỉ có EN Draft, VI Published hợp lệ | `302` tới VI; không đọc EN Draft |
| Request EN, EN đã unpublish, VI còn hợp lệ | `302` tới VI |
| Request EN, không có EN và cũng không có VI eligible | Safe not-found |
| Asset/quyền chung bị thu hồi | Chặn mọi locale chịu ảnh hưởng; không dùng fallback để khôi phục quyền đã mất |
| API/DB đang lỗi | Hiển thị lỗi tạm thời; không coi lỗi hệ thống là “thiếu bản dịch” để trả nội dung khác |

VI fallback không được xuất hiện trong hreflang như một bản EN. Language switch tới tài nguyên chưa dịch đi thẳng VI với thông báo phù hợp.

**Workflow**

1. Admin mở cùng resource identity và chọn VI hoặc EN.
2. Admin nhập/lưu bản dịch; CMS cho thấy draft/live và references của từng locale.
3. Private preview cho biết requested locale, actual locale và vấn đề publication.
4. Explicit Publish chỉ cập nhật locale được xác nhận.
5. Public resolver chọn locale, publication và config eligible trong cùng render context.
6. Metadata và body dùng cùng kết quả resolve; không đọc lại một pointer khác giữa hai bước.
7. Unpublish, republish, config changes hoặc media withdrawal được phản ánh trong output và SEO tương ứng.

**Contracts/schema/UI bị tác động**

- **Locale variants:** tenant/resource identity chung; revisions, slug mapping và publication heads theo locale.
- **Compatibility:** bridge/read adapter cho VI hiện có; không rewrite snapshot S03/M3 thành schema mới hoặc tự republish.
- **Resolution DTO:** `requestedLocale`, `actualLocale`, resolution result, content/config publication IDs và fallback publication identity khi có.
- **Public URL builder:** dùng validated entry/base/primary context; không lấy canonical host từ query hoặc Host chưa tin cậy. Local origin và host allowlist vẫn giữ nguyên.
- **Publication:** expected versions và receipts phân biệt locale; reference closures pin đúng locale/version.
- **Permission:** bản dịch patient-derived text không tự thừa kế quyền của revision VI. Scope resource/locale/revision phải rõ; global asset withdrawal vẫn chặn mọi sử dụng.
- **Forms/leads:** localized copy và consent registry; giữ nguyên consent snapshots/fingerprints lịch sử của lead VI.
- **Website:** root HTML language, labels, dates, menu/breadcrumb, error/not-found và form messages.
- **SEO:** dùng actual publication và current primary; có điểm tích hợp cho S16 nhưng không triển khai domains trong S15.

**Contracts SEO đề xuất**

- **Canonical:** absolute URL của trang/locale thực; loại tracking parameters. Functional queries được xử lý theo semantics riêng.
- **Hreflang:** chỉ xuất bản các alternate thực sự tồn tại và eligible; có reciprocal links. Không tạo alternate EN cho VI fallback.
- **Menu:** theo actual locale; target chưa dịch được dẫn tới VI có nhãn rõ, không tạo link EN giả.
- **Sitemap:** chỉ liệt kê published eligible routes; loại Draft, preview, withdrawn/unpublished pages và aliases không phải canonical.
- **Robots:** tiếp tục bảo vệ local bằng noindex hiện hành. Việc này không được dùng để thay thế canonical hoặc tuyên bố đã index trên Production.
- **Social previews:** title/description/image/URL cùng publication và locale với body; withdrawn image không tồn tại trong metadata cũ.
- **Structured data:** chỉ sinh từ dữ liệu được public hợp lệ; không bịa rating, credential, kết quả điều trị hoặc giá. Serialization phải an toàn.
- **Caching:** trước mắt giữ no-store. Nếu sau này thêm cache, key/invalidation phải bao gồm tenant/site, route, requested/actual locale, content/config/fallback publication và mapping revision.

**Tasks theo vertical slice**

| Task | Kết quả bàn giao | Tiêu chí/check chính |
|---|---|---|
| S15-T01 — Service VI/EN đại diện | Tạo EN Draft, preview, publish và xem hai locale | EN Draft không lộ; publish EN không đổi live VI; HTML language đúng trước streaming |
| S15-T02 — Fallback thực | EN thiếu/Draft/unpublished → VI eligible; không fallback khi backend lỗi | Kiểm tra HTTP status, Location, body, canonical và actual locale |
| S15-T03 — Locale trên M3 | Mở rộng theo nhóm catalog/location/doctor/price, stories, article/FAQ | Facts và references giữ đúng version; EN text rights không bị suy diễn từ VI |
| S15-T04 — Builder/config/menu | Dịch trang chủ/trang thường/menu/footer bằng cùng schema | Page/config locale nhất quán; đổi theme không đổi ngôn ngữ hoặc mất bản dịch |
| S15-T05 — Promotion/landing/form | EN campaign và form với consent/source đúng | Backend lưu exact consent version/copy; preferred language độc lập actual page locale |
| S15-T06 — SEO toàn tuyến | Metadata, canonical/hreflang, sitemap, robots, social và structured data | Chỉ eligible actual-language output; không chứa preview/draft/revoked media |
| S15-T07 — Races và compatibility | Republish/unpublish/withdraw giữa resolution, metadata và delivery | Không trộn publications; old VI URLs/snapshots/lead receipts vẫn hợp lệ trong phạm vi cũ |

**Nghiệm thu S15 và cách kiểm chứng**

- **AC-06:** kiểm tra ma trận VI/EN Published, Draft, missing, unpublished và unavailable fallback bằng API/SQL, HTTP/HTML và browser.
- **AC-02:** hai locale publish độc lập; stale expected versions không ghi đè; restore không tự đổi live.
- **AC-03:** quyền nội dung/media được kiểm tra trong cả body, references, metadata và media gateway.
- **AC-08:** language switch, CMS locale controls và form dùng được trên desktop/mobile/keyboard.
- **AC-12 trong phạm vi M4:** route/base/locale/SEO dùng cùng contract; actual custom-domain và cross-entry runtime proof tiếp tục để S16.
- Repeated requests chứng minh EN vừa publish thay thế được đường fallback trước đó; EN unpublish hoặc VI/media withdrawal không để lại output stale.
- Local tests không được báo thành live DNS/TLS, Google indexing hoặc rich-result proof.

---

**Thứ tự tích hợp cho toàn Chặng 4**

Đây là thứ tự theo phụ thuộc; không mặc định bắt mọi task chạy tuần tự.

| Đợt | Nội dung | Điều kiện để mở phần phụ thuộc |
|---|---|---|
| 0 — Chốt contracts | Review catalog/theme, config publication, route namespace, locale/fallback và source lead | Các quyết định ảnh hưởng schema/consumer đã rõ; có một canonical owner cho từng contract |
| 1 — Luồng builder đầu tiên | S13-T01 và phần tối thiểu của T02: trang chủ Hero + rich text, config đã publish, theme 1 | Real save → private preview → publish → anonymous SSR đạt tiêu chí |
| 2 — Mở hai hướng độc lập | S15-T01/T02 trên service; S14-T01 trên promotion | Locale/source/reference contracts đã ổn định; không cần theme 2 |
| 3 — Landing tạo lead | S14-T02–T06; đồng thời mở rộng catalog S13 và locale M3 | Landing VI → lead chung → retry/expiry/retention có bằng chứng |
| 4 — Hoàn thiện breadth | S13 theme 1 đầy đủ rồi theme 2 parity; S15 builder/config/landing/SEO; S14 EN và theme 2 | Không còn page/section family chỉ có placeholder hoặc mock path |
| 5 — Tích hợp M4 | Kiểm tra giao điểm theme × locale × campaign × publication/media; review độc lập theo rủi ro | AC của từng slice và các giao điểm bắt buộc có kết quả rõ |

Các điểm tích hợp cần chứng minh riêng:

1. **Đổi theme:** cùng EN landing và nguồn lead vẫn hoạt động; không publish pending content.
2. **Xuất bản EN:** canonical/menu/form đổi đúng locale; VI và lead source lịch sử không bị sửa.
3. **Promotion hết hạn:** landing không tiếp tục nhận yêu cầu ưu đãi mới; accepted retry không tạo lead thứ hai.
4. **Withdraw media/text:** body, section, metadata và gateway đều tuân thủ quyền hiện hành trên cả hai theme/locale.
5. **Hai admin cạnh tranh:** conflict giữ input; không tạo publication/config/reference lệch phiên bản.

**Ownership đề xuất khi có quyền triển khai**

- Coordinator giữ canonical contracts, migration ordering, shared root/runtime và final integration.
- API/Data sở hữu schema, publication/locale/source contracts, RLS, transactions và intake/retention compatibility.
- CMS sở hữu editor, reference picker, locale/preview/publication controls.
- Website sở hữu section renderer, hai theme, route resolution và SEO consumers.
- Reviewer độc lập tập trung vào publication integrity, cross-tenant access, consent/media, source idempotency và fallback.

Không giao hai writer cùng sửa một contract hoặc migration sequence. Các phần kiến trúc, API/SQL, publication, locale và review bảo mật yêu cầu **xhigh** theo matrix. Phiên lập kế hoạch hiện tại đã kiểm tra runtime **xhigh/PASS**. Chưa chạy agent review độc lập trong lượt này.

**Kế hoạch kiểm chứng và bảo toàn**

Khi triển khai được duyệt, cần có baseline dữ liệu/files trước migration và đối chiếu sau các thay đổi. Migration chỉ nối tiếp sau chuỗi hiện hành; giữ nguyên migrations lịch sử và số đã dành. Không thay credentials hoặc tự enroll/drain worker scopes cũ.

Các lệnh hiện có có thể tái sử dụng tại ranh giới tích hợp phù hợp:

```sh
./node_modules/.bin/bun --no-env-file test apps/admin apps/website
./node_modules/.bin/bun --no-env-file run build
./node_modules/.bin/bun --no-env-file run lint
./node_modules/.bin/bun --no-env-file run typecheck
```

API/SQL/storage/worker cần suite M4 với fixture ownership rõ trước khi chạy; không dùng blanket mutating tests trên dữ liệu đang giữ. Browser kiểm tra các layout mới tại 320/390/768/1024/1440 px, cùng meaningful states; không coi các tổ hợp chưa chạy là PASS.

**Tất cả kiểm chứng M4 trên hiện là NOT_RUN**, vì lượt này chỉ lập kế hoạch. Bằng chứng M3 được kế thừa đúng phạm vi, không mở rộng thành bằng chứng cho EN, themes hoặc campaigns.

Audit `braces` tiếp tục **FAIL/open**. M4 cần đánh giá exposure riêng sau thay đổi renderer/SEO; không tự kế thừa deferral M3 như một waiver mới. Giữ mốc reassess **22/10/2026**, hoặc sớm hơn khi có patch/dependency/exposure change và trước Production. Backup/restore vận hành, natural waiting, production scale/SLO, external delivery và DNS/TLS vẫn giữ các giới hạn cũ.

**Điểm review trước bước tiếp theo:** catalog và hai hướng theme; publication cấu hình toàn site; semantics hiệu lực/attribution của campaign; URL và whole-page VI fallback của EN. Chưa có quyền lưu kế hoạch hoặc triển khai S13–S15 từ đề xuất này.

## Plan-save execution ledger — 2026-10-16

**Ownership:** native `/root/m4_plan_record` writes only this task record. Parent desktop `/root` retains all shared-record, runtime and final-integration responsibility. No recursive delegation. Documentation skills invoked: `documentation-and-adrs` and `technote`; user-requested Vietnamese explanations preserve the exact approved Vietnamese plan. Khiêm controls TechNote progression; silence grants no approval.

**Runtime governance — Verified by parent before writes:** category `agent-artifact-generation`; required/requested/observed effort **medium**; inherited model `gpt-6.1-sol`; role `kit-implementer`; thread `01a144d5-93d3-7d70-9450-37a54749ce1a`; expected desktop parent `01a144ca-5b34-7a52-b1f7-2a36f6c206f1`. Parent reported exact identity/model/parent/effort **PASS** and released the write. Runtime metadata is coordination evidence only, not product proof.

**Documentation verification:** source-completeness comparison, local Markdown targets and scoped whitespace results are recorded below after execution. Application tests/build/runtime are NOT_RUN for this documentation-only assignment. Proposed shared-record updates are handed to the coordinator; this worker does not update them.

**Actual scoped static results — Verified:** Python source-completeness comparison **PASS**: saved plan equals the complete approved source after repository link normalization only; all 18 decision rows and 22 task rows (8+7+7) are present. Python Markdown check **PASS**: 8 local targets exist, including the M3 final-handoff heading anchor. Python trailing/EOF whitespace check **PASS**. `git diff --no-index --check /dev/null docs/tasks/GCMS-M4-001.md` emitted no whitespace diagnostics; exit **1** is the expected no-index difference result for a newly created file, not a product test result. No application tests/build/browser/API/SQL/worker/runtime checks ran in this assignment.

**Handoff:** complete plan-save prerequisite delivered to desktop `/root` before dependent application work. Coordinator owns subsequent shared-header synchronization and execution evidence. This worker releases the task record at handoff; future approved execution appends must preserve the source-complete plan and historical checkpoint above. No Git mutation, commit, push or deploy was performed.

<a id="execution-ledger"></a>

## Execution ledger — initial integration

- Coordinator observed runtime xhigh/model gpt-6.1-sol, current approval turn01a144d4-e576-7152-a79f-3b22f3e04258: architecture-review exact xhigh PASS before substantive work.
- Full plan saved and independently inspected before application writes. Documentation task writer released its owned record; desktop root now owns this ledger and shared M4 records.
- Native API/Data implementer: kit-implementer thread01a144d6-4d6a-7443-b1db-7cbd1f7d2665; parent/model/exact xhigh independently verified PASS. Owns apps/api/** and canonical M4 contract; no root/script/shared-record writes.
- Baseline read-only inventory confirms retained local PostgreSQL/Redis/SeaweedFS healthy. Other project containers are outside M4 ownership. Existing three Bun listener processes identified under the recorded owned launcher; no process/resource changes performed at this checkpoint.
- New scripts/m4-preservation.ts uses a separate exclusive private baseline and M4 evidence destination, retains original-column row projection and protects all pre-M4 evidence. Capture is running; migrations/fixtures/integration writes remain HOLD until capture PASS.

### Preservation preflight

- `./node_modules/.bin/bun --env-file=.env scripts/m4-preservation.ts --local-m4 capture`: PASS63tables/226905retained baseline rows/1048protected files; exclusive private0600manifest, no raw rows emitted. New M4 evidence excluded; all earlier evidence remains protected. This is retained-data comparison, not operational backup/restore.
- Application write release follows PLAN_SAVED; root retains sequential migration/bootstrap/fixture authority. No DB/schema/application runtime mutation occurred before this capture.
- Native CMS thread01a144d8-ee89-7932-bfaa-35b68dd45c97 and Website thread01a144d9-37a0-7851-9360-ded8f9005155: parent/model/kit-implementer/exact xhigh independently PASS. Initial guessed CMS log timestamp returned missing-file FAIL before actual path check PASS; no substantive child work occurred before correct observation.
- Current ownership: API apps/api/** canonical m4.ts/validation+SQL/modules; CMS apps/admin/**; Website apps/website/**; desktop root scripts/**/shared records/root/runtime/fixtures/build/browser/final integration. No child delegation. Dependent UI expansion waits for the representative real local flow; independent supporting code/checks may continue.

### Representative runtime preparation

- SQL0032/0033 rollback compilation+shape probe PASS, then additive apply PASS with every retained checksum verified and no dispatch. Applied files become immutable; later repairs require forward migrations.
- Website production build PASS. First admin build crossed an intentional supporting-test RED window (missing exports), then source completion/type/lint and second admin build PASS. Initial failed build remains a historical tooling/source checkpoint.
- Positively verified prior launcher PID/cwd/children before SIGTERM; only owned three apps stopped. Docker/data/other projects unchanged. New owned launcher uses private M4 log and same runtime environment selection.
- First browser startup did not execute product journey: bundled Playwright Chromium executable is absent. Bounded repair uses the already-installed Google Chrome through Playwright channel chrome with a fresh isolated context; no browser download/install or retained user profile. Product criterion remains NOT_RUN until successful execution.

- Representative browser attempt reached normal login/config editor, then selector exact-label timeout before save. Rendered screenshot confirms footer fields present. Bounded tooling repair uses unambiguous label prefix for the prefilled textarea rather than changing product behavior or an acceptance assertion. No configuration/home was persisted in this attempt. Historical attempt evidence retained; actual save/publish proof remains open.

- First0034 compile attempt rolled back before SQL because concurrently authored future0035 was outside the runner allowlist. Focused repair: keep checksum verification for every applied file, skip uncommitted files above the explicit through boundary before checking the bounded current allowlist. This does not allow an unknown migration at/below the selected boundary. Recheck with actual future0035 present.

- Second browser attempt PASS ordinary config save and explicit publish with password reauthentication, then stopped before home save on another exact textarea label containing help text. Adjacent tooling repair covers all relevant textarea accessible-name prefixes and resumes already-published config without republishing/resetting it. Home did not exist at this checkpoint. No acceptance assertion reduced; subsequent attempts get distinct evidence filenames.

### First real S13 journey — scoped local PASS

- [Representative browser](../evidence/m4/ui/representative.json): five actual cases PASS: normal password login/config save+explicit publish+reauthentication; home saved/reloaded with anonymousDraft404; savedprivatepreview; publichome200/no-store/VI at1440+390; pendingV2 retains liveV1. Own new tenantA only; no oldfixturechanges.
- Parent inspected publicdesktop/mobile images. Initial resized CMSmobile image was a transitional capture despite geometryPASS; it is not used as final visualproof. [Fresh390px preview](../evidence/m4/ui/representative-mobile-fresh.json) PASS, sidebarinert, currentpendingV2 visible, no overflow/outsidecontrols; parent visually inspected freshimage. No datachanged by follow-upcapture.
- IsolatedAPI/SQL suite after paced normallogin: PASS2tests/46assertions, config/home/globalconfig+pendingcontent and receipts/conflict/independentlocale/fallback. Private raw `.local/m4-api-first-integration-2.log`. Firstsetupfailed429 beforeassertions retained; repair used existing11secondloginpacing, neverdisabledlimiter/resetcounters.
- This closes representative S13-T01 proof only, with initialconfigpath. It does not close completeS13catalog/twothemes, S14/S15, allstates/widths, fullMVP, Production or humanacceptance. Dependent websiteUI expansion released; CMS expansion next.
- Independent native kit-reviewer thread01a144e9-273c-7cc1-b99e-f5c01f4c33e6 exactparent/model/xhigh independentlyPASS. SourcefindingsR1–R8 returned; affectedclaims remainopen pending repairs/regression/sourcecheck. See [review](../evidence/m4/review.md) when handedoff.0035+application held pendingR1legacyintakefix.

### Boundary repair integration checkpoint

- Independent initial review REQUEST_CHANGES R1–R7; R8 dedup source repair recorded. Findings concern actual new-code seams, not inherited product acceptance. API owner prepared focused repairs in approved M4 scope; no tests/assertions/control disabled.
-0035unapplied legacyintake shape repaired before execution;0039forward fixes appliedSQL guards/currentcompatibility/media/pagination/preflightbudgets.0035–0039 rollbackcompile+shapeprobe PASS then additiveapply PASS. Every priorchecksum verified; no oldrowrewrite/scopes/workerdispatch.0032–0039 immutable after apply.
- Permission, privatepreview, virtualEN and fullCMS/website source integration remain in progress. Required reviewfindings are not closed by compilation; actual negative/race/regression checks and affected independentreview remain open.
- First boundary preservation comparison PASS63baseline tables and1048files, no table/filefailures. Newrows/columns remain outside retainedoriginal-column hashes; comparison is not backup/restore.

### Full catalog, locale and intake integration checkpoint

- Website source full catalog/themes/VI–EN reached BUILD_STABLE; pure website62tests/587assertions PASS. Subsequent GET/HEAD-only proxy repair focused7tests/30assertions PASS. Fresh full website production build PASS. Runtime breadth is still pending at this checkpoint.
-0040private-preview closure and blank virtualEN rollbackcompile+shapeprobe/apply PASS.0041lead-source constraint/permission retry and0042draft-slug lifecycle likewise rollbackcompile/apply PASS; retained migration checksums verified every time. Applied0032–0042 are immutable. No migration dispatches workers.
- First expanded runner: core2tests/52assertions PASS; intake0/3FAIL409. Focused source hypothesis found retained legacy service-slug CHECK rejects the requiredNULL columns of a real landing source. First diagnostics omitted Bun metadata; corrected SQL cast reproduced native23514/lead_source_service_slug_check (four observations) before0041. Read-only catalog confirmed the exact constraint.0041 permitsNULL only for the inactive legacy field; lead_source_union still requires the complete old or new source branch.
- After0041, core2/52PASS and intake2PASS/1FAIL51assertions. Remaining failure was a test observation JOIN missing accepted_request.lead_id=lead.id, which returned all tenant leads for one request; repaired the JOIN without reducing the replay/activity/expiry assertion. Locale/boundary suites were NOT_RUN because the runner stops on first failure. A new sequential four-suite run is in progress.
- CMS source found every saved variant reportedslugLocked=true.0042 restores approved first-publication locking, atomic shared-slug rename and sibling-version conflict behavior while retaining immutable revision history. Actual regression remains pending.
- Root script typecheck initially found NodeList iteration withoutDOM.Iterable; replaced it withArray.from. Scoped root-script lint PASS. No dependency or lockfile change. Fresh read-only audit returnedexit1/FAIL; installed chain remains dev eslint-config-next → eslint-plugin-next → fast-glob → micromatch → braces3.0.3. A final M4 serving-exposure assessment remains required.
- Positively identified M4 launcher18880, repository cwd and three children before stopping it for fresh full app builds. Docker/volumes/other project resources remain untouched. The earlier representative runtime is currently stopped; current availability is not claimed until restart/readiness checks.

### Expanded local verification and forward repairs

- SQL0043–0049 each passed rollback compilation/shape probing and then additive application. Every previously applied migration checksum was verified; applied0001–0049 (reserved0023 absent) are immutable. Repairs add no automatic dispatch or enrollment of old worker scopes.
- SQL0043 checks promotion time after lock acquisition. Actual blocked PostgreSQL sessions crossing both start/end boundaries PASS; prior pre-lock clock assumptions do not establish acceptance eligibility.
- Native42702 reproduced ambiguous record/table aliases in legacy admission and filter branches;0044 repairs both. Virtual EN private reads reproduced native55000 from an unassigned legacy record;0045 uses the typed draft state and rejects EN listings without eligible EN presentation. Actual locale suite3/41 PASS, including those seams.
-0046 prunes withdrawn scoped cover metadata on the old service gateway and reserves root, section and both form-option occurrences against node/byte budgets. An initial test assumption that83 options/250nodes must fit was false: read-only native calculation measured conservative1,139,049bytes before config, above1,048,576. The valid control uses70options/211nodes and passes exact output/byte assertions;84options/253nodes remains an atomic rejection. Production limits were not raised. Initial diagnostic `octet_length(jsonb)` failed42883 and was corrected to an explicit text cast; that failed probe proves no budget result.
- Real gallery asset-use grant reproduced22P02/token `scope`;0047 adds parentheses to the JSON subtraction expression while retaining its allowlist.0048 copies historical narrative into a new Draft with the current permanently locked technical slug; history/live remain unchanged.0049 separates resource asset-use withdrawal by locale, including old VI gateway compatibility; global S07 media withdrawal still applies to every locale. Actual restoration2/43 and locale-asset1/44 PASS.
- Signed preview images initially returned500 because spreading an Express request dropped its prototype-backed headers getter. The explicit headers/originalUrl adapter preserves authorization. Actual signed private media with the same authenticated cookie, public media bytes, current/global withdrawal and old-path pruning PASS in media5/184. An initial token-only request to the wrong absolute host was a tooling error, corrected without weakening authentication.
- Unique API/SQL suites at this checkpoint: **30tests/1005assertions PASS**,10files: core2/52, intake3/54, locale3/41, boundary7/321, media5/184, lifecycle4/46, graph1/186, promotion-scope2/34, restoration2/43, asset-locale1/44. Separate child processes preserve normal authentication limiter isolation; no limiter disable/reset. Filtered dated integration JSON records distinguish earlier failures from later scoped passes. API pure8/75 and relevant legacy pure26/191 are separate counts.
- Full FE **161tests/934assertions/42files PASS** (admin98/343, website63/591). Admin/website production builds and latest API build PASS. Full typecheck PASS; first root lint failed one unused API-test type import, removed by its owner; subsequent full lint PASS. No dependency/lockfile upgrade. Later repairs require affected checks again.
- Complete owned demo fixture PASS:30resources/57authored VI–EN variants/two processed synthetic PNGs, normal text/image rights, both config locales/menu15 and active/upcoming/expired campaigns. Private journal is resumable and retains stable operation IDs. The first dense catalog was rejected by the existing graph budget; a bounded fixture-only revision references six shallow card resources while retaining all12section types and original saved/publication history. Existing original24entries and protected VI liveV1/pendingV2 are retained. No old data reset.
- Actual rendered breadth:256completed cases PASS across both themes, VI/EN, content/listing families and320/390/768/1024/1440 widths in `ui/full-afbf6b99-1cc5-43ab-98fd-5878f4ac44d2/results.json`. The overall run is historical FAIL at a tooling assertion expecting an absolute redirect; HTTP302 correctly returned a relative equivalent Location. Resolution against the public origin fixes that assertion. Subsequent `ui/full-0b67a678-1f7b-4138-9ad3-6b196a0110e4/results.json` proves fallback/header/method behavior, then fails on actual sitemap503. These partial results are not recorded as a complete browser PASS.
- Actual sitemap backend500 reproduced native57014 at5017ms under the existing5s statement timeout. Affected SEO is HOLD pending a narrow forward read-model repair and real pagination/eligibility regression. Timeouts, payload limits and fail-closed503 behavior remain unchanged. Remaining form/lifecycle/UI-state journeys are not yet complete at this checkpoint.
- [Bounded outage](../evidence/m4/fault-checks-1792162284388.json) PASS: positively identified owned API paused for at most10s; EN website503 at5002ms, no fallback/Location, no-store and EN error text. Exact API resumed; health and page recovered200. No fixture/credential writes. This is a bounded local transport fault, not Production recovery/SLO or backup/restore.
- Fresh independent M4 serving-exposure assessment supports bounded local deferral only:45Next traces/8665listed references and inspected API/server JS show zero advisory-chain matches at the pinned builds. Audit remains **FAIL/open**, not a pass; reassess2026-10-22/earlier stated triggers/before Production. Reviewer runtime/source follow-up remains open for newer changes and final proof.

### Completion journeys and SEO repair checkpoint

- Fresh separate locale runner [3tests/41assertions PASS](../evidence/m4/integration-checks-1792162444167.json) supplies the exact filtered result. The earlier private combined run had three locale cases PASS followed by a different suite's beforeAll429, overall3PASS/1FAIL; it was not an overall pass. The separately rerun boundary suite7/321 remains valid. No authentication control was disabled.
- Browser EN form uses the actual landing source, EN consent and independent preferred contact VI. The real backend accepted, the tool dropped only the acknowledgement, then UI retried the exact frozen semantics/key and read the real lead/source in CMS. [Completed form result](../evidence/m4/ui/full-1bbf2a71-d8a0-4002-9d3d-597bb90ebfc2/results.json) is inside an overall historical FAIL at the following lifecycle tooling selector. API native tests separately prove A1/A2 read and exact single lead/intent/receipt/consent/tracking retention behavior.
- [CMS lifecycle](../evidence/m4/ui/full-876a69e4-ad44-4e03-b206-d383fb0cfc9e/results.json) PASS: same owned page save/publish/pending Draft/restore to Draft/live unchanged/unpublish404. Initial exact-label errors and a transient save-notice assertion failed before completion. The first save actually persisted version1; the coordinator resumed that same page rather than resetting it. A later incorrectly assumed variant route was corrected against the actual VI helper `/cms/pages/<id>`. These are tooling failures, not evidence of failed product persistence.
- [Eight UI states](../evidence/m4/ui/states-0587a50b-4b6d-4bdc-ae0a-9b66c20788ae/results.json) PASS: actual backend409 across two tabs with retained input/explicit rebase; committed save response loss followed by exact operation/version replay; real empty filtered list; actual all signed reference images loaded; mobile menu keyboard open/first-link/close. Loading,503retry and403input closure use explicitly controlled HTTP responses; they prove UI handling, not an actual revoked browser membership or outage. Actual current membership denial is native API proof; the separate API pause proves bounded transport outage. Root visually inspected the loaded gallery and conflict comparison captures.
- Reviewer source finding: frozen ready0050 allowed direct SQLNULL limit because `NOT BETWEEN` evaluatedNULL. Before application, the owner added only `lim IS NULL OR`, reran type/lint, and root reran rollback compile/shape probe. Reviewer accepted exact hash `ade84e01a91f65d0d93588093d4da5dbeacc683ef9d3dfddd78fcbcd0c3ed451`.0050 then applied immutably with retained checksums/no dispatch. Demo SQL51rows/133ms PASS. [Actual runtime role controls](../evidence/m4/seo-sql-role-controls.json) PASS: private helper execute denied twice42501 and NULL/0/52 bounded returns.
- First native SEO suite1PASS/1FAIL116assertions: global-media pruning/SEO identity case PASS; the pagination case stopped before enumeration because its new blank EN fixture did not author all required fields and save returned400. This is a fixture-contract error; validation remains unchanged. Separate actual demo API page0 returned200/50items/150ms, page1 returned400/1ms. Root confirmed the generic cursor decoder rejects colon in the SEO-generated `kind:id:locale` after value. Focused API-owner repair is confined to the SEO codec; generic cursor checks and0050 stay unchanged. Sitemap remains HOLD until actual continuation/consumer tests pass.

### Vertical-slice coverage map — final SEO still pending at this checkpoint

The approved22tasks stay unchanged. Each row links implementation responsibility to actual evidence, without treating source, browser, native execution or human acceptance as interchangeable. Detailed native results are the dated integration JSON files under [M4 evidence](../evidence/m4/); the final snapshot will select the applicable later PASS per suite and retain earlier failures.

| Task | Integrated result and verification |
| --- | --- |
| S13-T01 | Saved home/private preview/anonymousDraft404/liveV1 with pendingV2: representative browser5cases and core2/52 PASS. |
| S13-T02 | Independently published presentation/theme/config with pending page preserved: core native and real config save/reauth/publish; both-theme render matrix PASS. |
| S13-T03 | Typed same-tenant menu/CTA and current target filtering: boundary/locale tests;15-target real config; mobile keyboard UI PASS. |
| S13-T04 | Typed page/section editing, permanent slug lock after first publish, conflict/restore/unpublish: boundary/restoration native, real lifecycle and two-tab/save-retry UI PASS. |
| S13-T05 | Full12section catalog and real pinned references/decimal price/media/forms: schema/security/graph/promotion suites and catalog browser PASS. |
| S13-T06 | Clarity details/listings across S03/M3 and new families: actual VI/EN matrix, images and layout checks PASS. |
| S13-T07 | Showcase on the same stored schema, including campaigns/long catalog: actual VI/EN matrix/five widths; controlled error/empty UI and current withdrawal native proof PASS within recorded coverage. |
| S13-T08 | Legacy adoption/generation conflicts/old anonymous JSON+media guards: locale/boundary/media/restoration native PASS; retained baseline comparison PASS. |
| S14-T01 | Promotion dates/timezone/applicability and private/public states: validation/lifecycle/promotion-scope native; active/upcoming/expired real browser PASS. |
| S14-T02 | Real landing hero/content/promotion/pinned form: owned published demo and both-theme/locale render PASS. |
| S14-T03 | Actual landing source union/common lead/A1/A2 read: intake3/54 native and EN form→CMS browser PASS. |
| S14-T04 | Concurrent replay, changed payload, bound CAPTCHA and unknown acknowledgement: native intake/boundary PASS and actual browser response-loss/same-request retry PASS. |
| S14-T05 | Post-lock start/end and stale source/offer rejection; accepted replay no activity/expiry refresh: lifecycle/intake/promotion-scope native PASS. |
| S14-T06 | Bounded source/tracking and existing S05 command/S06 deletion graph: native lifecycle and actual CMS source panel PASS. No raw referrer/query storage introduced. |
| S14-T07 | Both themes and EN actual consent/preferred VI: render matrix/native exact EN consent and real form PASS. |
| S15-T01 | Service VI/EN publication independence, blank EN private state and immutable VI: locale/boundary native and actual HTML lang/metadata matrix PASS. |
| S15-T02 | Missing/Draft/unpublished EN→eligible VI; unavailable both404; unsupported405; caller internal-header overwrite: actual HTTP and native locale PASS. Actual API outage503/no fallback PASS. |
| S15-T03 | All M3 families have typed EN snapshots/refs and per-locale patient text/asset rights: locale/media/asset-locale native and detail/listing render PASS. |
| S15-T04 | Same-schema builder/config/menu/home EN with actual locale: core/locale and real themes/config/menu/HTML PASS. |
| S15-T05 | EN promotion/landing/form source/consent and independent preferred language: intake exact SQL assertions and actual browser PASS. |
| S15-T06 | Page metadata/canonical/actual reciprocal alternate render PASS; full sitemap continuation currently HOLD for the bounded SEO codec repair. |
| S15-T07 | Expected publication/config identity, no stale generation/media/legacy output: pure/locale/media/restoration native PASS. SEO continuation/current-eligibility closure and final review remain pending. |

No browser claim covers every possible state×family×width combination. Local controlled clocks are distinct from natural waiting; source-complete integration is distinct from human acceptance. Operational backup/restore, Production scale/SLO, live DNS/TLS/indexing/external delivery/fullMVP and S16–S18 remain outside this package.

### SEO and final technical closure — later verified result

- API owner authored the mandatory EN Hero/body fields in its new fixture; production validation and assertions remain unchanged. The dedicated `builder-seo-cursor.ts` encodes the composite after key inside a canonical bounded base64url value. Only `BuilderService.seo` uses it; generic cursor checks remain unchanged. Independent affected source review and4pure/124assertions PASS. Differential source verification confirms other BuilderService methods are unchanged, so earlier matching native proofs remain applicable.
- Parent positively verified launcher34540/cwd/three children, stopped only that owned launcher and started the same three apps from the final build. No Docker, DB/storage resources, credentials, ports or configuration changed. Root final API build exit0 PASS; current runtime probe PASS3Bun listeners/6diagnostics on the final launcher.
- [Native SEO regression](../evidence/m4/integration-checks-1792163336362.json) **PASS2tests/3941assertions**:54initial entries paginate50/4 with EN/VI of the same identity across the cursor; exact reciprocal IDs; EN config unpublish/republish, content unpublish/republish, required patient-text withdrawal versus optional pruning and global media withdrawal agree with actual delivery. [Filtered measured page times](../evidence/m4/seo-native-timings.json) max18ms in the owned fixture. SQLNULL/0/52 and private-helper denial are separate actual role controls. The five-second deadline remains unchanged.
- [Actual demo HTTP](../evidence/m4/seo-http-final.json) PASS:59eligible URLs, API pages50/9 at112/19ms; sitemap200/59entries/117ms/no-store; complete measured sequence408ms. [Fresh HTTP browser](../evidence/m4/ui/full-7b976684-eea2-4b5e-b84a-b369e5d461ff/results.json) PASS3cases: normal own-fixture login, fallback/method/header handling and actual sitemap/robots. These local measurements are not a Production scale/SLO guarantee.
- The earlier S15-T06/T07 SEO HOLD is now superseded for the exact repaired/proven continuation and current-eligibility scope. Together with the unchanged22-task coverage map, S13–S15 are code-integrated and locally verified. Initial plan-save NOT_RUN, intermediate failures and the earlier partial browser records remain unchanged historical evidence. Human acceptance is still pending.
- Unique API/SQL result is now **32tests/4946assertions/11files PASS**; do not add repeated runs or pure counts to that total. Full FE remains161/934/42files PASS; final full root typecheck and lint exit0 PASS after the codec/root-tool changes. Admin/website production builds and final root API build PASS. Earlier assertion/fixture/tooling/native failures remain recorded above.
- Final retained comparison PASS63tables/226905baseline rows/1048protected files, zero unexpected changes and zero removed baseline volatile rows. It verifies original-column hashes and file hashes/modes, not backup/restore. Fresh current runtime PASS3Bun listeners/6diagnostics. Known-value scan PASS57private values/123forms and no matches in checked source/serving text; no OCR/runtime-memory/comprehensive secret-discovery claim.
- HEAD remains813a8c90952348a5f46e6d5ac1e398096dfe6a1f. Worktree contains the approved uncommitted M4 changes. No index mutation, commit, push, remote update or deployment was performed. Final documentation/static inventory checks and reviewer artifact refresh are recorded in the final handoff below when complete.

- [Actual editor controls](../evidence/m4/ui/editor-516d54d0-3b02-4474-8bc0-7d03c13e271d/results.json) PASS3cases on the same owned unpublished workflow Draft: add/move/hide/save/reload with hidden content absent from private preview; select an actual published FAQ reference/persist exact pin/reload/preview; remove the added sections/save/reload and retain anonymous404. No publish/config or old-fixture changes. Source-only root type/lint apply to this new verifier separately. The public catalog contains12section types; consultation is the13th supported type and is exercised on the real landing/form, not claimed present in that catalog page.

<a id="final-local-handoff--2026-10-16"></a>

## Final local handoff — 2026-10-16

**Technical result: CODE_INTEGRATED + VERIFIED_LOCAL / READY_FOR_USER_REVIEW. Human result: HUMAN_ACCEPTANCE_PENDING.** All22approved tasks in S13–S15 have source integration and matching scoped local proof; the preceding coverage map and later SEO closure are read together. The [final snapshot](../evidence/m4/final-checks.json) selects the exact applicable evidence. No original historical FAIL/Unknown/NOT_RUN record is converted into a pass. S01–S12/AUTH/M1/M2/M3 HUMAN_ACCEPTED remains unchanged within its recorded scopes.

**Delivered behavior:** one13-type section schema with original Clarity/Showcase themes; independently versioned/published presentation and typed menu; saved private preview with real references/signed media; new home/pages and existing dental content across VI/EN; real promotions/landing-source lead intake with exact consent, replay, applicability and retention behavior; actual-language routes/fallback/metadata/sitemap. Permanent route locking starts at first publication. Restore keeps historical narrative and current locked technical identity in a new Draft. Current resource/locale rights and global media revocation override delivery without rewriting history.

**Important components:** `apps/api/src/contracts/m4*.ts`, Builder/Intake services and worker adapters; additive migrations0032–0050; CMS builder/editors/permission/preview/history/source consumers; website section/theme/locale/proxy/SEO consumers; scoped root fixture/worker/preservation/runtime/browser utilities. [ADR-013](../decisions/013-local-m4-builder-campaigns-locales.md), architecture/access/workflows/runbook and current project records are synchronized. The complete source plan was saved before dependent writes.

| Verification | Final actual result and boundary |
| --- | --- |
| API/SQL |32unique tests/4946assertions/11files PASS; root native execution, no skip/fail in selected final runs. Source/receipt/locale/permissions/media/budgets/worker/fence/retention/current SEO covered; no blanket old-fixture suite rerun. |
| CMS/website |161tests/934assertions/42files PASS, separate from native and overlapping pure subsets. |
| Actual browser/HTTP |184detail+56listing+10public-width+5authenticated-editor+login completed cases retained from the historical partial run; real form/lifecycle/8states/3editor-control cases and final HTTP3case reports provide separate matching closure. Controlled HTTP cases are explicitly identified. |
| SEO |Native2/3941 included above; actual59URL API50+9/XML200 with preserved5s deadline; measured demo timings are local only. |
| Build/static |Admin/website production builds, final root API build, full root type/lint PASS; additional final root-verifier focused type/lint PASS. Documentation/hash/known-value/whitespace checks are in the final snapshot. |
| Runtime/fault |Final3Bun loopback listeners/6diagnostics; actual owned API outage→EN503/no fallback→resume200. Availability is point-in-time. |
| Data/files |63baseline tables/226905rows/1048protected files preserved with original-column hashes/file modes and narrow recorded exclusions; no unexpected changes, no backup/restore claim. |
| Independent review |[CLOSED R1–R13](../evidence/m4/review.md) at exact source/build/evidence pins. Reviewer ran pure34/187 and later4/124 separately; DB/browser/worker proof remains coordinator-run. |
| Audit |**FAIL/open high braces**, fresh bounded local-M4 deferral only. Final68API JS and unchanged45Next traces/8665listed references contain0advisory-chain matches under the static method; not universal dynamic absence. Reassess2026-10-22 or earlier patch/dependency/exposure change and before Production; no Production waiver. |

Migrations0001–0050 are retained/applied where present (reserved0023 absent); every applied checksum was verified. No old tenant/credential/resource reset, old worker enrollment/backlog dispatch, dependency/lockfile change, Git/index mutation, commit/push/deploy, DNS/TLS, provider delivery, paid service or global configuration action occurred. HEAD remains813a8c90952348a5f46e6d5ac1e398096dfe6a1f. Worktree contains the approved M4 changes for review.

**Local human review:** open `http://127.0.0.1:5891/login` using only the private `.local/m4-fixtures.json` A1/A2 credentials. Select tenantA (`e44fee71-6a89-4201-8b3d-c00fa799e984`); no credential values belong in this record/chat. CMS `/cms/pages`, `/cms/website`, `/cms/promotions`, `/cms/landings` and `/cms/leads` expose the delivered flows. Public root is `http://localhost:5892/m4-153593c6-a`, EN adds `/en`; the catalog/landing are listed in the owned demo manifest. Existing complete fixtures preserve edits; browser journey commands mutate only positively owned synthetic records and are not read-only health checks. The runbook explains selectors and limits.

Review the two themes and VI/EN, a saved/pending page/private preview, a campaign/form/common lead source, and history/unpublish. Existing earlier data and historical evidence stay available. Natural-duration waiting, operational backup/restore, all state×family×width combinations, production scale/SLO, live DNS/TLS/custom-domain activation/indexing/external delivery/fullMVP remain NOT_RUN/outside M4. Controlled clocks/pauses do not establish those claims; content invalidation remains distinct from physical media purge. S16–S18 execution is not approved.

**Final documentation/static checks:** `python3 -B scripts/verify_agent_setup.py` PASS81maintained hashes/9declared adaptations/28mirror pairs/17skills per root/3native definitions per client; all current Markdown links/anchors/frontmatter/TOML PASS. AGENTS/README maintained hashes and exact M4 authority provenance are synchronized without changing original Kit/mirror/upstream pins. The first checker failed only the two planned final-snapshot links before that JSON existed; its original log remains, and the complete later checker passes. [Changed source whitespace/JSON](../evidence/m4/final-source-static.json) PASS; `git diff --check` PASS. Final exact-known-value scan PASS57values/123forms,0findings across checked source/serving text; limits unchanged. The final snapshot names exact dated evidence. No further application change followed the final native/build/review closure.

**Next-step options:**

1. **Recommended:** Khiêm reviews the local M4 flows and explicitly accepts M4 if satisfactory. Outcome: human acceptance can then be recorded without adding runtime/Production proof.
2. If a concrete issue appears during review, report its route/actor/action/result. Root can repair within existing approved M4 scope and run affected verification; any material scope/approach expansion requires a new reviewable decision.
3. Git delivery or S16–S18 work requires a separate explicit instruction. This handoff grants neither; the open audit deadline/earlier triggers remain in force.

<a id="delegated-m4-acceptance--2026-10-16"></a>

## Delegated M4 acceptance — 2026-10-16

**Kết luận: ACCEPTED_UNDER_DELEGATED_AUTHORITY cho M4 v0.1 S13–S15 trong phạm vi local đã duyệt.** Technical status giữ **CODE_INTEGRATED + VERIFIED_LOCAL**. Không có lỗi mới chặn nghiệm thu trong phạm vi đã kiểm chứng; review độc lập R1–R13 được kế thừa đúng source/artifact pins. Đây là quyết định nghiệm thu của `/root` theo ủy quyền, không phải câu trích dẫn trực tiếp rằng Khiêm đã tự chạy UAT hoặc nói “HUMAN_ACCEPTED”.

### Nguồn ủy quyền và người quyết định

Sau final local handoff, Khiêm trực tiếp yêu cầu trong desktop thread `01a144ca-5b34-7a52-b1f7-2a36f6c206f1`, turn `01a1454c-5a1c-7b71-8788-069f60950e46`:

> review và nghiệm thu cho tôi.

Phạm vi đang trao đổi là gói M4 local đã triển khai theo kế hoạch v0.1 và toàn bộ quyết định S13–S15, kế thừa813a8c9. Khiêm là người giao quyền; desktop `/root` là người thực hiện review và đưa ra kết luận nghiệm thu. Không suy rộng thành quyền Git, Production, deploy hoặc S16–S18. Quyền triển khai local trước đó và các giới hạn bảo toàn vẫn giữ nguyên.

Runtime coordinator của lượt review được quan sát độc lập từ metadata: required/requested/observed **xhigh/PASS**, model `gpt-6.1-sol`, đúng thread/cwd/turn trên. Đây là bằng chứng cấu hình agent, không thay thế kiểm chứng sản phẩm. Áp dụng `code-review-and-quality`, `technote` và `documentation-and-adrs`. Không chạy agent review độc lập mới chỉ vì đổi giai đoạn; kết quả review trước được tái sử dụng vì source/build liên quan không đổi.

### Review và kiểm chứng thực tế trong lượt nghiệm thu

- Application source khớp toàn bộ pins áp dụng của bản review độc lập, ghép theo các follow-up theo thời gian; không có mismatch. API serving build68JS khớp manifest `4b9a2d75dee39892604f53ed35ef9f1281ebaca401b882bc5999501ef985d72c`; Next BUILD_ID và trace digests của hai app khớp bản đã review. Không có application edit hay rebuild trong lượt này.
- Chạy lại ba pure suites validation/security/SEO cursor: **12tests/199assertions PASS**; đây là focused repeat, không cộng vào tổng native32/4946 hoặc FE161/934 trước đó.
- [Browser nghiệm thu mới](../evidence/m4/acceptance-b2f7f857-4c0d-4417-b785-ccb459e9c7c5/results.json): **10cases PASS**, không browser errors. Bao gồm VI/EN home, EN catalog/landing tại1440/390, publication/config/canonical/language/no-store/ảnh thật/không tràn ngang, fallback302+sitemap, saved private reference/media preview, A1 và A2 xem cùng lead và nguồn landing. Root đã xem ảnh mobile landing, gallery preview và nguồn lead của A2. Public publication/config IDs không đổi trước/sau.
- Browser chỉ đọc content/config/leads; đăng nhập tạo session bình thường. Không submit form mới, save/publish/unpublish, đổi theme, chạy worker hay sửa fixture. Các luồng ghi, races, retention, withdrawal, theme1 và meaningful states giữ bằng chứng thực đã kiểm chứng ở final snapshot; không tự biến thành lượt chạy mới.
- Runtime hiện tại **3Bun listeners/6diagnostics PASS**. Bảo toàn **63bảng/226905hàng baseline/1048files PASS**, không có thay đổi ngoài dự kiến. Đây là kiểm tra điểm thời gian và hash, không phải backup/restore.
- [Bản ghi nghiệm thu](../evidence/m4/acceptance-review.json) giữ exact provenance, pins, bằng chứng và giới hạn. Original [final-checks.json](../evidence/m4/final-checks.json) không sửa; fieldPENDING là checkpoint lịch sử trước ủy quyền, được bản ghi mới thay thế về trạng thái hiện hành mà không thêm runtime proof cho quá khứ.

### Giới hạn được giữ nguyên

Audit high `braces3.0.3` / `GHSA-vfj7-8cjw-p6xm` vẫn **FAIL/open**, theo fresh bounded local-M4 assessment tại đúng pinned builds. Reassess **2026-10-22**, hoặc sớm hơn khi có patch/dependency/exposure change và trước Production. Nghiệm thu này không tạo Production waiver. Không kiểm tra lại khả năng có patch trong lượt này.

Natural-duration waiting, operational backup/restore, mọi tổ hợp state×family×width, production workload/SLO, live DNS/TLS/custom-domain activation/indexing, external delivery và fullMVP/S18 vẫn NOT_RUN/ngoài phạm vi. S01–S12/AUTH/M1/M2/M3 HUMAN_ACCEPTED và mọi FAIL/Unknown/NOT_RUN cũ được bảo toàn. Không đổi source/schema/configuration/global state, commit/push/deploy; HEAD vẫn813a8c9, các thay đổi M4 vẫn chưa commit. Chỉ cập nhật hồ sơ nghiệm thu và current pointers/hashes; kiểm tra bookkeeping được ghi trong acceptance-review.json.

**Bookkeeping cuối lượt nghiệm thu:** Agent Kit static PASS81maintained hashes/28mirror pairs/17skills mỗi root/3native definitions mỗi client; Markdown links/anchors/frontmatter/TOML PASS. M4 evidence JSON parse và `git diff --check` PASS. Known-value scan PASS57values/123forms/0findings trong source/serving text; không phải OCR/runtime-memory/comprehensive discovery. Exact results ở acceptance-review.json. Original final-checks.json vẫn khớp hash trước nghiệm thu.

**Bước tiếp theo:**

1. **Khuyến nghị:** Khiêm có thể cấp lệnh commit/push riêng nếu muốn lưu Git gói M4 đã nghiệm thu local; chưa có quyền thực hiện Git từ yêu cầu nghiệm thu này.
2. Có thể yêu cầu lập kế hoạch Chặng5/S16–S18 để review. Nghiệm thu M4 chưa cho phép triển khai chặng tiếp theo.

<a id="m4-git-delivery-authority--2026-10-16"></a>

## M4 Git delivery authority — 2026-10-16

Sau nghiệm thu local theo ủy quyền, Khiêm trực tiếp yêu cầu:

> commit, push gói M4

Nguồn: desktop thread `01a144ca-5b34-7a52-b1f7-2a36f6c206f1`, turn `01a14551-f345-7aa1-9d01-4413d8a79c18`. Quyền mới chỉ gồm kiểm tra, stage, commit gói M4 cùng hồ sơ/evidence và normal push trên nhánh hiện tại `main` lên `origin/main` của `khiemnd777/godent-cms`. Không cấp quyền deploy, Production, S16–S18, thay đổi dữ liệu/credentials, reset hay force-push. Các câu “chưa commit/push” trước mốc này là checkpoint lịch sử; delegated acceptance và technical proof không đổi.

Preflight xác minh HEAD và live remote đều `813a8c90952348a5f46e6d5ac1e398096dfe6a1f`, index ban đầu rỗng, toàn bộ thay đổi thuộc gói M4 đã triển khai/nghiệm thu; không có workflow deploy trong repository. Chỉ stage source/migrations/tests/scripts và hồ sơ/evidence Git-visible của M4. `.env`, `.local`, credentials, database/storage, dependencies và build outputs tiếp tục ở ngoài commit. Evidence giữ cả FAIL/Unknown/NOT_RUN và các lần sửa tương ứng; không loại lịch sử để làm đẹp kết quả.

Desktop `/root` giữ final-integration/Git responsibility. Current package exposure/security preflight required/requested/observed xhigh PASS trên đúng turn/model/cwd; đây là metadata điều phối, không phải product proof mới. Dùng `git-workflow`, kiểm tra staged diff/whitespace/known values và static inventory; tái sử dụng runtime/review đã khớp pins, không rerun blanket mutating suites. Kết quả trước commit nằm trong [delivery preflight](../evidence/m4/git-delivery-preflight.json). SHA commit/push và đối chiếu local/remote sau lệnh được báo trong chat cùng Git history; tài liệu này ghi authority/preflight, không tự tuyên bố lệnh tương lai đã thành công.

**Kết quả staged check thực tế:** scope456files (50modified/406added) và dependency/retained-migration checks PASS. `git diff --cached --check` trảexit2/FAIL duy nhất tại `0035_m4_intake_sources.sql:166`: thêm một dòng trắng ởEOF. Đây là source SQL đã áp dụng, staged bytes khớp reviewed/applied pin và có đúng2LF cuối file. Giữ nguyên migration/checksum và ghi FAIL này, không normalize file, sửa DB/checksum hoặc đổi cấu hình checker để làm xanh. Bàn giao đúng gói đã nghiệm thu trong quyền commit/push hiện tại; lỗi cosmetic này không tạo thêm product/runtime proof hay thay đổi audit deferral. Original final/acceptance snapshots giữ nguyên lịch sử và phạm vi kiểm tra ban đầu.

**Bước tiếp theo trong quyền hiện tại:** stage đúng gói M4, commit, normal push, đối chiếu SHA/divergence và final working tree. Nếu remote thay đổi hoặc có lỗi hook/permission, giữ lịch sử và báo nguyên nhân cụ thể; không bypass/force-push. Sau bàn giao Git, có thể yêu cầu lập kế hoạch Chặng5 riêng; không có deploy tự động từ quyền này.
