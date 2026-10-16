# GCMS-M2-001 — Approved M2 v0.1 local execution

**Current result — HUMAN_ACCEPTED.** Khiêm accepted M2 (inherited S05 and S06–S08) on2026-10-16 Asia/Ho_Chi_Minh. [Human acceptance](#human-m2-acceptance--2026-10-16) records the exact instruction and provenance. Technical CODE_INTEGRATED + VERIFIED_LOCAL and all bounded proof/FAIL/Unknown/NOT_RUN limits in the [final local handoff](#final-local-handoff--2026-10-16) remain unchanged. Earlier pending statements are historical; no Git delivery, deployment or S09–S18 authority follows.

## Current authority and ownership

**APPROVED_EXECUTION_PLAN / PLAN_SAVED — 2026-10-16 Asia/Ho_Chi_Minh.** Khiêm directly approved in desktop thread `01a1437b-7cd2-7b23-92ef-70226da96f3f`:

> Duyệt M2 v0.1 và S06-D01–D04, S07-D01–D06, S08-D01–D04. Lưu kế hoạch rồi triển khai local theo phạm vi đã đề xuất, gồm dependencies, migrations, fixtures, worker/storage/capture và kiểm chứng. Chưa commit/push/deploy.

This direct instruction authorizes saving the complete plan before application writes, then bounded local implementation/dependencies/forward migrations/new owned fixtures/worker/storage/capture and verification. Preserve existing data, credentials, resources, applied migrations0001–0014, old evidence and pending backlog. Physical deletion tests are limited to newly owned synthetic data. No external email/provider/production/DNS/TLS/global/paid/real-data/existing-resource destruction/reset/Git commit/push/deploy. S09–S18 execution remains unapproved. Human M2 acceptance is separate. Latest instruction is this approval; no subsequent stop.

Desktop `/root` in this thread is the accountable approved M2 coordinator and sole shared-record/root/lockfile writer. Capability owners are assigned below before dependent writes. Inherit selected model. Coordinator implementation risk floors require/request/observe xhigh; current runtime metadata PASS (`gpt-6.1-sol`, turn `01a14384-f13c-7583-bdcb-f67dd95ee667`). Children require exact native Kit role/parent/model/xhigh checks. No recursive delegation.

S01–S05, AUTH and M1 remain HUMAN_ACCEPTED within recorded limits. S05 is inherited, not rebuilt. Browser expired-lead removal is checked in S06; Enter-triggered outage recovery is a bounded M2 integration check; operational backup restore remains NOT_RUN/outside M2 while stale-data restoration safeguards are local criteria. Audit braces remains FAIL/open under bounded local deferral, reassess2026-10-22/earlier dependency or exposure change/before production. S07 dependency changes require fresh exposure assessment; no automatic upgrade.

## Source-complete approved plan

The following is the exact reviewed assistant plan, with repository links normalized only. Proposal labels describe its historical review state; the direct approval above accepts M2 v0.1 and all listed decisions. Source SHA-256: `dea17459a4e8aff933864f2183e5d9d442dc3cd4b88511903d1b662e46277ffa`; source characters: 31254. No other chat/tool/private content was copied. Initial application/runtime/UAT evidence for S06–S08 is NOT_RUN.

**Đề xuất M2 v0.1:** kế thừa S05 đã nghiệm thu; hoàn thành S06–S08 để quản trị viên vận hành lead đúng thời hạn, sử dụng ảnh an toàn và quản lý đầy đủ vòng đời biên tập.

Toàn bộ nội dung dưới đây là **kế hoạch đề xuất để review**. Chưa lưu file hoặc triển khai.

**Đã xác minh trong lượt này**

- Working tree sạch trên `main`; `HEAD` và remote-tracking ref `origin/main` cùng tại `06d729f30f532db5679b6dfd4de349e9875f4b77`. Chưa truy vấn GitHub trực tiếp.
- Runtime ghi nhận `gpt-6.1-sol`, **xHigh — PASS**.
- M1, AUTH và S05 đã được nghiệm thu theo append mới nhất. Các đoạn “pending” cũ là checkpoint lịch sử.
- AUTH hiện dùng email đã xác minh + mật khẩu. Giữ session, reauth bằng mật khẩu, CSRF, phân quyền và tenant isolation.
- Khảo sát dựa trên tài liệu, code, tests và ảnh mockup có sẵn. Không chạy ứng dụng, Docker, tests hoặc UAT.

Nguồn chính: [master plan M2](../project-plan.md), [delivery workflow](../delivery-workflow.md), [nghiệp vụ retention/media](../workflows.md) và [baseline UI đã duyệt](../design/admin-mockup/approved-baseline.json).

**1. Bức tranh toàn Chặng 2**

| Slice | Kết quả người dùng | Hiện trạng | Phụ thuộc thực tế |
|---|---|---|---|
| **S05** | Theo dõi và xử lý lead hằng ngày | **HUMAN_ACCEPTED**; kế thừa implementation và D01–D12, có cập nhật AUTH | S04 |
| **S06** | Biết lead sắp bị xóa; gia hạn có căn cứ; dữ liệu hết hạn không còn truy cập và được xóa | Có tính deadline và chặn truy cập backend; chưa có đầy đủ notice/extension/delete/audit-expiry | S04 + hợp đồng activity/status S05 hiện đã có |
| **S07** | Upload ảnh hợp lệ; dùng ảnh đã có quyền; thu hồi quyền truy cập có hiệu lực | Có S3 local và kiểm chứng kết nối; chưa có nghiệp vụ media | S01/S03, quyền tenant và storage local |
| **S08** | Xem lịch sử, khôi phục thành draft, ngừng xuất bản và xuất bản lại an toàn | S03 có draft/publish/snapshot; thiếu hành trình history/restore/unpublish đầy đủ | S03; kiểm chứng lịch sử có ảnh cần phần S07 tương ứng |

Thứ tự khuyến nghị:

1. Chốt contracts và quyền thực thi của gói sau review.
2. Làm luồng đại diện S06; đồng thời có thể khảo sát kỹ thuật decoder/storage của S07.
3. S07 triển khai media; S08 có thể làm history/restore/unpublish cho nội dung văn bản độc lập.
4. Tích hợp S07–S08 tại reference, snapshot và current eligibility.
5. Chạy UAT tích hợp M2, đối chiếu bằng chứng và bàn giao nghiệm thu.

Không cần chờ toàn bộ S06 mới bắt đầu S07 hoặc S08. Chỉ tuần tự hóa phần chung như migration numbering, publication contract và cùng một component editor.

**Ranh giới chung giữ nguyên**

- Một tenant quản lý chung toàn bộ lead; assignment không phân quyền.
- Platform Admin không có quyền ngầm đọc lead hoặc nội dung riêng tư.
- Tenant suspended vẫn cho phép phạm vi đọc lead đã được duyệt; các lệnh ghi hiện tại vẫn yêu cầu tenant active.
- Không thêm clinical review gate, hồ sơ bệnh án, attachment cho lead, SVG, remote image import hoặc full Web Builder.
- Không triển khai S09+, provider production, email thật, DNS/TLS, tenant deletion hoặc chính sách backup production.
- Mockup duyệt bốn màn hình đại diện và pattern chung. Retention controls, media library và history/restore cần phần UI mở rộng được mô tả trong kế hoạch này.

---

**2. S05 — Phần kế thừa và kiểm chứng bổ sung**

Theo [ledger cuối và nghiệm thu S05](../tasks/GCMS-S05-001.md), kế thừa:

- Shared list/detail; assignment; note/contact; close/reopen; lịch sử.
- `expectedVersion` và `operationId`; state/event/audit/receipt ghi nguyên tử.
- Search/filter/count/keyset pagination tại nguồn.
- Recipient settings; worker PostgreSQL/Bun có lease, fencing và retry hữu hạn.
- Local capture theo delivery ID; thông báo không chứa tên/contact/message của khách.
- Scoped API/worker **32 tests, 472 assertions** và admin **29 tests, 101 assertions**, cùng bằng chứng browser/build/runtime đã ghi nhận. Đây là kết quả cũ được tái sử dụng, không phải lượt chạy mới.

D01–D12 tiếp tục áp dụng, riêng điều kiện MFA đã được AUTH thay bằng email verified + password/current account eligibility. Không khôi phục MFA từ nội dung lịch sử.

| Mục còn `NOT_RUN` | Phân loại đề xuất | Cách xử lý |
|---|---|---|
| **Browser expired-lead removal** | Thuộc kiểm chứng S06 | Kiểm selected detail, history, list, count và badge khi qua deadline; kiểm request trả muộn không đưa dữ liệu trở lại |
| **Enter-triggered outage recovery** | Khoảng trống browser nhỏ của S05 | Bù khi tích hợp M2: giữ lỗi đúng request, focus nút Retry, nhấn Enter rồi quan sát request mới và dữ liệu phục hồi |
| **Backup restore vận hành** | Ngoài M2, thuộc AC-09/D5 còn mở | Giữ `NOT_RUN`; không coi file backup hoặc preservation checks là restore proof |
| **Ngăn dữ liệu cũ hồi sinh sau phục hồi** | Thuộc safeguard local S06/S07 | Kiểm replay dữ liệu thử cũ vào môi trường biệt lập và áp lại quyết định xóa/thu hồi trước khi cho truy cập |

Enter recovery phải chứng minh chính thao tác Enter gây request phục hồi. Automatic polling recovery trước đây không được dùng thay bằng chứng này.

**Không lập lại S05.** Chỉ sửa phần bị tác động bởi S06 hoặc lỗi thực tế phát hiện trong các kiểm chứng bổ sung, theo quy trình repair của repo.

---

**3. S06 — Retention và thời hạn audit**

**Mục tiêu:** quản trị viên biết deadline, nhận cảnh báo, gia hạn có lý do khi hợp lệ; dữ liệu hết hạn bị chặn và được xóa đầy đủ dù worker gặp lỗi.

**Hiện trạng đã xác minh**

Backend đã lọc `expires_at` ở lead reads và RLS. Commands kiểm quyền và expiry trước cả receipt replay. UI có timer cho detail đang mở.

Tuy nhiên, dữ liệu riêng tư còn nằm trong `lead_event.payload` và `operation_receipt.command`. Một số bảng intake/audit có khóa ngoại tới lead và chưa cho xóa độc lập. Vì vậy, S06 phải xử lý toàn bộ đồ thị dữ liệu, không chỉ `DELETE lead`.

**Quyết định đã chốt**

| Nội dung | Quy tắc phải giữ |
|---|---|
| Lead mở | Last substantive activity + **180 ngày**; dùng creation nếu chưa có |
| Lead Closed | Sớm hơn giữa closure + **90 ngày** và activity + **180 ngày** |
| Spam | Giới hạn **30 ngày**, subject to deadline sớm hơn |
| Thông báo | **7 ngày trước xóa**; deadline mới ngắn hơn thì báo sớm nhất có thể, không dời expiry |
| Gia hạn | Tenant Admin hợp lệ, lý do và thời hạn rõ ràng |
| Audit đã che dữ liệu | **365 ngày** |
| Không làm mới activity | View, note thường, assignment, status/reopen hoặc retry |
| Substantive activity | Giữ định nghĩa liên hệ thực tế của S05; `Contacted` riêng vẫn yêu cầu trao đổi hai chiều |

**Các lựa chọn đề xuất cần review**

| Mã | Đề xuất | Trade-off |
|---|---|---|
| **S06-D01 — Gia hạn** | Chỉ gia hạn lead chưa hết hạn; yêu cầu version, operation ID, lý do, expiry mới và reauth bằng mật khẩu trong 5 phút | Không cho gia hạn biến thành cách phục hồi dữ liệu đã hết hạn |
| **S06-D02 — Deadline hiệu lực** | Tách deadline nền theo D4/S05 khỏi expiry gia hạn. Deadline hiệu lực lấy hạn muộn hơn của hai giá trị hợp lệ; status/reopen không tự tạo gia hạn | Tránh contact/close ghi đè mất một gia hạn đã cấp rõ ràng |
| **S06-D03 — Người nhận notice** | Gửi notice cho mọi Tenant Admin hiện hợp lệ có quyền đọc tenant, kể cả tenant suspended; không phụ thuộc assignee hoặc recipient settings của email intake | Nhiều người nhận hơn, nhưng cảnh báo xóa không bị mất vì cấu hình thông báo tiếp nhận lead |
| **S06-D04 — UI hết hạn** | Khi dữ liệu đang hiển thị hết hạn, xóa dữ liệu khỏi UI rồi tải lại phần còn hợp lệ; không giữ input riêng tư của lead đã hết hạn vì dirty guard | Ưu tiên deadline truy cập; người dùng được giải thích rõ vì sao nội dung đang soạn bị đóng |

Không tự đặt thời hạn gia hạn tối đa mới. Expiry phải hữu hạn, hợp lệ và được người thao tác chọn rõ. Không tự quyết định retention của backup hoặc tenant deletion.

**Tasks theo vertical slice**

| Task | Kết quả xuyên các lớp | Phụ thuộc và kiểm chứng |
|---|---|---|
| **S06-T01 — Contract và đồ thị xóa** | Xác định normal/effective expiry, extension, notice revision, deletion graph, audit expiry và lock order | API/Data sở hữu contract; liệt kê mọi nơi giữ contact/message/note/command |
| **S06-T02 — Luồng đại diện gia hạn** | Lead detail → form lý do/hạn mới → API → transaction → deadline/history → reload A1/A2 | Version/reauth/CSRF; replay một lần; conflict giữ input; đối chiếu desktop/mobile |
| **S06-T03 — Notice trước xóa** | Scheduler tìm lead đến mốc → durable intent → recipient eligibility → local capture → trạng thái delivery | Chống gửi trùng theo deadline revision; job cũ phải kiểm lại deadline |
| **S06-T04 — Hết hạn trên mọi đường đọc** | API/RLS/detail/history/list/count/badge/UI cùng dùng deadline hiệu lực | Bổ sung timing contract cho list/count nếu cần; selected và unselected expired rows đều được xử lý |
| **S06-T05 — Xóa thực dữ liệu** | Worker claim lead đến hạn → khóa/kiểm lại → xóa toàn bộ dữ liệu phụ thuộc → lưu chứng cứ tối thiểu → completion | Rollback khi lỗi giữa transaction; retry không tạo kết quả xóa giả |
| **S06-T06 — Audit 365 ngày** | Xóa audit authenticated/anonymous/system đến hạn bằng quyền kỹ thuật hẹp | Không giữ lại nội dung riêng tư dưới tên audit; không tái tạo payload đã xóa trong log purge |
| **S06-T07 — Race và recovery** | Contact/reopen/extension/delete, hai workers, stale claim, mất response, worker restart | Dùng barrier và DB thật; kết quả tuần tự hóa rõ ràng, không “check rồi ghi” ngoài transaction |
| **S06-T08 — UAT và bàn giao** | Luồng notice → extension → deadline mới → expiry → deletion; đóng browser expiry gap của S05 | Evidence theo từng tiêu chí; runbook và cách quan sát lỗi worker |

**Migrations, backfill và bảo toàn**

- Chỉ forward migration mới; giữ nguyên **0001–0014** và checksum đã áp dụng.
- Backfill deadline nền từ giá trị S05 hiện có, không tính lại từ creation và không tự gia hạn dữ liệu cũ.
- Thêm extension metadata/receipts, notice jobs, deletion decisions và indexes phục vụ due scan.
- Tách audit đã che dữ liệu khỏi khóa ngoại buộc lead phải tồn tại.
- Xóa theo đồ thị: lead, contact/note/history payload, operation receipt chứa command và các bản ghi phụ thuộc cần thiết.
- Giữ chứng cứ xóa tối thiểu để chặn hồi sinh; không giữ contact/message trong chứng cứ đó.
- Audit expiry tính từ thời điểm event, không bắt đầu lại 365 ngày từ migration.
- Technical worker role chỉ được gọi các hàm retention đã allowlist. Không cấp arbitrary private-table DML cho worker.

**Phục hồi:** trước commit, lỗi phải rollback toàn transaction. Sau commit xóa thực, không hứa rollback dữ liệu; sửa bằng roll-forward. Mọi kiểm chứng xóa chỉ chạy trên tài nguyên thử được cấp quyền rõ ràng.

Thời hạn của bằng chứng chống hồi sinh và tương tác với backup lâu đời vẫn là **Unknown thuộc D5 trước live restore**; không tự chọn một retention period mới trong M2.

**Tiêu chí nghiệm thu S06**

1. Các ví dụ D4 đúng: creation ngày 0, liên hệ thực tế ngày 150 → open deadline ngày 330; close ngày 160 → deadline ngày 250. View/note/reopen không tự kéo dài.
2. Notice đúng mốc và deadline revision. Notice thất bại không dời expiry; không có recipient thì trạng thái lỗi/block rõ ràng.
3. Gia hạn hợp lệ cập nhật nguyên tử. Cùng operation replay một lần; khác payload/stale version bị từ chối.
4. Tại expiry, API, RLS, history, count, commands và worker không tiếp tục cấp quyền truy cập.
5. Browser xóa dữ liệu hết hạn khỏi các vùng liên quan; late response không tái điền dữ liệu.
6. Sau deletion commit, truy vấn bằng quyền kiểm chứng phù hợp xác nhận contact/message/note/command đã thực sự biến mất. Audit còn lại không chứa nội dung đó.
7. Audit đến 365 ngày được xóa. Worker chết, retry, stale lease và lỗi DB không tạo trạng thái thành công giả.
8. Race được quyết định tại thời điểm kiểm tra có khóa: nếu gia hạn/contact hợp lệ thắng trước expiry, deletion phải đọc lại; nếu expiry/deletion thắng, lệnh muộn không phục hồi lead.

Tái sử dụng logic kiểm thử activity, expiry, quyền và replay của S05; kiểm mới toàn bộ extension/notice/deletion/audit và UI expiry. **AC-11 là tiêu chí đóng chính**, cùng phần quyền/UI/runtime liên quan.

---

**4. S07 — Upload ảnh hợp lệ và thu hồi quyền truy cập**

**Mục tiêu:** Tenant Admin upload ảnh, biết ảnh đang xử lý hay bị từ chối, dùng ảnh đã hợp lệ trong nội dung và thu hồi quyền truy cập công khai một cách có kiểm chứng.

**Hiện trạng đã xác minh**

Repo có AWS S3 client và readiness probe local. Chưa có media module, upload endpoint, image decoder, permission model hoặc controlled derivative route. Service S03 hiện chưa có image reference.

Vì vậy, S07 cần giao một luồng thật từ upload đến public render; chỉ tạo media CRUD hoặc kiểm kết nối storage không đủ đóng slice.

**Phạm vi**

- Trong: JPEG/PNG/WebP **≤5 MiB**, private originals/quarantine, validation/processing, media library tối thiểu, private signed access, quyền công bố, derivative delivery, withdrawal và purge/retry.
- Ngoài: SVG, remote import, lead attachment, ảnh bệnh nhân thật, gallery/case/testimonial đầy đủ của S11, provider/CDN production và chính sách xóa originals dài hạn.

**Các lựa chọn đề xuất cần review**

| Mã | Đề xuất | Trade-off |
|---|---|---|
| **S07-D01 — Luồng đại diện** | Bổ sung **một ảnh đại diện tùy chọn cho dịch vụ VI hiện có**, chọn từ media library, có alt text; save/preview/publish theo S03 | Đủ chứng minh upload → publication → withdrawal mà không mở rộng sang builder hoặc gallery |
| **S07-D02 — Giới hạn decoder ban đầu** | Ảnh tĩnh một frame; tối đa **16 megapixels**, mỗi cạnh **8.192 px**; từ chối animated/multipage | Giới hạn tài nguyên rõ; có thể từ chối ảnh rất lớn dù file dưới 5 MiB |
| **S07-D03 — Xử lý an toàn** | Full decode/re-encode; xử lý orientation; loại EXIF/GPS/comment và metadata không cần thiết; derivative theo profile cố định, không upscale | Không phục vụ trực tiếp binary upload chưa xử lý |
| **S07-D04 — Delivery local** | Bucket/object private; private signed access đi qua gateway kiểm quyền hiện tại; public derivatives cũng qua controlled route. Ban đầu dùng no-store, chưa thêm Redis/CDN cache | Dễ chứng minh revocation; đổi lại chưa tối ưu cache |
| **S07-D05 — Permission** | Phân biệt ảnh thông thường và material có nguồn gốc bệnh nhân. Material loại sau phải có record chứng cứ/phạm vi quyền trước publish | S07 dựng contract; UI case/gallery cụ thể vẫn thuộc S11 |
| **S07-D06 — Khi ảnh bị thu hồi** | Với ảnh dịch vụ tùy chọn, trang tiếp tục phục vụ phần nội dung hợp lệ, bỏ toàn bộ media block đã thu hồi khỏi public response | Không để URL/alt/caption đã thu hồi rò qua JSON hoặc HTML |

Các giới hạn D02 là **đề xuất kỹ thuật**, chưa phải policy đã duyệt. Thư viện decoder và phiên bản chưa được chọn. Task đầu phải kiểm nguồn chính thức, Bun compatibility, native dependency và khả năng giới hạn tài nguyên trước khi pin.

**Tasks theo vertical slice**

| Task | Kết quả xuyên các lớp | Phụ thuộc và kiểm chứng |
|---|---|---|
| **S07-T01 — Spike giới hạn an toàn** | Chứng minh decoder chạy bằng Bun đã pin, storage private và cơ chế giới hạn CPU/time/memory | Điều kiện trước dependent processing work; không fallback Node âm thầm |
| **S07-T02 — Upload → trạng thái xử lý** | Media UI → bounded multipart/API → private quarantine → DB/job → UI processing/ready/rejected | Giới hạn byte khi nhận; MIME/extension chỉ là tín hiệu, không thay full decode |
| **S07-T03 — Derivatives hợp lệ** | Worker decode/re-encode → private derivative objects → metadata → media picker | Pixel/frame/decompression/metadata checks; không đánh dấu ready trước khi DB/storage nhất quán |
| **S07-T04 — Private signed access** | Admin yêu cầu → current authorization → token ≤60 giây → gateway kiểm lại | Bind tenant/asset/variant/purpose/revision/expiry; không lộ permanent original URL |
| **S07-T05 — Ảnh trên dịch vụ** | Picker → draft reference → private preview → explicit publish → immutable reference → public render | Chặn ảnh tenant khác/chưa ready/chưa có quyền; draft change không đổi ảnh live |
| **S07-T06 — Permission và withdrawal** | Ghi scope/evidence → eligibility → withdraw → generation/revision mới → chặn delivery → UI trạng thái | Thu hồi phải thắng snapshot/history/job cũ; không chờ purge mới deny |
| **S07-T07 — Purge và lỗi** | Durable purge job → xóa derivative/controlled cache targets thực sự tồn tại → receipt pending/failed/retry | Retry hữu hạn, quan sát được; storage failure giữ denial |
| **S07-T08 — Races và UAT** | Withdrawal đối đầu processing/publish/read/purge; hai workers; crash giữa upload/DB/object write | Không orphan public object, không stale regrant; chứng minh các mốc D4 bằng timestamps |

**Contracts và dữ liệu dự kiến**

- Asset: tenant, opaque ID, detected type, size, dimensions, checksum, processing state, version/generation.
- Derivative: asset revision, profile và object identity bất biến.
- Permission evidence: actor, thời điểm, scope, chứng cứ tham chiếu riêng tư và revocation.
- Jobs/receipts: processing và purge tách khỏi trạng thái `Draft/Published`.
- Service image reference là ID/revision thuộc cùng tenant; không nhận URL object tùy ý.
- Snapshot pin derivative/reference đã dùng, nhưng current eligibility luôn được kiểm khi đọc.

Object keys không dùng filename hoặc dữ liệu khách làm định danh. Credentials storage không được cấp cho browser/public website. Worker media có quyền riêng, không tái sử dụng auth hoặc migration credential.

**Migrations/backfill/fixtures và phục hồi**

- Thêm bảng media/permission/job; thêm image reference tùy chọn và phiên bản schema tương thích.
- Các publication S03 cũ vẫn đọc được nguyên trạng; không viết lại closure cũ để thêm ảnh.
- Fixtures gồm JPEG/PNG/WebP hợp lệ, đúng/vượt 5 MiB, sai nội dung, truncated, oversized dimensions, animated và metadata mẫu. Chỉ dùng ảnh tổng hợp.
- Dùng bucket hoặc namespace thử riêng; không sửa quyền rộng của tài nguyên storage đang giữ dữ liệu cũ.
- Retry upload/processing cùng operation không tạo asset hoặc derivative trùng.
- Crash sau object write nhưng trước DB commit phải có reconcile cho object thuộc run thử; không quét xóa storage chung.
- Withdrawal không đồng nghĩa tự động xóa private original. Purge ở đây xử lý các đầu ra delivery/cache đã xác định; original retention vẫn chưa được chọn.

**Tiêu chí nghiệm thu S07**

1. Chấp nhận đúng ba định dạng và boundary 5 MiB; từ chối SVG, remote import, malformed content, frame/pixel/decompression vượt giới hạn.
2. Originals/quarantine không public; anonymous, Platform-only hoặc tenant khác không đọc được.
3. Derivative được decode/re-encode và loại metadata theo contract. Decode timeout/memory failure không làm asset thành ready.
4. Signed access có TTL **≤60 giây**; token hết hạn, sai scope hoặc quyền đã mất bị từ chối.
5. Publish chỉ dùng ảnh ready/có quyền; public renderer không đọc mutable draft hoặc arbitrary storage URL.
6. Withdrawal ghi nhận thời điểm **T0** và block eligibility ngay. Mọi đường delivery dưới quyền kiểm soát dừng **≤60 giây**.
7. Purge target **≤5 phút**, có receipt cho target thực tế. Lỗi phải hiển thị `failed/retry`; không báo purge hoàn tất khi storage lỗi.
8. Job xử lý/publish/retry cũ không tái cấp quyền. History/restore không làm ảnh bị thu hồi xuất hiện lại.
9. Kiểm mọi image route thực sự được thêm, gồm thumbnail/optimizer nếu sử dụng. Không dựng cache giả chỉ để báo purge PASS.

S07 đóng phần media nền tảng của **AC-03/10/12**. S11 vẫn phải kiểm chứng permission theo nghiệp vụ case/gallery/testimonial; S07 không tự đóng toàn bộ các luồng đó.

---

**5. S08 — Lịch sử biên tập, khôi phục và ngừng xuất bản**

**Mục tiêu:** quản trị viên thấy rõ draft/live/history, khôi phục nội dung cũ thành draft, ngừng xuất bản và xuất bản lại mà không mất lịch sử hoặc ghi đè công việc của người khác.

**Hiện trạng đã xác minh**

S03 đã có:

- Expected draft/site/publication versions.
- Pending draft không đổi live.
- Immutable publication snapshot, active pointer và durable intent.
- Private preview; public SSR no-store.
- Kiểm chứng publication atomicity, retry và conflict.

Chưa có API/UI đầy đủ cho history/restore/unpublish.

Một điểm cần thiết kế rõ: `publicationVersion` hiện được đọc từ active pointer, mặc định 0 khi không có pointer. S08 phải giữ số phiên bản tăng liên tục sau unpublish, đồng thời tách “đã từng xuất bản” khỏi “đang public”. Đây là yêu cầu thiết kế từ source inspection, chưa phải kết luận lỗi runtime.

**Các lựa chọn đề xuất cần review**

| Mã | Đề xuất | Trade-off |
|---|---|---|
| **S08-D01 — Phạm vi history** | Lưu history cho service VI và site fields hiện có như tên/footer; thêm các content types sau khi chúng xuất hiện ở slice tương ứng | Hoàn chỉnh năng lực đang tồn tại, không dựng trước toàn bộ catalog S09–S15 |
| **S08-D02 — Restore** | Restore từng resource thành draft mới, tăng draft version và ghi nguồn phục hồi; không đổi active pointer | Người dùng phải explicit publish, tránh khôi phục đồng nghĩa xuất bản |
| **S08-D03 — Revision** | Có publication head/revision độc lập active snapshot; unpublish thay head state/revision nhưng không xóa history hoặc reset số phiên bản | Thêm metadata nhưng xử lý đúng publish lại, conflicts và stale jobs |
| **S08-D04 — Unpublish** | Xác nhận nêu đúng tenant/resource/current revision; current permission, CSRF và reauth bằng mật khẩu trong 5 phút | Bảo vệ hành động ảnh hưởng website, không thêm reviewer gate |

Restore không phục hồi tenant/domain mappings, slug lock, permission-to-publish hoặc quyền tài khoản từ lịch sử. Nếu khôi phục site fields, kết quả cũng chỉ là site draft; không âm thầm thay các trang đang live.

**Tasks theo vertical slice**

| Task | Kết quả xuyên các lớp | Phụ thuộc và kiểm chứng |
|---|---|---|
| **S08-T01 — History/head contract** | Resource revisions, current active publication, operation receipt, event ordering và cursor | Publishing owner sở hữu; thống nhất reference contract với Media |
| **S08-T02 — Xem lịch sử thật** | Editor → history list có phân trang → chi tiết phiên bản → so sánh draft/live/history | API/RLS thật; không dùng audit log thay nội dung version |
| **S08-T03 — Restore → draft** | Chọn history → xác nhận → API transaction → draft version mới → preview | Expected current version; idempotent retry; live byte/content identity chưa đổi |
| **S08-T04 — Unpublish** | Editor → xác nhận → atomically remove eligibility/pointer + event/receipt → public unavailable | History giữ nguyên; new intake trên form cũ bị từ chối theo S04 |
| **S08-T05 — Publish lại** | Draft sau restore/unpublish → explicit publish → snapshot mới, số phiên bản tiếp tục tăng | Retry publication cũ không được tự tái gắn pointer |
| **S08-T06 — Hai admin và UI input** | A1/A2 save/restore/publish/unpublish cạnh tranh; compare/cancel/reload | Một version thắng; không lost update; dirty navigation và late responses an toàn |
| **S08-T07 — Reference/job races** | Media withdrawal, site draft change, stale publication job và cache invalidation | Cùng hợp đồng current eligibility; job chỉ xử lý side effect, không tự quyết định public state |
| **S08-T08 — UAT và bàn giao** | Pending draft → history → restore → preview → explicit publish → unpublish → publish lại | Browser thật desktop/mobile, API/PG và anonymous SSR |

**Migrations/backfill và bảo toàn**

- Giữ nguyên snapshot và intent S03 đã lưu.
- Thêm revision history, publication head, operation receipts và delivery events cần cho unpublish.
- Backfill head từ active pointer và publication history hiện có.
- Với draft cũ, chỉ ghi baseline hiện có. **Không thể dựng lại các draft đã bị ghi đè trước khi history được triển khai**; không gán tác giả/thời điểm lịch sử giả.
- Không xóa snapshot chỉ vì unpublish: lead nguồn S04 còn tham chiếu publication đó.
- Không tự đưa các intent lịch sử vào worker backlog.
- Rollback trước commit phải giữ cả draft/head/event nhất quán. Sau commit dùng receipt/replay hoặc roll-forward, không viết lại immutable snapshot.

**Tiêu chí nghiệm thu S08**

1. Save V2 khi V1 live: anonymous vẫn thấy V1; history và pending indicator mô tả đúng.
2. Restore V1 tạo draft version mới; live vẫn giữ nguyên cho đến explicit publish.
3. Unpublish đưa logical state về Draft; direct public route không còn phục vụ nội dung, không redirect sang homepage hoặc draft.
4. Publish lại tạo snapshot/version mới; retry publish cũ không đảo ngược unpublish.
5. Hai admin dùng cùng expected version chỉ một thao tác thắng; phía thua giữ input và được xem bản mới.
6. Khôi phục snapshot chứa ảnh đã thu hồi không cấp lại permission hoặc delivery. Publish kiểm eligibility hiện tại.
7. Site draft/reference edits không đổi closure đang public; snapshot cũ vẫn bất biến.
8. Precommit fault, mất response sau commit và worker restart không tạo publication/event trùng.
9. Lead đã nhận giữ nguyên source snapshot. Retry ACK hợp lệ trong 24 giờ vẫn theo hợp đồng S04 sau unpublish; new intake không dùng publication đã ngừng.
10. Public no-store hiện tại được giữ. Chỉ kiểm cache thực sự dùng; không thêm Redis cache để làm đầy checklist.

Tái sử dụng bằng chứng và test logic S03 về snapshots, private preview, atomicity và conflicts. Kiểm mới history, restore, unpublish, revision monotonicity và các giao điểm S07/S04. Đóng phạm vi **AC-02/12 của các resource hiện có**, không tuyên bố hoàn tất builder/localization/domain.

---

**6. Ownership và effort đề xuất**

Các owner dưới đây là phân công đề xuất, chưa dispatch hoặc cấp quyền ghi.

| Owner | Phạm vi trách nhiệm | Effort |
|---|---|---|
| **Desktop Coordinator** | Contracts liên module, migration order, root/runtime/lockfile, tích hợp và hồ sơ chung | **xHigh** cho thiết kế/tích hợp nhạy cảm M2 |
| **Leads/Data/Retention owner** | S06 API, SQL, extension, notice/delete/audit workers; tác động vào S05 | **xHigh** |
| **Media owner** | S07 upload, processing, storage, permission, signed/current delivery và purge | **xHigh** |
| **Publishing owner** | S08 history/restore/unpublish/head; publication/reference integration | **xHigh** |
| **FE owner** | Lead retention UI, media UI/picker và editor/history; shared API/error/dirty handling | **xHigh** do tham gia workflow quyền và dữ liệu |
| **Independent QA/Security reviewer** | Review deletion graph, least privilege, races, media bypass và public revocation | **xHigh**, không sửa ứng dụng |
| **Settled documentation writer** | Ghi quyết định/kết quả đã chốt khi được phép | **Medium** |

Không cần chạy đồng thời tất cả các vai trò. Một người/agent có thể đảm nhiệm tuần tự nhiều phạm vi.

Một writer cho mỗi migration/shared contract. Media và Publishing không cùng sửa editor hoặc publication schema khi chưa chia ownership cụ thể. Reviewer được dùng cho câu hỏi rủi ro có căn cứ, không thêm một vòng phê duyệt cho mỗi task.

Lượt khảo sát hiện tại do phiên chính thực hiện; chưa có independent reviewer mới.

---

**7. Kế hoạch UAT tự động local**

**Tài nguyên thử**

- Tài nguyên mới có manifest ownership rõ: hai tenant thử, hai admin chung tenant, actor tenant khác và Platform-only; giữ tài khoản/password hiện có.
- Database/schema hoặc tập fixture được cô lập theo run; media bucket/namespace riêng.
- Worker chỉ xử lý explicit allowlist của run M2.
- Không drain pending intents S04/S05 hoặc publication backlog cũ.
- Before/after preservation cho business data, credentials, migrations, mockup pins và evidence lịch sử.
- Local capture riêng: directory `0700`, files `0600`; không gửi email thật.

**Kiểm thử thời gian**

- Unit tests dùng clock được truyền vào logic thuần.
- Integration/browser dùng timestamp trên **fixture mới được sở hữu** hoặc test clock nội bộ của harness.
- Không đổi system clock, không thêm HTTP backdate endpoint, không chỉnh dữ liệu cũ.
- Các mốc 180/90/30/7/365 ngày được dựng có kiểm soát; không yêu cầu chờ nhiều ngày.
- Signed access/withdrawal/purge đo bằng timestamps và polling hữu hạn. Timer hết hạn không tự chứng minh I/O đã dừng.

**Ba hành trình tích hợp cần chứng minh**

| Hành trình | Kết quả quan sát |
|---|---|
| **Lead** | Intake thật → xử lý S05 → notice → extension → expiry → browser clearing → physical deletion → audit expiry |
| **Media** | Upload → private processing → chọn ảnh → save/preview/publish → anonymous render → withdraw → delivery denial → purge/retry |
| **Editorial** | Live V1 + pending V2 → history → restore thành draft → explicit publish V3 → unpublish → publish lại; race với admin khác và media withdrawal |

**UI**

- Mỗi capability có một màn hình đại diện nối dữ liệu thật trước khi mở rộng UI phụ thuộc.
- So sánh với mockup tại cùng viewport/state; giữ navigation, editor actions, lead list/detail và Lucide.
- Kiểm tại **320/390/768/1024/1440 px** theo phạm vi từng màn hình.
- Kiểm populated/empty/loading/error/denied/conflict, keyboard/focus, dialog và controls trong container.
- Dùng browser context biệt lập và cơ chế auth bình thường; không đọc profile/cookies để vượt login.
- Không mặc định giao thao tác thủ công cho Khiêm. Nếu harness bị chặn, báo đúng tiêu chí chưa chứng minh và bước chẩn đoán hữu hạn.

**Tests và commands**

Tái sử dụng logic từ `s03-publication-integration`, `s05-lead-integration`, `s05-races-integration` và `s05-worker-integration` theo phần thay đổi. Thêm suites S06/S07/S08 và runner có output M2 riêng.

Các runner S03/S05 hiện ghi vào evidence cũ. **Không chạy chúng nguyên trạng để ghi đè lịch sử**; runner M2 phải giữ output mới và provenance rõ.

Các lệnh root đã tồn tại để dùng sau khi được duyệt:

```text
./node_modules/.bin/bun run build
./node_modules/.bin/bun run typecheck
./node_modules/.bin/bun run lint
```

Build và typecheck chạy tuần tự ở mốc tích hợp để tránh lặp lỗi generated Next types từng ghi nhận. Alias `test:s06/s07/s08` là phần **dự kiến tạo**, hiện chưa được coi là command đã có hoặc đã kiểm chứng.

---

**8. Điều kiện đóng slice và toàn Chặng 2**

Mỗi slice chỉ được báo **Verified local** khi:

- Luồng thật và các tiêu chí bắt buộc của slice có bằng chứng.
- Quyền/tenant, concurrency, retry, worker/storage faults liên quan đã được kiểm.
- UI đại diện và các trạng thái cần thiết đạt yêu cầu.
- Migration/preservation và các regression bị tác động đã đạt.
- Findings chặn đã đóng; `FAIL/NOT_RUN` còn lại có phạm vi và ảnh hưởng rõ.
- Task record/runbook/current pointers được cập nhật khi có quyền ghi.

Toàn M2 đạt technical closure khi S05 tiếp tục hợp lệ, S06–S08 đạt phạm vi trên và ba hành trình tích hợp đã được chứng minh. **Nghiệm thu M2 vẫn là quyết định riêng của Khiêm.**

`braces` tiếp tục **FAIL/open** theo local deferral; đánh giá lại ngày **22/10/2026** hoặc sớm hơn khi dependency/exposure thay đổi và trước production. Việc thêm decoder ở S07 đòi hỏi đánh giá lại dependency/exposure liên quan; không tự nâng dependency hoặc kế thừa waiver cũ như một audit PASS.

**Phần cần review trước:** S06-D01–D04, S07-D01–D06 và S08-D01–D04, đặc biệt người nhận retention notice, semantics gia hạn và luồng ảnh đại diện dịch vụ.

Kế hoạch này chưa cấp quyền lưu hoặc execution. Quyền triển khai sau này cần ghi rõ local dependencies, forward migrations/backfill, tài nguyên thử, worker/storage/capture và phép thử xóa **chỉ dữ liệu thử được sở hữu**. Git delivery, deploy và production vẫn là phạm vi riêng.

## Execution ledger

Plan saved before dependent application writes. Actual assignments, results, failures, limits and handoff will be appended here.

### Initial bounded ownership — 2026-10-16

Root owns app.ts/database runtime integration, shared root/package/lock/scripts, S08 backend (`publication.service.ts`, `publication.module.ts`, contracts/s03.ts/content.ts, migration0017), website public consumer/renderer and all shared documents. S06 implementer owns migration0015, contracts/s06.ts and additive s05.ts lead timing/retention fields, modules/retention*, worker/retention*, tests/s06*, and required bounded leads.service.ts changes. S07 implementer owns migration0016, contracts/s07.ts, modules/media*, media/**, worker/media*, tests/s07*, plus scoped technical scripts/s07*; no dependency/package/lock writes. FE implementer owns apps/admin/** except shared API root contracts, and docs/evidence/m2/ui/**; consumes API contracts, does not edit them. Exact native tasks/runtime metadata follow dispatch. All sensitive tasks xhigh; one writer per migration; no apply/bootstrap/fixtures by children before root preservation/preflight and explicit integration go-ahead. No child delegation. Children are not alone and must preserve each other's edits.

### Runtime integration checkpoint — 2026-10-16

Current root approval turn01a14384-f13c-7583-bdcb-f67dd95ee667 observed gpt-6.1-sol/xhigh; native S06/S07/FE/reviewer role/parent/model/effort checks PASS. Root baseline captured817tracked files and180private files, readonly DB31tables/124941rows/3credential invariants before application writes. Baseline files are private; no customer data or credentials copied into evidence. Existing app/services and historical evidence preserved.

Source-complete plan saved before application writes. New migrations0015–0022 applied transactionally with retained checksums verified; applied files remain immutable. No startup dispatch. New S06/S07 worker identities and positive fixture scopes; original credentials unchanged. Sharp0.35.5 added as exact direct API dependency, local Bun1.4.3 unchanged. Minimal Docker context excludes private configuration and evidence.

Actual Docker decoder accepted JPEG/PNG/WebP and rejected malformed/edge/pixel inputs. Resource probe verified384MiB hard memory+swap limit,1CPU,pids64,network none, readonly,nonroot/no mounts; actual OOM exit137 and bounded timeout kill observed. Wrapper lifecycle regression and final image/exposure review remain pending.

S08 actual runner PASS: input2tests7assertions, API/SQL11tests276assertions. This proves its scoped local API/SQL cases, not browser or human acceptance. Initial S06 run failed service creation because SQLNULL was serialized as JSONnull; repaired API binding. Focused D4 contact180 case then PASS1test28assertions. Full S06 subsequently3PASS/8FAIL: grouped root causes were inherited HTTP headers lost after commit, claim timestamp preceding newly inserted job availability, and fixture violating the last-admin guard. Explicit field forwarding has RED→GREEN1test3assertions; forward0021refreshes claim timestamp; fixture now changes only new owned accounts while preserving the guard. Full rerun pending. Historical failures retained in private logs/new M2 evidence.

Independent review found strict SQL version validation, current media authorization/public eligibility, same-version history bypass, delayed FE response privacy and Docker settlement issues. Repairs recorded in0018–0020and source; final closure pending actual reruns.0022adds narrow current-publication public-cover metadata contract; no ambient public tenant RLS bypass.

Storage scoped object read/write, cross-bucket403and unsigned403were observed. Bootstrap failed on an incorrect ListBuckets assumption and later HeadBucket500; bounded helper repair now uses owned private marker verification. No static config/old identity/container restart. Final helper result pending.

### Actual journey and regression checkpoint — 2026-10-16

S06 final actual API/SQL12tests/236assertions PASS, plus input3/18,capture2/9,service2/19 and worker-environment1/3. S07 final actual API/storage/worker15tests/321assertions PASS, security/recovery filesystem7/73, native decoder8/39, actual Docker lifecycle4/20 and worker environment1/3. S08 final API/SQL12tests/295assertions and input2/7 PASS. Latest per-slice JSON files retain prior failures separately. S05 affected regression: input6/97,capture2/10,environment1/3,lead9/153,worker8/162 and races7/119 PASS across dated M2 files. Old expiry-only fixture updates were no longer valid after the S06 deadline invariant; new owned fixtures now age creation/consent/activity consistently and preserve the404 assertions. Old S03 integration runner was not executed because it writes an accepted existing fixture site; new S08/S07 cases cover the affected publication contracts with new resources.

Two S05/S07 beforeAll attempts failed after sign-in200 with absent strict fixture session. No product AUTH or helper retry/bypass was added. Root bounded redacted actual HTTP A1/A2 diagnostic later found raw+strict sessions valid, no future timestamps; isolated suites then passed all cases. The intermittent setup cause remains Unknown; historical failures are retained, not rewritten as PASS.

Observed live-compare500 was SQL42P18 from a parameter with no text type inside jsonb_build_object. Source fixed with explicittext cast; actual direct RED→GREEN and active-live API regression PASS. Observed second-administrator publish403 was SQL42501/RLS on site_draft when metadata-only routing lock rewrote a site last saved by another actor. Source now skips already locked rows and records the current actor only for a new lock. Different-publisher API and actual browser publication PASS; current rights/RLS remain enabled.

New UI manifest owns two tenants/three initial leads, no S05 worker enrollment. Retained A1 accumulated more than100synthetic memberships, so its existing session response excluded the new UI tenant. Three new verified synthetic browser accounts were provisioned privately for A1/A2/B1 roles; old credentials/accounts and AUTH membership limit were not changed. A separate new privacy lead was later added with unique payload and90second controlled deadline; the first attempted insert rolled back for incomplete intake closure, then the complete lead/intent/receipt/audit transaction passed without disabling constraints. The earlier expired lead remains unchanged.

Authenticated isolated sandboxed Chrome: S06 extension/Enter PASS; S08 private preview/history/restore→draft with byte-identical live SSR/explicit publish/unpublish404/monotonic republish/two-admin conflict+input preservation/dirty cancel+discard/site restore PASS. S07 SVG client rejection,3real uploads, actual worker3claimed/3completed(two ready/one rejected), patient permission, cover picker/save/private decoded preview/anonymous decoded SSR, publication, withdrawal/current delivery denial/public block+alt redaction PASS; actual scoped CLI purge1claimed/1completed. Worker launch key allowlist and entry guard exclude API/auth/migration/original S3 credentials; no secret values printed.

Actual privacy deadline PASS: dirty modal closed, expired selected row and unsaved input removed, held real history response delivered after expiry and not applied. Controlled503outage remained until focusedRetry+Enter caused exactlyone fresh eligible GET. The first privacy assertion used a shared fixture message and failed when another valid lead displayed that same message; safe DOM showed the expired identity absent. A fresh uniquely identified lead and stronger name/code/phone assertions then PASS. No product privacy guard was weakened.

Final stable rendered checks PASS across lead/editor/media at320/390/768/1024/1440; matched baseline capture heights844mobile/1050desktop. Earlier immediate-resize screenshots captured sidebar transition and were insufficient for fidelity; the harness now waits for hidden/inert closed sidebar before geometry/capture. FE visual review is recorded separately. Additional state/failed-purge retry browser checks remain in progress.

Readonly preservation checkpoint PASS: all31pre-M2 tables' retained row hashes projected on original columns;3credential invariant tables; old private files; historical evidence, skills and design pins. Only expected launcher process metadata changes and the original live runtime log append were admitted; the original552byte prefix hash is preserved. This is not backup/restore proof. Root final effort metadata PASSgpt-6.1-sol/xhigh; the initial diagnostic using an invalid risk label was rejected before the valid final-audit matrix selector passed.

### Final local handoff — 2026-10-16

**Result:** CODE_INTEGRATED + VERIFIED_LOCAL + READY_FOR_USER_REVIEW for approved M2 v0.1/S06–S08. Human M2 acceptance remains pending. S01–S05/AUTH/M1 retain their existing acceptance and proof limits. S09–S18 are unapproved. No stage, commit, push or deploy was performed.

**Delivered behavior and traceability**

| Approved scope | Implemented result | Actual local proof |
| --- | --- | --- |
| S06-D01–D04 | D4 normal/effective expiry; explicit reasoned/versioned/replay-safe extension; all eligible-admin generic notices; request-start privacy deadlines; atomic private-graph deletion, stale-restore denial and audit365 | S06 API/SQL12tests/236assertions; input/capture/service7/46; actual notice/delete CLI journey, controlled browser expiry/delayed response and password-only reauthentication |
| S07-D01–D06 | Validated private upload/full isolated decode, metadata-stripped derivatives, patient permission, service cover, current signed/public eligibility, withdrawal and observable purge/retry, strict native settlement and recovery mapping | S07 actual API/storage/worker15/321; security7/73; native decoder8/39; Docker lifecycle4/20; shared environment1/3; real upload→preview→publish→withdraw→failed purge→retry→purge browser/CLI journey |
| S08-D01–D04 | Immutable service/site revisions; restore to new draft; current live comparison; monotonic publication head; explicit unpublish/republish; current media rights and single-snapshot public contract | S08 API/SQL12/295 and input2/7; authenticated two-admin conflict and complete editorial browser journey; current anonymous SSR checks |

The three API/SQL suites total39tests/852assertions. Separate admin suite51tests/168assertions PASS. These counts do not include browser scripts or independent review and are not a full-MVP claim. Final per-slice artifacts: [S06](../evidence/m2/s06-checks-1792136411794.json), [S07](../evidence/m2/s07-checks-1792137448381.json), [S08](../evidence/m2/s08-checks-1792137528582.json). S05 affected regression suites pass across their dated M2 artifacts; the earlier combined runner failure remains historical.

**Integrated journeys and interface**

[Lead journey](../evidence/m2/lead-journey.json) proves one actual public intake, password/CSRF-backed S05 assignment/note/two-way contact, controlled owned-row notice window, four generic private captures for all eligible administrators, explicit extension, expiry404 and actual restricted worker deletion with zero rows in ten private-graph tables. The first worker also deletes two already expired positively scoped M2 UI leads; no retained backlog is selected. Audit365 and stale-restore denial are separately proven by actual S06 integration cases. Browser expiry clearing is separately proven in [privacy evidence](../evidence/m2/ui/s06-privacy.json).

[Editorial](../evidence/m2/ui/s08-editorial.json) proves restore→draft without changing live SSR, explicit publish, unpublish404, monotonic republish, current-live comparison, site restore, version conflicts and input preservation. [Media](../evidence/m2/ui/s07-media.json) proves three real uploads, two ready/one rejected, real decoded private/anonymous images and withdrawal redaction. [Retry](../evidence/m2/ui/s07-media-retry.json) proves a bounded owned purge storage fault, failed state, focusedRetry+Enter, actual worker retry and completed purge without regranting rights.

[Final visual captures](../evidence/m2/ui/final-visual.json) cover lead/editor/media at320/390/768/1024/1440px. Rendered representative desktop/mobile comparison follows the pinned mockup layout; no exact pixel or exhaustive state identity is claimed. [Denied screen](../evidence/m2/ui/s06-denied-final.json) passes all five widths and tenant-choice Enter after the scoped long-name wrapping repair. [Actual reauthentication](../evidence/m2/ui/s06-password-reauth.json) proves403REAUTH_REQUIRED→normal password confirmation→preserved input→successful extension. All three newly owned controlled session timestamps were restored. The original representative artifact's hardcoded reauthentication flag was corrected to UNVERIFIED_IN_THIS_HISTORICAL_RUN with an original copy preserved; it is not auth proof. Earlier selector and assertion failures remain retained. [FE handoff](../evidence/m2/ui/frontend-handoff.md) closes the bounded FE findings.

**Runtime, migration and preservation**

Applied immutable forward migrations0015–0022/0024;0023 was reserved but not needed. Original0001–0014 and checksum records remain unchanged. Exact direct Sharp0.35.5 adds no new package version to the551-version baseline set. Actual decoder/container resource probes are [spike](../evidence/m2/decoder-spike.json) and [limits](../evidence/m2/decoder-resources.json); actual OOM termination and deadline kill are distinct from a caller timeout. New restricted S06/S07 database identities and new scoped storage identity do not replace old credentials. All fixture/resource manifests and recovery receipts stay private with mode0600; capture directory0700/files0600.

Final app build, full typecheck and lint exit0. Typecheck/lint were refreshed after the final harness edit. [Current diagnostics](../evidence/m2/final-diagnostics.json) pass eight health/readiness/input/auth/anonymousSSR probes against the final built local apps. Admin127.0.0.1:5891, API127.0.0.1:5890 and publiclocalhost:5892 were left running; this is a dated observation, not persistent availability. [Root effort metadata](../evidence/m2/root-final-runtime.json) and actual native role/parent/model/xhigh evidence pass. Exact normal commands and private prerequisites are in the [M2 runbook](../local-development.md#current-m2-local-operation).

Final readonly [preservation](../evidence/m2/preservation-1792138948113.json) passes all31pre-M2 tables,3credential invariant tables, old private files, protected historic evidence, skills and design pins. New columns are excluded from original-row projections. Only current launcher metadata and an append after the original live log's verified552byte prefix are admitted. The first final invocation selected the S02 owner configuration and failed the explicit gcms_local identity guard before querying; rerunning with the original .env identity passed. This is not backup/restore proof.

[Known-secret scan](../evidence/m2/knownsecret-scan.json) passes exact raw/JSON-escaped/URL-encoded values from known local credentials/configuration/fixtures/cookies/captures across nonignored repository text. Initial candidates were four public SHA256 values from preservation filename hash maps, not credentials; their origins were checked and the original candidate result retained. Only those two public-file hash maps were removed from candidate collection. This does not prove comprehensive discovery, runtime-memory or screenshot scanning.

The new lead-journey harness ran successfully before a cosmetic PATH constant rename. That rename accidentally changed the allowlist string too; independent final review found the source/evidence mismatch. The string was restored to PATH; current source differs from the executed source only by the manifest constant identifier. Original actual output remains unchanged. No second run or deletion of its exclusive manifest was used to manufacture proof.

**Review, residual results and limits**

Independent native xhigh [review](../evidence/m2/review.md) closes R1–R7 and the bounded final CSS refresh. The core38-file source pins remain unchanged after core closure. The final34Next traces have zero advisory-chain references; final trace manifest is recorded by the reviewer. Reviewer verification16tests/97assertions PASS is separate from root runtime proof.

- Audit remains **FAIL/open** for high braces GHSA-vfj7-8cjw-p6xm. Fresh independent local-M2 exposure assessment permits only the recorded bounded local deferral. Reassess2026-10-22 or earlier patch/dependency/exposure change and before production. No production waiver; the decoder image is not claimed to lack dev dependencies.
- Storage bootstrap proves real primary-bucket lifecycle, unsigned denial and cross-bucket scoped-request403. The separate owned control collection has no writable volume capacity; its object-write attempt failed500. No successful control-object write/read or added storage capacity is claimed. Existing container/configuration/capacity were preserved.
- Two earlier S05/S07 fixture beforeAll attempts produced sign-in200 without an admitted strict session. Later redacted A1/A2 HTTP diagnostics and isolated suites pass; the intermittent setup cause remains Unknown. No product AUTH retry/bypass or fixture helper weakening was introduced.
- Operational backup/restore, natural180/365day waiting, manual operator reconciliation/unblock of an unknown native settlement, production/external delivery/DNS/TLS and other browser engines remain **NOT_RUN**. Controlled time boundaries, durable fail-closed recovery mapping, actual Docker settlement and affected local flows have their separate proof.
- The old S03 mutating integration runner was **NOT_RUN** to preserve accepted existing fixtures and historical output. New S07/S08 fixtures verify the affected publication contracts. No full history exhaustion, exact pixel match, full-MVP or Production acceptance is claimed.

**Coordinator checklist and handoff:** approval/source-complete plan saved before writes; actor/invariants/contracts and positive fixture ownership retained; disjoint native ownership/effort verified; source and actual integration reviewed; required local journeys/states checked; failures and limits preserved; final preservation/static/secret checks recorded; current task/ADR/runbook/state pointers updated; latest no-Git/no-deploy boundary retained. No open bounded application finding remains. Khiêm owns the separate M2 acceptance decision. No further implementation or release action is implied.

Final [check summary](../evidence/m2/final-checks.json) pins16actual evidence files and records actual command results. Full typecheck/lint final refresh exit0; static package verifier PASS81maintained hashes/9adaptations/28mirror pairs/17skills/3native definitions/133Markdown/1504local links at that checkpoint. Git whitespace check passes, index remains empty, main HEAD and local origin/main ref remain06d729f30f532db5679b6dfd4de349e9875f4b77; no live remote fetch. Expected approved M2 work remains uncommitted. Final known-secret scan PASS257known values/337representations/719repository text files, zero matches. These are dated scoped observations, not universal security or runtime guarantees.


## Human M2 acceptance — 2026-10-16

**HUMAN_ACCEPTED — Verified human decision.** Khiêm directly stated on2026-10-16, Asia/Ho_Chi_Minh, in desktop thread `01a1437b-7cd2-7b23-92ef-70226da96f3f`, current acceptance turn `01a14424-fabd-7d43-8fa6-800dad9fc40c`:

> Nghiệm thu Chặng 2. Cập nhật hồ sơ và trạng thái M2, giữ nguyên các giới hạn kiểm chứng đã ghi nhận. Chưa commit/push/deploy.

Desktop `/root` verified the direct human source and assigned bounded settled acceptance writing. M2 is HUMAN_ACCEPTED within its approved local scope, including inherited S05 and newly implemented S06–S08. S05's prior acceptance remains unchanged. Technical status remains CODE_INTEGRATED + VERIFIED_LOCAL; READY_FOR_USER_REVIEW and acceptance-pending statements in earlier ledgers are historical checkpoints. The original `final-checks.json` acceptance-pending field is immutable historical evidence, not the current acceptance status. The master plan's18slice rows/five milestones remain unchanged. This acceptance is not full-MVP/Production acceptance or new implementation authority.

**Proof boundaries preserved.** All actual evidence, intermediate failures and Unknown/NOT_RUN limits in the final local handoff remain unchanged. In particular: audit high braces GHSA-vfj7-8cjw-p6xm remains FAIL/open under the existing fresh local-M2 deferral, reassess2026-10-22 or earlier patch/dependency/exposure change and before production; no production waiver. Operational backup/restore, natural180/365day waiting, manual operator reconciliation/unblock of unknown native settlement, production/external delivery/DNS/TLS and other browser engines remain NOT_RUN. The control collection object-write failed500 because it had no writable volume capacity; no control-object write/read or capacity change is claimed. The intermittent strict fixture-session admission cause remains Unknown despite later passing isolated checks. The old S03 mutating runner remains NOT_RUN to preserve accepted fixtures. No full history exhaustion, exact pixel identity or new runtime proof follows acceptance.

**Ownership and effort.** Accountable coordinator: desktop `/root` in the source thread. Bounded writer: `/root/m2_acceptance_record`, native kit-implementer thread `01a14425-d4a4-75b2-8fca-e81ff62a649a`, turn `01a14425-d519-7e83-87b6-d3e806c9303d`. Category agent-artifact-generation; required/requested/observed medium, inherited gpt-6.1-sol. Runtime helper PASS observed role kit-implementer, exact parent/source thread, model and medium at2026-10-16T09:58:15.445Z; parent independently verified native metadata and sent GO before writes. Root's xhigh coordinator observation is separate from this medium writer route. This is recorded runtime configuration, not a quality guarantee.

**Documentation scope and checks.** Only the assigned ten documentation/manifest paths were changed. AGENTS/README maintained hashes and appended project_changes provenance were refreshed; original Kit/mirror/adaptation pins and evidence bytes were preserved. Application/build/test/worker/browser/DB checks are NOT_RUN for this documentation-only update; existing technical results are reused without expansion. `python3 -B scripts/verify_agent_setup.py` — PASS, exit0:81maintained hashes,9adaptations,28mirror pairs,17skills per root,3native definitions per client,20original/6adapted upstream files,133Markdown files and1513local links/anchors. `git diff --check` — PASS, exit0. Both checks were rerun after the last documentation write; these are static integrity/whitespace checks only.

**Coordinator handoff.** Exact human source, current pointers, ownership and proof limits are recorded; historical plan/ledgers/evidence remain intact. Desktop `/root` retains final integration/accountability. S09–S18 execution remains unapproved. No commit/push/deploy or other release action is authorized or performed by this update. The user controls TechNote level progression; silence grants no approval.
