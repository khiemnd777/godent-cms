# GCMS-M3-001 — Approved M3 v0.1 local execution

**Current result — HUMAN_ACCEPTED — 2026-10-16.** Khiêm directly accepted local M3 S09–S12; [human acceptance](#human-m3-acceptance--2026-10-16) records the exact source and latest documentation-only authority. Technical CODE_INTEGRATED + VERIFIED_LOCAL and all proof limits in the [final handoff](#final-local-handoff--2026-10-16) remain unchanged. Original proposed/NOT_RUN/acceptance-pending checkpoints and final-checks.json are historical evidence. Audit braces remains FAIL/open under the fresh bounded local-M3 assessment, with no Production waiver. S01–S12/AUTH/M1/M2/M3 are HUMAN_ACCEPTED within recorded scopes. No commit/push/deploy or S13–S18 execution.

## Current authority and ownership

**APPROVED_EXECUTION_PLAN / PLAN_SAVED — 2026-10-16 Asia/Ho_Chi_Minh.** Khiêm directly approved in desktop thread `01a1442c-b412-7f63-b03f-b23c76825bf2`, turn `01a14435-f0f6-7321-bb97-a00bd03cc50f`:

> Duyệt M3 v0.1 và toàn bộ quyết định đã đề xuất. Lưu đầy đủ kế hoạch rồi triển khai S09–S12 trong phạm vi local, gồm dependencies, migrations, fixtures, worker/storage/capture và kiểm chứng. Chưa commit/push/deploy.

This accepts the complete plan and M3-D01–D06, S09-D01–D04, S10-D01–D05, S11-D01–D06 and S12-D01–D04. Desktop `/root` in this thread owns M3 coordination, canonical contracts, shared-record/root/runtime writes and final integration. Prior M2 accountability/evidence remains unchanged. The complete save precedes dependent application writes. Permitted: bounded local implementation, dependencies, additive migrations, new owned synthetic fixtures, worker/storage/capture and verification. Preserve existing data, credentials, resources, migrations/checksums, evidence and backlog. No real patient data, external providers/email, DNS/TLS, Production, paid/global configuration, existing-resource destruction/reset or Git commit/push/deploy. Latest instruction is this approval; no subsequent stop. S13–S18 execution remains unapproved.

M1/AUTH/S01–S08/M2 remain HUMAN_ACCEPTED within recorded local limits. M3 runtime/UAT starts NOT_RUN. Audit braces remains FAIL/open; no inherited M3 waiver. Reassess 2026-10-22 or earlier patch/dependency/exposure change and before Production. Operational backup/restore and historical Unknown/NOT_RUN are unchanged.

Coordinator category implementation/publication-integrity: required/requested/observed xhigh, inherited gpt-6.1-sol; current runtime helper PASS. Children require exact native Kit role/parent/model/xhigh verification before writes and cannot delegate. Metadata is coordination evidence only, never an application prerequisite.

## Source-complete approved plan

The complete reviewed assistant plan follows. Proposal/NOT_RUN labels below preserve its historical review checkpoint; the direct approval above settles decisions. Repository links are normalized only. Original SHA-256: `368acb94dd20c6a490bdd6f709e1eff70105f0802cbc46940583fa6f880df8cb`; source characters: 30795.

**Đề xuất M3 v0.1:** hoàn thành bốn hành trình nội dung S09–S12, từ quản trị trong CMS đến nội dung đã xuất bản trên website. Kế hoạch kế thừa M2 đã nghiệm thu và giữ nguyên 18 slices của GCMS-MASTER-PLAN-001 v0.2.

Toàn bộ nội dung dưới đây là **Proposed — đề xuất để review trong chat**. Chưa ghi file hoặc triển khai.

**Cơ sở đã xác minh**

- M2 đã **HUMAN_ACCEPTED** ngày 16/10/2026, gồm S05 kế thừa và S06–S08. Bằng chứng local và các giới hạn cũ được giữ nguyên.
- Đã có dịch vụ VI, xuất bản bằng snapshot bất biến, lịch sử/khôi phục/ngừng xuất bản, media riêng tư, kiểm tra quyền hiện tại và thu hồi ảnh.
- Code hiện tại còn tập trung vào **dịch vụ/site**. Không thể mặc định các loại nội dung M3 đã có đầy đủ vòng đời tương tự.
- Quyền ảnh hiện tại có phạm vi **`service_cover`**. Quyền này không tự bao phủ gallery, ca điều trị hoặc testimonial.
- Mockup v0.1+Lucide duyệt bốn màn hình đại diện và patterns chung. Màn hình chi tiết mới của M3 vẫn là phần thiết kế đề xuất.
- Runtime lượt hiện tại ghi nhận **xHigh — PASS**. Không chạy ứng dụng, Docker, migrations, tests hoặc UAT trong lượt lập kế hoạch.

Nguồn chính: [master plan v0.2](../project-plan.md), [nghiệm thu M2](../tasks/GCMS-M2-001.md), [workflows](../workflows.md), [tiêu chí nghiệm thu](../acceptance-criteria.md) và [baseline UI](../design/admin-mockup/approved-baseline.json).

---

**1. Kết quả cần đạt của toàn Chặng 3**

| Slice | Kết quả người dùng | Phụ thuộc thực tế | AC chính |
|---|---|---|---|
| **S09** | Khách duyệt chuyên khoa, nhóm dịch vụ, danh sách và chi tiết dịch vụ; đi đến dịch vụ liên quan | Publication S03/S08; quyền tenant hiện có | AC-02/05/08 |
| **S10a** | Khách xem thông tin một hoặc nhiều cơ sở và phạm vi áp dụng | S09 đối với liên kết dịch vụ | AC-05/08 |
| **S10b** | Khách xem danh sách/hồ sơ bác sĩ, chuyên môn, ngôn ngữ và cơ sở liên quan | Contracts S09; S10a khi sử dụng cơ sở | AC-05/08 |
| **S10c** | Khách xem giá chính xác, khoảng giá hoặc giá từ, cùng đơn vị và điều kiện áp dụng | Dịch vụ S09; S10a khi giá theo cơ sở | AC-05/08 |
| **S11** | Khách xem ca điều trị, gallery trước/sau và đánh giá có quyền công bố phù hợp | Media S07; references S09/S10 thực sự sử dụng | AC-03/08 |
| **S12** | Khách đọc bài viết theo chuyên mục và FAQ; đi đến dịch vụ liên quan | Publication S03/S08; S09/S10 chỉ cho references được sử dụng | AC-02/08 |

**Phạm vi M3:** nội dung VI trên nền website hiện có; có listing, detail, các block liên quan và đường dẫn thực tế.

Hai theme, full section builder, landing page, triển khai EN/fallback và SEO đầy đủ vẫn thuộc S13–S15. Custom domain/301, quota và tenant lifecycle vẫn thuộc S16–S17.

---

**2. Contracts chung cần chốt trước phần phụ thuộc**

Các quyết định dưới đây áp dụng xuyên bốn slice. Chúng mở rộng nền tảng hiện có, không thay mô hình tenant, tài khoản hoặc công nghệ.

| Mã | Đề xuất | Hệ quả cần kiểm chứng |
|---|---|---|
| **M3-D01 — Vòng đời nội dung** | Mọi loại nội dung biên tập mới dùng Draft → Published; có pending draft, preview riêng tư, lịch sử, restore thành draft và unpublish. Chỉ explicit publish thay đổi live | Không xuất bản ngầm khi lưu, đổi quan hệ hoặc khôi phục |
| **M3-D02 — Quan hệ có version** | Nội dung cha chỉ công bố dữ liệu từ phiên bản Published hợp lệ của tài nguyên liên kết. Snapshot ghi đúng version được sử dụng | Sửa draft của bác sĩ/giá/FAQ không làm đổi trang đang live |
| **M3-D03 — Quyền hiện tại thắng lịch sử** | Unpublish hoặc thu hồi quyền phải chặn tham chiếu công khai liên quan. Restore/retry không tự cấp lại quyền. Publish lại không tự phục hồi các references đã bị thu hồi | Không dùng snapshot cũ để đưa nội dung đã rút lại lên website |
| **M3-D04 — Public read model** | Listing đọc các publication hiện hợp lệ; nội dung nhúng trong trang dùng references đã chốt trong snapshot. Phần đọc liên quan phải nhất quán tại DB | Không ghép title từ draft, giá từ publication khác hoặc ảnh đã bị thu hồi |
| **M3-D05 — Tương thích dữ liệu cũ** | Giữ đọc được service snapshots hiện có và URLs đã khóa. Thay đổi schema/contracts theo hướng bổ sung, có version rõ | Không viết lại lịch sử hoặc bắt dịch vụ cũ phải có taxonomy/cơ sở mới |
| **M3-D06 — Phạm vi local VI** | Giữ no-store SSR, metadata đúng nội dung VI và local noindex. Tạo URLs qua contract theo loại nội dung | Không mở cache mới, không triển khai EN/custom domain hoặc quảng bá local URLs như Production |

**Quy tắc xử lý references**

- References tùy chọn không còn hợp lệ: bỏ block/link/ảnh liên quan; không hiển thị nhãn riêng tư hoặc link chết do hệ thống sinh ra.
- Phụ thuộc bắt buộc không còn hợp lệ: ẩn kết quả phụ thuộc. Ví dụ giá của dịch vụ đã unpublish không được tiếp tục xuất hiện như giá đang áp dụng.
- Nếu giá chỉ áp dụng tại một số cơ sở và toàn bộ cơ sở đó không còn hợp lệ, không được biến giá thành giá chung toàn tổ chức.
- Nội dung cha không tự đổi sang bản Published mới của tài nguyên con. CMS phải cho thấy reference có cập nhật; quản trị viên chủ động chọn và publish lại.
- References có hướng rõ ràng; danh sách liên kết ngược được truy vấn từ quan hệ đã Published. Không sao chép hai chiều rồi để chúng lệch nhau.

**Bảo mật và truy vấn**

Giữ current session, tenant membership, backend authorization, CSRF, password reauthentication cho thao tác nhạy cảm và restricted-role RLS. Tenant Admin quản lý nội dung tenant của mình; Platform Admin không nhận quyền riêng tư ngầm.

Danh sách CMS, bộ chọn references và public listing lọc/phân trang tại nguồn. Đề xuất page mặc định 20, tối đa 50; sort ổn định có ID làm tie-breaker. Cursor gắn tenant, loại nội dung, query/filter và sort. Không tải toàn bộ danh mục về browser; không exact-count trên mọi request.

Tìm kiếm M3 bắt đầu từ tên/tiêu đề/slug với quy tắc chuẩn hóa rõ ràng. Chưa thêm fuzzy search, AI hoặc search engine riêng.

---

**3. S09 — Chuyên khoa, nhóm dịch vụ và dịch vụ**

**Mục tiêu:** quản trị viên tổ chức danh mục, xuất bản và kiểm tra website; khách có thể duyệt từ chuyên khoa/nhóm đến dịch vụ và dịch vụ liên quan.

**Dữ liệu và UI đề xuất**

| Đối tượng | Nội dung tối thiểu | CMS và public |
|---|---|---|
| Chuyên khoa | Tên, slug, mô tả, nội dung giới thiệu, SEO | Quản lý trong khu vực Dịch vụ; public danh sách/chi tiết |
| Nhóm dịch vụ | Tên, slug, mô tả, nội dung giới thiệu, SEO | Quản lý trong khu vực Dịch vụ; public danh sách/chi tiết |
| Dịch vụ | Giữ nội dung hiện có; bổ sung chuyên khoa, nhóm và dịch vụ liên quan | Mở rộng editor hiện có; thêm public listing và các block liên quan |

**Các lựa chọn đề xuất**

- **S09-D01:** chuyên khoa và nhóm là hai danh mục phẳng, không bắt buộc cây nhiều cấp. Một dịch vụ có thể thuộc nhiều chuyên khoa/nhóm trong cùng tenant.
- **S09-D02:** dịch vụ cũ không có chuyên khoa/nhóm vẫn hoạt động. Không backfill bằng một danh mục nghiệp vụ do hệ thống tự đoán.
- **S09-D03:** dịch vụ liên quan được quản trị viên chọn có thứ tự; không tự suy đoán bằng AI. Từ chối tự liên kết, trùng và cross-tenant.
- **S09-D04:** thêm tabs/quản lý danh mục trong khu vực **Dịch vụ**, giữ navigation và editor patterns đã duyệt.

Public paths dự kiến: `/<tenant>/chuyen-khoa`, `/<tenant>/nhom-dich-vu`, `/<tenant>/dich-vu` và các trang chi tiết tương ứng. Giữ nguyên đường dẫn chi tiết dịch vụ hiện có.

**Tasks theo luồng hoàn chỉnh**

| Task | Kết quả và tiêu chí hoàn thành | Phụ thuộc / kiểm chứng |
|---|---|---|
| **S09-T01 — Luồng đại diện chuyên khoa** | Tạo → lưu → reload → preview → publish → mở listing/detail thật. Có history/restore/unpublish | Contracts M3; API/DB thật và browser desktop/mobile |
| **S09-T02 — Nhóm dịch vụ** | Quản trị viên quản lý và xuất bản nhóm; khách mở trang nhóm và thấy empty/populated states đúng | Tái sử dụng lifecycle T01; kiểm tenant/slug/version |
| **S09-T03 — Gắn taxonomy vào dịch vụ** | Editor chọn chuyên khoa/nhóm; save chỉ đổi draft; publish ghi quan hệ/version vào snapshot | T01/T02 tương ứng; kiểm references draft/unpublished/cross-tenant |
| **S09-T04 — Hành trình duyệt dịch vụ** | Listing, bộ lọc chuyên khoa/nhóm, detail, breadcrumb và dịch vụ liên quan dùng dữ liệu Published | T03; SSR không JavaScript, phân trang và điều hướng browser |
| **S09-T05 — Xung đột và mất eligibility** | Hai admin không ghi đè nhau; taxonomy/service unpublish không để lộ dữ liệu hoặc link hệ thống cũ | Race tại DB; replay/conflict; kiểm snapshot cũ |
| **S09-T06 — Bàn giao S09** | Luồng đại diện và toàn bộ ngoại lệ bắt buộc có bằng chứng; dịch vụ M1/M2 còn tương thích | Checks phạm vi bị tác động; không chạy lại runner cũ gây sửa fixtures |

**Tiêu chí nghiệm thu S09**

1. Khách duyệt chuyên khoa → nhóm/dịch vụ → chi tiết → dịch vụ liên quan qua URLs thật.
2. Danh sách chỉ dùng quan hệ Published; draft taxonomy hoặc draft reference không xuất hiện.
3. Admin sửa tên/mô tả/quan hệ trong draft thì public vẫn giữ bản đã xuất bản.
4. Unpublish loại bỏ tài nguyên khỏi listing và các references công khai liên quan.
5. Hai tenant có tên/slug nội dung giống nhau không đọc hoặc tham chiếu chéo.
6. Dịch vụ hiện hữu vẫn giữ nội dung, lịch sử, cover và form tư vấn.

---

**4. S10 — Cơ sở, bác sĩ và giá áp dụng**

S10 chia thành **ba phần có kết quả độc lập**, đúng master plan. Mỗi phần đi xuyên CMS → API → DB → public render.

**S10a — Cơ sở và phạm vi áp dụng**

**Dữ liệu:** tên cơ sở, địa chỉ, thông tin liên hệ, giờ mở cửa và liên kết bản đồ. Giờ mở cửa cần biểu diễn rõ ngày nghỉ và nhiều khoảng giờ khi có; không chuyển thành lịch hẹn.

**S10-D01:** cơ sở là nội dung của tổ chức. Không tạo child tenant, location administrator, quyền theo cơ sở hoặc lead queue.

**S10-D02:** không chọn cơ sở nghĩa là nội dung chưa nêu cơ sở cụ thể. UI không tự gắn nhãn “áp dụng tại mọi cơ sở”. References chọn rõ cơ sở nào phải hiển thị đúng cơ sở đó.

| Task | Kết quả và tiêu chí hoàn thành | Phụ thuộc / kiểm chứng |
|---|---|---|
| **S10a-T01 — Cơ sở lên website** | Tạo/lưu/preview/publish cơ sở; khách xem danh sách, chi tiết, liên hệ và giờ mở cửa | Lifecycle M3; kiểm tổ chức một cơ sở và ba cơ sở |
| **S10a-T02 — Áp dụng cho dịch vụ** | Chọn cơ sở trong service draft; explicit publish mới thay public applicability | S09 + T01; kiểm version, unpublish và quan hệ cùng tenant |
| **S10a-T03 — Cơ sở quan tâm trên form tư vấn** | Form dịch vụ cho chọn cơ sở hợp lệ, không bắt buộc; server lưu lựa chọn/snapshot cần thiết; CMS đọc trong lead detail chung | T02 + S04/S05; kiểm idempotency, giả mạo ID, preservation và retention |

T03 hoàn thiện phần location đã được S04 để lại cho S10. Không thêm định tuyến lead theo cơ sở. Không thêm location filter cho lead list trong M3 nếu chưa có nhu cầu riêng.

Khi thêm lựa chọn cơ sở, payload cũ không có cơ sở vẫn hợp lệ. Receipt/fingerprint cũ phải giữ tương thích; cùng key nhưng đổi cơ sở là đổi payload. Tên/địa chỉ cơ sở thay đổi về sau không được âm thầm viết lại ngữ cảnh của lead đã tiếp nhận.

Liên kết bản đồ là URL được kiểm tra; không nhúng iframe/script và không thêm dịch vụ bản đồ trả phí.

**S10b — Hồ sơ bác sĩ**

**Dữ liệu:** tên hiển thị, chức danh/chuyên môn được cung cấp, tiểu sử, bằng cấp/chứng chỉ dạng nội dung, ngôn ngữ, ảnh hợp lệ, chuyên khoa, dịch vụ và cơ sở liên quan.

**S10-D03:** hồ sơ bác sĩ là nội dung website, không tự tạo tài khoản hoặc quyền hệ thống. CMS ghi thông tin do quản trị viên cung cấp; hệ thống không tự tuyên bố đã xác minh chứng chỉ.

| Task | Kết quả và tiêu chí hoàn thành | Phụ thuộc / kiểm chứng |
|---|---|---|
| **S10b-T01 — Hồ sơ bác sĩ lên website** | Editor → save/reload → preview → publish → danh sách/chi tiết bác sĩ | Lifecycle M3; text/ảnh an toàn; desktop/mobile |
| **S10b-T02 — Quan hệ chuyên môn/cơ sở** | Hiển thị đúng references chuyên khoa, dịch vụ và cơ sở đã Published | S09; S10a cho references cơ sở; kiểm draft/unpublish/cross-tenant |
| **S10b-T03 — Lịch sử và thay đổi đồng thời** | Pending draft không đổi hồ sơ live; restore không publish; stale save/publish bị từ chối | API/DB race, browser giữ input và xử lý reauth |

Không buộc hồ sơ bác sĩ phải chờ toàn bộ S10a nếu chưa sử dụng reference cơ sở. Không upload tài liệu cá nhân/chứng chỉ như một tính năng lưu hồ sơ riêng tư mới.

**S10c — Bảng giá**

| Kiểu giá | Dữ liệu bắt buộc | Cách hiển thị |
|---|---|---|
| **Chính xác** | Một số tiền, tiền tệ, đơn vị | Ví dụ “1.000.000 VND / răng” |
| **Khoảng** | Giá thấp, giá cao, cùng tiền tệ/đơn vị | Hiển thị cả hai đầu khoảng |
| **Từ** | Giá khởi điểm, tiền tệ, đơn vị | Phải giữ từ “Từ”, không trình bày như giá cố định |

Mỗi giá gắn dịch vụ, có thể chỉ rõ cơ sở, phần bao gồm và ghi chú.

**S10-D04:** tiền được truyền bằng decimal string và lưu kiểu số chính xác. Không dùng số thực JavaScript để tính/làm tròn giá. Không tự quy đổi ngoại tệ.

**S10-D05:** từ chối số âm, khoảng đảo chiều, thiếu đầu khoảng, thiếu tiền tệ/đơn vị và payload không đúng kiểu giá. Không dùng giá `0` thay cho “chưa nhập giá”.

| Task | Kết quả và tiêu chí hoàn thành | Phụ thuộc / kiểm chứng |
|---|---|---|
| **S10c-T01 — Một giá hợp lệ lên website** | CMS nhập đúng kiểu → lưu/preview → publish → public hiển thị đúng số/tiền tệ/đơn vị | S09 + S10a nếu giá theo cơ sở; validation FE/API/DB |
| **S10c-T02 — Bảng giá và áp dụng** | Trang bảng giá, lọc theo dịch vụ/cơ sở và block giá trên dịch vụ dùng cùng publication contract | T01; không N+1/over-fetch; không làm tròn khác nhau giữa các trang |
| **S10c-T03 — Giá cũ và mất eligibility** | Sửa draft không đổi giá live; history/restore hoạt động; service/cơ sở bị rút thì giá phụ thuộc không bị mở rộng sai | Version/conflict, rollback/retry và SSR |

**Tiêu chí nghiệm thu S10**

1. Cùng mô hình dữ liệu phục vụ tổ chức một cơ sở và ba cơ sở.
2. Dịch vụ, bác sĩ và giá thể hiện đúng cơ sở áp dụng.
3. Bác sĩ có nội dung, ngôn ngữ, chuyên môn và references đúng bản Published.
4. Ba kiểu giá hiển thị đúng, kể cả số lớn, số thập phân hợp lệ và giá trị bằng nhau ở hai đầu khoảng.
5. Cơ sở bị unpublish không tiếp tục xuất hiện trong lựa chọn tiếp nhận mới hoặc references công khai.
6. Lead có lựa chọn cơ sở vẫn nằm trong danh sách chung; assignee/cơ sở không thay quyền xem.
7. Phần dữ liệu location bổ sung của lead được đưa vào deletion graph S06, không để sót dữ liệu riêng tư khi hết hạn.

---

**5. S11 — Ca điều trị, gallery trước/sau và testimonial có quyền công bố**

**Mục tiêu:** quản trị viên xuất bản nội dung khách hàng đúng phạm vi cho phép; thu hồi quyền có hiệu lực trên toàn bộ đường công khai liên quan.

Đây là slice rủi ro cao nhất của M3 vì quyền công bố phải bao phủ cả **nội dung chữ**, hình ảnh và các bản sao trong publication.

**Dữ liệu đề xuất**

| Loại nội dung | Thành phần |
|---|---|
| Ca điều trị | Tiêu đề, tóm tắt, câu chuyện biên tập, dịch vụ/bác sĩ liên quan, gallery được chọn, SEO |
| Gallery trước/sau | Các cặp ảnh có thứ tự; từng ảnh có vai trò trước/sau, caption và alt; references phù hợp |
| Testimonial/đánh giá | Nội dung trích dẫn, tên/biệt danh được phép hiển thị, attribution được cung cấp, ảnh tùy chọn, dịch vụ/bác sĩ liên quan |
| Bằng chứng cho phép | Resource/phạm vi/tư liệu được phép công bố, evidence reference, người ghi nhận, thời điểm và quyết định thu hồi |

Không yêu cầu tên thật, số điện thoại, mã bệnh nhân hoặc hồ sơ điều trị. Không thêm upload bệnh án hay kho lưu hợp đồng đồng ý công bố.

**Các lựa chọn đề xuất**

| Mã | Đề xuất | Lý do |
|---|---|---|
| **S11-D01 — Phạm vi quyền** | Quyền phải xác định ca/gallery/testimonial và tư liệu tương ứng. Quyền ảnh `service_cover` không được suy rộng | Tránh dùng sự đồng ý cho mục đích khác |
| **S11-D02 — Nội dung chữ** | Ca/testimonial có nguồn từ khách hàng cần quyền công bố ngay cả khi không có ảnh | Quyền ảnh không chứng minh quyền công bố câu chuyện |
| **S11-D03 — Gallery** | Gallery có định danh/version riêng, gồm các cặp trước/sau có thứ tự; có thể được ca điều trị tham chiếu | Có thể quản lý và tái sử dụng mà không nhân bản ảnh/nội dung |
| **S11-D04 — Thay đổi tư liệu** | Đổi tư liệu hoặc mở rộng phạm vi sử dụng phải có xác nhận quyền tương ứng; history/restore không sao chép quyền cũ thành quyền mới | Không biến consent thành quyền vô hạn |
| **S11-D05 — Thu hồi** | Thu hồi quyền nội dung chặn toàn bộ resource; thu hồi ảnh chặn ảnh/caption/alt liên quan. Thiếu một ảnh thì bỏ cả cặp trước/sau | Không để ảnh lẻ gây hiểu sai hoặc rò rỉ nội dung bị rút |
| **S11-D06 — Workflow** | Giữ Draft → Published bởi Tenant Admin; không thêm clinical review gate | Phù hợp policy đã duyệt |

Các quyết định này chỉ là quy tắc sản phẩm và bằng chứng nội bộ. Không tuyên bố hệ thống đã chứng nhận sự đồng ý hoặc tuân thủ pháp lý.

**Tasks theo luồng hoàn chỉnh**

| Task | Kết quả và tiêu chí hoàn thành | Phụ thuộc / kiểm chứng |
|---|---|---|
| **S11-T01 — Quyền và luồng đại diện** | Ghi quyền cho một nội dung thử; preview riêng tư; publish bị chặn khi thiếu/sai scope và thành công khi hợp lệ | S07 + lifecycle M3; restricted DB/API và UI thật |
| **S11-T02 — Ca điều trị** | Soạn → gắn dịch vụ/bác sĩ → preview → publish → listing/detail | References S09/S10 sử dụng; không lộ evidence riêng tư |
| **S11-T03 — Gallery trước/sau** | Chọn ảnh ready/hợp lệ, tạo cặp, caption/alt, sắp thứ tự, publish và render đúng | S07 + T01; sai thứ tự, ảnh trùng/sai tenant, thiếu ảnh |
| **S11-T04 — Testimonial** | Nội dung chữ/attribution/ảnh tùy chọn có đúng quyền; public listing/block hoạt động | T01; không tự tạo lời đánh giá hoặc aggregate rating |
| **S11-T05 — Thu hồi xuyên các nơi sử dụng** | Detail, listing, related cards, gallery, ảnh, alt/caption và metadata liên quan cùng chặn nội dung bị rút | S07 gateway/worker; đo thời điểm và kiểm snapshots cũ |
| **S11-T06 — Retry, restore và race** | Publish đồng thời với withdraw; stale worker; restore snapshot cũ không đưa tư liệu trở lại | DB barriers, worker thật trong scope mới và browser |
| **S11-T07 — Bàn giao quyền công bố** | CMS hiển thị phạm vi, evidence reference, trạng thái thu hồi/purge và lỗi thật | UAT desktop/mobile; source/security review độc lập khi thực thi |

**Thu hồi cần chứng minh riêng hai lớp**

1. **Eligibility:** chặn ngay quyền công khai; các đường delivery đang được kiểm soát dừng trong giới hạn **≤60 giây** đã duyệt.
2. **Purge:** target **≤5 phút**, có pending/failed/retry. Purge lỗi không được làm nội dung đủ quyền trở lại.

Giữ private originals, signed access ≤60 giây, JPEG/PNG/WebP ≤5 MiB, giới hạn decode hiện có và không remote import/SVG. Chưa cần profile ảnh hoặc decoder mới nếu profile hiện có đáp ứng; thay đổi kỹ thuật media phải được đánh giá trong phạm vi tương ứng.

**Tiêu chí nghiệm thu S11**

- Thiếu quyền, sai scope, sai tenant hoặc tư liệu đã thu hồi đều không publish/deliver được.
- Quyền dành cho một resource không tự cho phép resource khác sử dụng tư liệu.
- Gallery giữ đúng cặp, thứ tự, caption và alt sau save/reload/publish.
- Thu hồi nội dung chữ không chỉ xóa ảnh mà vẫn để câu chuyện/testimonial công khai.
- Unpublish/withdraw/restore/retry không tạo đường hồi sinh từ snapshot cũ.
- Evidence reference và nội dung quản trị quyền không xuất hiện trong public API/HTML.
- Bằng chứng timing và purge được ghi theo đường thực tế đã kiểm, không suy từ screenshot hoặc unit test.

---

**6. S12 — Bài viết, chuyên mục và FAQ tái sử dụng**

**Mục tiêu:** quản trị viên xuất bản kiến thức và câu trả lời; khách đọc theo chuyên mục, xem attribution và chuyển đến dịch vụ liên quan.

**Dữ liệu và lựa chọn đề xuất**

| Mã / đối tượng | Đề xuất |
|---|---|
| **S12-D01 — Chuyên mục** | Danh mục phẳng, có tên/slug/mô tả; bài viết có thể thuộc nhiều chuyên mục trong tenant |
| Bài viết | Tiêu đề, tóm tắt, rich text allowlist, ảnh tùy chọn, chuyên mục, attribution, dịch vụ liên quan, SEO |
| **S12-D02 — Attribution** | Cho phép attribution dạng nội dung; có thể liên kết bác sĩ Published nếu được chọn. Không tự thêm nhãn “đã được chuyên gia kiểm duyệt” |
| FAQ | Câu hỏi, câu trả lời allowlist và references phù hợp |
| **S12-D03 — FAQ reuse** | FAQ có định danh/version và vòng đời riêng. Bài viết/dịch vụ chọn FAQ cùng thứ tự; publication pin đúng phiên bản |
| **S12-D04 — Cập nhật FAQ** | Sửa draft FAQ không đổi mọi trang sử dụng. Admin chọn bản mới và publish lại trang cha; unpublish FAQ chặn references công khai cũ |

Public paths dự kiến: `/<tenant>/bai-viet`, trang bài viết, trang chuyên mục và `/<tenant>/hoi-dap`. FAQ có thể hiện trực tiếp trong dịch vụ/bài viết, không bắt mỗi câu hỏi phải có trang detail riêng.

Rich text tiếp tục dùng cấu trúc an toàn đã có. Không thêm arbitrary HTML, script, iframe hoặc tự chuyển văn bản thành mã thực thi.

**Tasks theo luồng hoàn chỉnh**

| Task | Kết quả và tiêu chí hoàn thành | Phụ thuộc / kiểm chứng |
|---|---|---|
| **S12-T01 — Bài viết đại diện** | Tạo/lưu/reload/preview/publish → mở listing/detail thật; có history/restore/unpublish | Lifecycle M3; chưa cần chờ S10 |
| **S12-T02 — Chuyên mục** | Quản lý/publish chuyên mục, gắn vào bài; khách lọc và mở danh sách đúng | T01; quan hệ Published, cursor và empty state |
| **S12-T03 — Attribution và nội dung liên quan** | Hiển thị attribution đúng nguồn; dịch vụ/bác sĩ liên kết phải hợp lệ | S09/S10 chỉ khi sử dụng references tương ứng |
| **S12-T04 — FAQ lên website** | Tạo/publish FAQ → danh sách Hỏi đáp; có preview/history/restore/unpublish | Lifecycle M3; answer validation và keyboard |
| **S12-T05 — FAQ tái sử dụng** | Chọn/sắp FAQ trong bài viết và dịch vụ; snapshot giữ đúng version; cập nhật có chủ đích | T04 + consumer tương ứng; kiểm draft không đổi live |
| **S12-T06 — Stale navigation và bàn giao** | Bài/chuyên mục/FAQ unpublish không còn trong listing, bộ lọc và block liên quan do hệ thống sinh ra | API/DB/SSR/browser; conflict, retry và denied states |

**Tiêu chí nghiệm thu S12**

1. Bài viết đi xuyên editor → Published → listing/detail → dịch vụ liên quan.
2. Chuyên mục và attribution hiển thị từ dữ liệu đã xuất bản.
3. Một FAQ được dùng trên nhiều trang nhưng không bị sao chép thành các bản không liên quan.
4. Sửa FAQ draft giữ nguyên public; publish bản mới không âm thầm thay nội dung cha.
5. FAQ/bài viết đã unpublish không tiếp tục được cấp qua reference hoặc public read cũ.
6. Không có mandatory reviewer stage, nội dung giả hoặc tuyên bố kiểm chứng chuyên môn tự sinh.

---

**7. Thứ tự triển khai và điểm tích hợp**

Thứ tự đề xuất sau khi có quyền thực thi:

1. **Preflight và contracts chung:** bảo toàn dữ liệu/credentials/evidence; chốt namespace, publication/reference eligibility và ownership.
2. **S09-T01:** chứng minh một chuyên khoa mới đi qua toàn bộ luồng thực tế. Đây là màn hình đại diện đầu tiên để kiểm extension UI và lifecycle.
3. **Hoàn thiện S09:** nhóm, service references, listing và related navigation.
4. **S10a → các consumer cơ sở:** hoàn thiện locations và phần location của intake.
5. **S10b/S10c:** triển khai bác sĩ và giá theo các dependencies thực sự dùng.
6. **S11:** xây quyền công bố và luồng đại diện trước, rồi ca/gallery/testimonial và withdrawal.
7. **Tích hợp M3:** kiểm toàn bộ hành trình, preservation, regressions và bàn giao UAT.

**S12 có thể bắt đầu sau khi lifecycle/reference contract chung ổn định.** Bài viết và FAQ độc lập không cần chờ bác sĩ, bảng giá hoặc S11. Phần liên kết bác sĩ chỉ chờ contract tương ứng của S10b.

S11 không cần chờ toàn bộ S10 nếu nội dung đang làm chỉ dùng dịch vụ hoặc references đã hoàn tất. Migration numbering, publication/media contracts và shared editor vẫn phải có một writer.

---

**8. Ownership, phạm vi code và effort đề xuất**

Đây là phân công theo trách nhiệm để chuẩn bị thực thi; **chưa giao writer hoặc dispatch agent trong lượt này**.

| Trách nhiệm | Phạm vi dự kiến | Effort |
|---|---|---|
| Coordinator được Khiêm chỉ định | Contracts chung, migration numbering, shared root/runtime, tích hợp, hồ sơ và bằng chứng | **xHigh** |
| API + Data | Dental content, publication references, RLS, constraints, transactions, queries và phần location intake | **xHigh** |
| CMS | Editors/listings/reference pickers, quyền công bố, trạng thái và consumers thật | **xHigh** cho luồng tích hợp có boundary |
| Website | SSR listing/detail, related blocks, giá, FAQ và media eligibility | **xHigh** |
| Reviewer độc lập khi thực thi | Publication/tenant/media/privacy/race và tương thích dữ liệu cũ | **xHigh** |
| Writer tài liệu từ quyết định đã chốt | Ghi đầy đủ plan, quyết định, runbook và bằng chứng đã có | **Medium** |

Các thư mục hiện có liên quan:

- [API contracts](../../apps/api/src/contracts), [modules](../../apps/api/src/modules), [migrations](../../apps/api/migrations) và [API tests](../../apps/api/test).
- [CMS components](../../apps/admin/components), [CMS routes](../../apps/admin/app/cms) và [CMS libraries](../../apps/admin/lib).
- [Website routes](../../apps/website/app), [public consumers](../../apps/website/lib) và [website components](../../apps/website/components).

Dental Content sở hữu dữ liệu nghiệp vụ; Publishing sở hữu lifecycle/snapshot; Media sở hữu asset/delivery. Leads sở hữu lựa chọn cơ sở của yêu cầu tư vấn. Không để Content ghi trực tiếp tùy tiện vào bảng nội bộ của Leads hoặc Media.

Chưa có reviewer độc lập chạy cho kế hoạch này. Khi thực thi, review tập trung vào bằng chứng và rủi ro trên; không tạo vòng duyệt mới cho từng file.

---

**9. Migrations, dữ liệu thử và phục hồi**

- Chỉ forward migrations mới. Giữ nguyên toàn bộ migrations/checksums đã áp dụng đến M2, gồm các bản đến `0024`; không tự sử dụng lại số `0023` đã được ghi nhận reserved.
- Thêm schema/references/indexes cần thiết; giữ tenant-consistent keys và constraints tại DB.
- Backfill chỉ để giữ tương thích và lịch sử trung thực. Không tự xuất bản, tự gắn taxonomy hoặc tự cấp consent cho dữ liệu hiện hữu.
- Mọi fixture mới dùng dữ liệu tổng hợp, manifest sở hữu riêng; không nhập dữ liệu bệnh nhân hoặc nội dung từ website tham chiếu.
- Chỉ cho phép kiểm chứng unpublish/withdraw/xóa trên tài nguyên thử được xác định rõ. Không thay đổi dữ liệu đã nghiệm thu để làm fixtures thuận tiện hơn.
- Worker kiểm chứng chỉ xử lý scope mới; startup/migration không tự drain backlog S04/S05/M2.
- Location data bổ sung cho lead phải đi cùng retention/deletion; không giữ bản sao ngoài deletion graph dưới tên audit.
- Lỗi trước transaction commit phải rollback. Sau thay đổi schema hoặc quyết định thu hồi đã commit, ưu tiên roll-forward; không hứa rollback bằng cách khôi phục dữ liệu/quyền cũ.

Preservation checks chỉ chứng minh phạm vi đã so sánh. Chúng không thay cho operational backup/restore.

---

**10. Kế hoạch kiểm chứng M3**

| Nhóm kiểm chứng | Bằng chứng cần có |
|---|---|
| **Business rules** | Quan hệ hợp lệ, ba kiểu giá, applicability, gallery pairing, consent scope và FAQ version reuse |
| **DB/transactions** | Restricted-role/RLS thật; hai tenant; constraints; conflict; atomic publish; idempotent retry; rollback/race |
| **Public rendering** | Anonymous API + HTML SSR thực tế; listing/detail/related blocks; không đọc draft; current eligibility |
| **Media S11** | Quyền theo scope; private originals; controlled gateway; withdrawal timing; purge failed/retry; stale worker |
| **CMS/UI** | Đăng nhập thật, save/reload/preview/publish/history/restore/unpublish; keyboard và focus |
| **Responsive** | Các màn hình đại diện và layout khác nhau tại 320/390/768/1024/1440px; controls dùng được trong container |
| **States** | Có dữ liệu, trống, loading, validation, denied, outage/retry, reauth, conflict và unsaved input |
| **Regression** | Service publication/cover M2, form/lead chung S04/S05 và retention S06 ở các seams bị M3 tác động |
| **Performance** | Query plans cho listing/reference pickers/related content với dữ liệu tổng hợp đại diện; kiểm N+1 và giới hạn payload |
| **Static/runtime** | Typecheck, lint, build, tests phù hợp; entrypoints tiếp tục dùng Bun; không silent Node fallback |

Các lệnh hiện có như `bun run typecheck`, `bun run lint`, `bun run build` sẽ dùng project-local Bun theo runbook khi thực thi được duyệt. Các runner S09–S12 chưa tồn tại; phải tạo và kiểm tra trong implementation, không ghi chúng là commands đã được xác minh.

**Audit `braces` vẫn FAIL/open.** M2 deferral không tự trở thành miễn trừ cho M3. Reviewer cần đánh giá exposure bị M3 tác động; giữ mốc reassess 22/10/2026 hoặc sớm hơn khi patch/dependency/exposure thay đổi và trước Production. Không tự nâng dependency trong kế hoạch này.

Bằng chứng cũ chỉ tái sử dụng khi inputs còn phù hợp. Kiểm lại phần thay đổi hoặc còn thiếu; không chạy toàn bộ mutating suites cũ chỉ để có một con số tổng mới.

---

**11. Demo nghiệm thu toàn Chặng 3**

Kịch bản đề xuất dùng một tenant tổng hợp có ba cơ sở và một tenant thứ hai để kiểm isolation:

1. Admin tạo chuyên khoa/nhóm, gắn dịch vụ và publish; khách duyệt đến trang dịch vụ.
2. Admin sửa taxonomy/service draft; khách vẫn thấy bản Published cũ.
3. Admin xuất bản cơ sở, bác sĩ và giá; khách xem đúng phạm vi áp dụng và ba kiểu giá.
4. Khách chọn cơ sở quan tâm trong form dịch vụ; lead xuất hiện ở danh sách chung và cả hai admin cùng tenant đều xem được.
5. Admin ghi quyền công bố rồi publish ca/gallery/testimonial; khách xem đúng nội dung và thứ tự ảnh.
6. Admin thu hồi quyền; kiểm listing/detail/related/media/history không tiếp tục cấp công khai tư liệu bị rút.
7. Admin publish bài viết và FAQ dùng lại trên hai trang; sửa draft FAQ không đổi live; cập nhật có chủ đích mới đổi trang cha.
8. Admin thứ hai tạo conflict; hệ thống từ chối stale write và giữ input. Tenant thứ hai không đọc/tham chiếu được dữ liệu riêng tư.
9. Restore tạo draft; explicit publish mới cập nhật website. Restore nội dung cũ không phục hồi quyền đã thu hồi.

**Điều kiện đóng M3:** từng slice đạt tiêu chí bắt buộc, hành trình thật đã chạy, findings chặn đã xử lý, hồ sơ/bằng chứng đồng bộ và giới hạn được ghi đúng. Sau đó Khiêm quyết định nghiệm thu riêng.

M3 không đóng toàn bộ AC-08, localization, themes, domains hoặc Production. **CODE_INTEGRATED**, **VERIFIED_LOCAL** và **HUMAN_ACCEPTED** tiếp tục là các trạng thái riêng.

**Trạng thái hiện tại:** đã hoàn thành kế hoạch đề xuất M3 v0.1 trong chat. Các quyết định M3-D01–D06 và S09/S10/S11/S12-Dxx ở trên chưa được duyệt. Toàn bộ kiểm chứng sản phẩm M3 là **NOT_RUN** vì chưa triển khai; chưa ghi file hoặc thực hiện thay đổi ứng dụng.

## Execution ledger

**Plan save:** complete approved source saved before application writes. Application/runtime checks NOT_RUN at this checkpoint. Bounded assignments and evidence follow below.

### Initial assignments and preservation

Parent independently verified native metadata before GO (role kit-implementer, exact parent, inherited gpt-6.1-sol/xhigh): API+Data `/root/m3_api_data` thread01a14437-3117-7071-b611-e172f41de260 owns apps/api/** including canonical m3 contract and forward SQL; CMS `/root/m3_cms` thread01a14437-6922-73e0-83c2-8da5f53425a2 owns apps/admin/**; website `/root/m3_website` thread01a14437-90f2-7e23-9740-a472c88ecf38 owns apps/website/**. Children preserve other work and do not delegate. Parent owns scripts/fixtures/runtime/shared docs/root and integration. Consumers wait for canonical contract; representative specialty wired UI/API/public flow is first runtime checkpoint before dependent visual expansion. [Native observations](../evidence/m3/native-runtime-initial.json).

Plan extraction initially expected a channel field absent from runtime message records and wrote nothing; exact assistant-message prefix selection recovered only the approved plan. First doc check found link-normalization errors; scoped link repair then static verifier PASS134Markdown/1528links. Complete source hash remains unchanged.

M3 preservation capture initially failed to connect inside sandbox. Readonly lsof proved retained ports were listening; Docker socket access was also denied. Authorized elevated local execution succeeded:50tables/210406rows/894protected files hashed into exclusive0600ignored .local/m3-baseline.json. No raw values/credentials emitted; no existing DB/resource changes occurred. This is a before-state preservation baseline, not backup/restore proof.

### First runtime integration checkpoint

**Representative S09 runtime PASS:** normal new-A1 browser login/current tenant; real empty list; create/save/readback; private saved preview;403REAUTH_REQUIRED then normal password assurance and same explicit publish; public VI detail; rendered1440x1080/390x844 with visible controls inside viewport; keyboard Enter saves draftV2 while public remainsV1. [Bounded representative proof](../evidence/m3/ui/representative.json). This releases dependent CMS visual expansion only, not full S09/M3 acceptance. Initial query400 and create409 screenshot retained; dirty-leave guard observed.

**Actual API/SQL/media integration PASS:**8tests/266assertions core +2tests/61assertions native media, zero failed/skipped. Root ran scripts/check-m3.ts integration with explicit M3 flag and private config; exact dated summary in evidence/m3. Cases cover specialty lifecycle/history/conflict/replay, FAQ immutable pins/current generation, three price shapes/location applicability, scope-specific text, RLS/CSRF/direct-DML/null-kind, anonymous intake/audit/old semantic fingerprint/retry, graph/payload admission/atomic rollback, PG advisory race, actual PNG/native decoder/storage, S11 ordinary-classifier grants, gallery pruning, gateway withdrawal timing, global physical derivative purge and abandoned fifth-lease/fencing/retry. These are bounded new-owned synthetic proofs, distinct from full browser/UAT/Production.

**SQL failures and repairs:** initial0025 failed database CREATE permission despite existing schema; original and one diagnostic transaction rolled back. Removed redundant CREATE and asserted owned existing namespace, without widening DB CREATE. Next42601 identified unparenthesized CASE expressions in PLPGSQLIF; source repaired before apply.0025–0027 then passed rollback-only compilation and actual apply. Runtime query400 came from Express null-prototype query rejected by exactObject; boundary-only query normalization fixed with regression. Runtime create409 came from JSON operator precedence in valid_content SEO subtraction; pending0028 fixes underlying expressions and strict SQLNULL/type guards. Independent reviewer found0027 anonymous audit target regression, S11 ordinary-classifier grant bypass, graph/consumer mismatch and fifth abandoned lease recovery. Forward0028/0029 address those; all applied0025–0029 remain immutable.

0028 rollback compilation/probe used candidatef0bf70...; worker's final strict evidenceReference/reason type guard update occurred before actual apply. Immediate readonly checksum audit confirms applied0028=c43bdcc2e3b40b24cb7194227627bafd3d2e95901e6d440e57aadcc9d04dfc4a=disk, and all0025–0029DB/disk checksumsPASS. Actual apply also ran valid-content/null-kind probes. No applied SQL was subsequently rewritten.

**Independent review:** native kit-reviewer/root/m3_review thread01a14444-a471-7581-846f-dac163c26bc1 role/parent/gpt-6.1-sol/xhigh independently verified beforeGO. [Early findings and continuing review](../evidence/m3/review.md). Root owns actual DB/browser mutation; reviewer only source/pure checks/evidence writes. Overall review and fresh braces exposure assessment remain open until final source/build.

### Integrated S09–S12 behavior and forward repairs

The eleven new content kinds now have typed CMS list/editor, saved private preview, immutable history/compare, restore-to-draft, explicit publish/unpublish, conflict/input preservation and reference selection. The separate anonymous VI website renders twelve sections including the existing service, with eligible immutable references, exact prices, reusable FAQ and controlled media. Location remains ordinary tenant content; doctors are profiles, not accounts. The shared lead list gains only the optional location snapshot.

Forward0030 bounds graph construction before projection and narrows reverse candidates; forward0031 bounds complete public list/service-links DTOs and preserves continuation after the last returned ID. Root stopped the owned launcher before applying0031 because the old serving API did not yet strip the new internal continuation flags. Each forward change passed rollback-only compilation/probes, actual application and checksum comparison. Applied0025–0031 and all inherited migration files remain immutable; reserved0023 is not reused.

Additional runtime/source repairs preserve the approved behavior:

- **R5:** permission commands refresh the canonical editor immediately while preserving later local input. Text withdrawal removes the live link and shows the canonical unpublished state without a reload.
- **R6:** valid M3 commands larger than64KiB use their dedicated512KiB parser; oversized M3 commands still return413, while legacy JSON endpoints keep64KiB. Actual HTTP regression includes a valid gallery larger than64KiB.
- **R7:** complete public DTOs, including long FAQ answers, obey1MiB. Actual twenty-FAQ traversal returns every expected ID exactly once, continues after byte-limited pages, ends with a null cursor, and exposes no internal budget flags.
- Reverse lists match resource kind/ID across eligible publication pins; an exact publication filter applies only when explicitly requested. A service republished asV2 can still show children deliberately pinned to eligibleV1. Directed reference/intake contracts are unchanged.
- An M3-created ancestor loading boundary caused missing/withdrawn detail responses to stream200 before notFound. Removing that boundary restores actual GET and HEAD404; no inherited M2 file was removed.
- Query/fixture tooling repairs are recorded separately from product proof: fixture underscore slugs were corrected only after404 confirmed the owned entry did not exist; a root-script duplicate Drizzle type import was changed to the API's installed instance. A transient parallel build/typecheck failure from missing generated Next types passed after sequential post-build typecheck, without weakening checks.

Root tooling is explicit and local: owned namespace/migration/bootstrap, private fixture manifests, demo/performance data, positive worker enrollment, scoped integration runners, retained-data comparison, anonymous SSR/media/checksum reads and actual listener/runtime diagnostics. No dependency version or lockfile was changed for M3. Existing retained bootstrap/passwords, credentials and backlog were not reset or drained.

### Actual cross-layer evidence before the final R8 repair

The [14-test integration checkpoint](../evidence/m3/integration-checks-1792149362121.json) is **PASS: core11tests/458assertions + native media3tests/149assertions =14tests/607assertions**, zero failures or skips. It adds ordered multi-value service links and duplicate/self/cross-tenant guards, HTTP parser limits, complete DTO continuation, and actual S06 location-lead retention/deletion to the earlier cases. The selected S06 fixture's full ten-table private graph is removed; an unallowlisted due lead remains unchanged. Notice delivery uses local capture. No external email is claimed.

Frontend checkpoint: admin69tests/225assertions + website32tests/131assertions =101tests/356assertions. Root M3 pure runner27tests/112assertions passes. Full build, lint and sequential post-build typecheck pass at this checkpoint. Later R8 tests/build replace the final counts below; these historical results remain valid only for their exact source checkpoint.

Browser evidence uses ordinary login and explicit actions on new synthetic resources:

| Slice / seam | Actual local behavior | Evidence |
| --- | --- | --- |
| S09 lifecycle | Create/save/readback/private preview, normal password reauthentication, publicationV1, pendingV2 leaves liveV1; explicit unpublish gives404; explicit republish publishes savedV2 | [Representative](../evidence/m3/ui/representative.json), [unpublish/republish](../evidence/m3/ui/s09-unpublish-republish.json) |
| S10 locations | Saved addressV2 survives reload; history comparesV1; restore creates draftV3 while public remainsV1 | [Pending location screenshot](../evidence/m3/ui/s10-location-pending-desktop.png) |
| S10 prices | Invalid range is rejected and input retained; two-editor stale save returns409; comparison and explicit preserve-input retry saveV3; publicV1 stays unchanged | [Conflict proof](../evidence/m3/ui/price-conflict.json) |
| S10 intake/shared leads | Three eligible choices; explicit East selection and consent; CAPTCHA; accepted acknowledgement; A1 and normal logout/login A2 find exactly one matching shared lead with the same East name/address snapshot | [Location journey](../evidence/m3/ui/location-intake-journey.json) |
| S11 withdrawal | Explicit text-scope withdrawal immediately shows canonical draft/unpublished state and no live link without reload; public detail denies access; durable invalidation remains separately observable | [Withdrawal](../evidence/m3/ui/withdrawal.json) |
| S12 FAQ reuse | FAQV2 publication does not change article's pinnedV1; explicit picker adoption/save/parent publish changes that article toV2; second article retainsV1 | [FAQ reuse](../evidence/m3/ui/faq-reuse.json) |
| Error and access states | Unauthorized tenant navigation clears the previous private editor; actual owned-launcher outage gives connection error, then Enter-triggered retry after recovery succeeds; public cursor/empty states render | [State proof](../evidence/m3/ui/states.json) |
| Responsive/rendered UI | All eleven CMS kinds and public sections read from actual data; four distinct CMS and four public layouts at320/390/768/1024/1440px; visible controls within viewport, no measured document overflow | [CMS matrix](../evidence/m3/ui/full-cms-matrix.json), [public matrix](../evidence/m3/ui/full-public-matrix.json) |

CAPTCHA provenance: Khiêm explicitly approved solving the first displayed challenge; it expired while awaiting confirmation, and the rejected attempt is not counted as success. Khiêm then explicitly approved “Tải mới và giải ngay”; a newly loaded challenge was solved immediately through the form, and the same synthetic request was accepted. The form cleared/replaced its inputs and focused its acknowledgement. This flow claims neither an appointment nor external email delivery. The A1/A2 search found one lead, YC-000007, with “Cơ sở minh họa Phía Đông”. Private credentials and challenge material are not copied into durable evidence.

Viewport overrides were reset after checks. Rapid resize screenshots that captured transitions remain historical; final-* CMS captures use fresh navigation and visible editor readiness. Pure tests/static fixtures are not substituted for these rendered journeys.

### Worker, performance and preservation boundaries

The [explicitly scoped content worker](../evidence/m3/content-worker-checks.json) completed six invalidation jobs in seven bounded runs including the idle stop, with zero owned copies to delete. An earlier single claimed/completed check is separate. These are resource delivery invalidations for the no-store design; physical derivative purge is separately exercised by actual native Media integration. Positive enrollment covers only the two new M3 tenants. Startup/migrations do not dispatch historical backlog.

The [representative query plans](../evidence/m3/query-plans-1792149660490.json) use a new isolated synthetic tenant with1000published articles and source-side pagination/reverse selection. Actual reverse selection improved from361.729ms before0030 to16.919ms after0030, then14.183ms after0031. Final CMS first/deep pages measured2.083/0.951ms; no-match41.249ms; public first17.063ms. Picker161.406ms at the final checkpoint differs from earlier warm runs near9–10ms. These single local observations have different cache/concurrency conditions, establish no production SLO and do not justify claiming every query is under20ms. No planner disabling, production profiling or speculative index was used.

[Retained-data comparison](../evidence/m3/preservation-1792148526642.json) passes against the pre-write50table/210406row/894file baseline. It compares original-column row projections and protected file hashes/modes, allowing only named volatile auth/rate records and launcher/log metadata behavior. New additive rows/columns are allowed. This does not prove backup/restore or every possible file/secret. The [68-check read-only checkpoint](../evidence/m3/readonly-checks-1792149661343.json) verifies anonymous section/detail SSR, actual gallery bytes, GET/HEAD404, all applied migration checksums and a bounded exact-value scan of known local credentials. [Runtime diagnostics](../evidence/m3/final-diagnostics.json) identify the actual three loopback listener executables as project Bun1.4.3, verify owned ancestry and run six health/ready/redacted error cases. All are point-in-time local proofs.

### Final-review R8 repair in progress

**R8/P2 verified:** newest200 permissions without continuation can hide an older grant that still authorizes a pinned publication. Whole-resource unpublish/global Media withdrawal does not replace scoped withdrawal. The bounded repair keeps the approved privacy contract: default50/max100 permission pages with a context-bound, exact-microsecond descending timestamp/ID cursor; authorized singleton reads; commands return the affected permission; CMS loads older rows and preserves loaded rows/cursor through polling and canonical refresh, with stale-read invalidation. No new infrastructure or migration is initially needed.

API and CMS owners coordinated this contract before writes. Root independently verified their current native turns01a14474-0d9c-7451-8e02-dce7477cdd26 and01a14474-2aef-7520-889e-ef8e8efb0b4c, and reviewer turn01a14476-c263-74b2-bfce-d78f1ec1de8f: exact assigned role/parent/inherited gpt-6.1-sol/xhigh PASS. Root current recorded xhigh also passes. API owns actual201+grant regression and a separate opt-in owned browser fixture; CMS owns merge/poll controls/tests; root owns actual execution/browser; reviewer remains independent/read-only. **R8 and final source/runtime review remain open at this checkpoint.**

## Final local handoff — 2026-10-16

**CODE_INTEGRATED + VERIFIED_LOCAL / READY_FOR_USER_REVIEW.** Complete approved M3 v0.1 is saved above; S09–S12 is implemented within local scope. **Human M3 acceptance is pending.** Desktop `/root` retains integration/accountability; native disjoint API+Data/CMS/website implementation and independent review ownership are recorded above. [R8 native role/parent/inherited model/xhigh observations](../evidence/m3/native-runtime-r8.json) pass. Metadata is agent governance, never a product prerequisite.

### Final repairs

**R8 CLOSED:** actual API regression creates205 genuine text grants across draft revisions, traverses six37-row pages in exact DB order, checks microsecond anchors/context rejection/current authorization, withdraws the oldest grant and verifies public denial/replay. The separate [browser fixture](../evidence/m3/ui/r8-permission-history.json) loads50→100→150→200→205 rows, selects revision1, uses normal password reauthentication with reason preserved, then explicitly withdraws. The canonical editor immediately shows unpublished; all205 loaded rows remain. [Actual scoped worker](../evidence/m3/r8-content-worker-checks.json) changes the old row from pending to completed through singleton polling without reload. Browser shows not found; anonymous HTTP returns404/no-store.

**R9 CLOSED:** doctor/article history previously depended on the current draft image, hiding permission still used by PublishedV1 after pendingV2 removed its image. All five permission-capable kinds now retain history independently of current scopes. Empty/stale scope disables only a new grant and cannot dereference an absent selection. A new isolated native fixture uploads a generated PNG classified patient_derived, processes it, grants each resource's own use, publishesV1 and savesV2image:null. The [browser](../evidence/m3/ui/r9-image-history.json) reaches both historical grants. Doctor withdrawal prunes its image while the article's separate lawful image still loads; article withdrawal then prunes its image. Both text pages remain public. Actual API/native regression also proves old gateway404, removed alt/media, immutable snapshot unchanged and global asset still ready. [Anonymous post-withdrawal requests](../evidence/m3/revocation-anonymous-final.json) confirm the new browser fixtures.

Root typecheck caught the demo seeder's old permissions-list result cast after R8 changed command responses. The caller now uses ContentPermissionCommandResult and validates affected operation/revision/scope; full typecheck/lint pass. Completed-demo early return is actually verified (`reset:false`,17resources). Its newly typed grant-provisioning branch was **NOT_RUN after repair**, preserving completed browser edits; genuine grant responses are separately covered by actual integration. The first205-grant fixture invocation omitted M3_INTEGRATION and correctly refused before setup; the corrected explicit invocation completed. An end-page browser assertion expected a count label that disappears when no cursor remains; actual DOM inspection confirmed205 rows, revision1 and no remaining load button. These tool mismatches were not counted as product success before verification.

### Slice proof

| Slice | Integrated result and actual local proof |
| --- | --- |
| S09 | Specialties/groups, ordered many-to-many service links/related services and full lifecycle. Normal-login representative publication/pending/unpublish/republish browser; actual ordering/self/duplicate/cross-tenant/cursor/API/SQL cases; serviceV2 reverse discovery retains children pinned to eligibleV1. |
| S10 | Three ordinary locations, doctor profiles, exact/range/from prices and explicit applicability. Browser history/restore/conflict/invalid range/public pricing; accepted East-location CAPTCHA journey and A1/A2 shared lead. Actual fingerprint/idempotency/audit/RLS and S06 notice/capture/complete ten-table deletion; no branch role, booking or external email. |
| S11 | Case/gallery/testimonial, text/every-image scoped rights, private controlled media, withdrawal/invalidation/retry/fencing. Actual ordinary-S11 grant enforcement/native gallery pair+alt/caption pruning/global physical derivative purge; canonical text withdrawal and R8/R9 histories on browser. Resource invalidation owns zero copies. |
| S12 | Articles/categories/supplied attribution and ordered immutable FAQ reuse. Actual editors/public lists/details, browser FAQV1→V2 explicit parent adoption with second parent stillV1, current-generation/unpublish/graph/complete-payload/cursor cases. No automatic clinical-review claim. |

All eleven CMS editors were read from actual data. Four distinct CMS and four public layouts were checked at320/390/768/1024/1440px with bounded viewport/visible-control geometry and screenshots. Real denied, empty, loading, validation, outage/Enter retry, reauthentication, dirty input and conflict states are recorded above. This is not every browser/state/width combination or exact pixel parity. Browser ends on the main demo article and public service; temporary viewport overrides are reset.

### Final commands and results

Use project-local Bun1.4.3 from repository root. Raw logs remain private0600 under `.local`; filtered reports contain no credentials. Integration runner selects its five private env files and explicit M3 flag.

| Command / check | Actual final result / evidence |
| --- | --- |
| `./node_modules/.bin/bun --no-env-file scripts/check-m3.ts integration` | **PASS16tests/1597assertions**, zero fail/skip: core12/1362 + native media4/235. [Actual integration](../evidence/m3/integration-checks-1792150656431.json). |
| `./node_modules/.bin/bun --no-env-file test apps/admin apps/website` | **PASS109/392**,30files: admin77/261 + website32/131. Private `.local/m3-final-fe.log`, independently pinned. |
| `./node_modules/.bin/bun --no-env-file scripts/check-m3.ts unit` | **PASS30/128**, seven pure suites. [Pure report](../evidence/m3/unit-checks-1792150857615.json). Suites overlap FE; do not sum grand totals. |
| `./node_modules/.bin/bun --no-env-file run build` | **PASS exit0** admin/website/API; `.local/m3-final-build.log`; build precedes owned restart. |
| `./node_modules/.bin/bun --no-env-file run lint` | **PASS exit0** after final root caller repair; `.local/m3-final-lint.log`. |
| `./node_modules/.bin/bun --no-env-file run typecheck` | **PASS exit0**, sequentially after build/root caller repair; `.local/m3-final-typecheck.log`. Earlier failures are retained above. |
| Explicit M3 content worker, owned tenantA only | **PASS11bounded runs/10completed**, then idle, zero copied objects. [Worker report](../evidence/m3/r8-content-worker-checks.json); earlier six-completion run is separate. |
| `./node_modules/.bin/bun --env-file=.env scripts/m3-preservation.ts --local-m3 compare` | **PASS50tables/210406baseline rows/894files**, zero unexpected failures. [Preservation](../evidence/m3/preservation-1792150937419.json); named volatile exclusions/launcher metadata/log-prefix changes, not backup/restore. |
| `./node_modules/.bin/bun --no-env-file scripts/m3-runtime-checks.ts --local-m3` | **PASS3actual Bun listeners/6cases**, loopback/owned ancestry/executable verified. [Diagnostics](../evidence/m3/final-diagnostics.json); point-in-time only. |
| Anonymous post-withdrawal requests | **PASS** both pages200/image:null/media0/old alt removed; old image URLs404;205-case SSR404/no-store. [Actual reads](../evidence/m3/revocation-anonymous-final.json). |
| Final SSR/media/migrations/known-value scan/static package/diff | Exact refreshed outcomes and paths are in the [final snapshot](../evidence/m3/final-checks.json). |

Applied0025–0031 disk/DB hashes agree;0001–0024 and reserved0023 are preserved. No0032 was needed. Dependency declarations/version set and lockfile are unchanged; package.json adds M3 command aliases only. New native worker scopes belong only to new owned isolated tenants. The browser historical-image fixture's invalidation can remain pending in its unenrolled content-worker scope; public denial already applies. No automatic enrollment/dispatch is implied.

### Independent review and limits

[Independent review](../evidence/m3/review.md) is **CLOSED R1–R9**, with no open actionable P1/P2 source finding. Final pins contain130files (107app/script sources),39Next traces (29admin/10website) and1235existing traced paths:1221files/14directories, zero missing and zero advisory-chain hits. Built serving API/Next JS also has zero chain-name hits. Reviewer API pure9/50 and affected CMS13/51 pass; these overlap root suites. Root owns actual mutating/runtime proof. Shared mutable docs are outside the reviewer source pin.

**Audit remains FAIL/open:** high braces advisory, dev-only ESLint→fast-glob→micromatch chain; no published patch in the checked official advisory. Fresh independent M3 exposure assessment allows only this bounded local package, not an inherited M2 or Production waiver. Reassess2026-10-22 or earlier patch/dependency/exposure change and before Production. No silent dependency upgrade.

**NOT_RUN / outside proof:** operational backup/restore, natural retention/session waiting, every browser/state/width combination, production workload/SLO, EN/themes/domains/DNS/TLS, external email/provider, full MVP and Production. Historical failed/unknown/unexecuted records remain. Known-value secret scan excludes OCR/runtime memory/comprehensive discovery. Resource invalidation completion is separate from actual global physical purge cases. No production-ready claim.

Coordinator checklist: direct approval/latest restriction/ownership checked; representative rendered journey preceded visual expansion; contracts/output and independent findings reviewed; R1–R9 repaired within approval; affected actual tests/browser/runtime and shared records integrated; inherited acceptance/history preserved. **Next owner:** Khiêm reviews/accepts M3 separately using the demo and this record. Root retains local handoff accountability. S13–S18 and Git/deployment need separate direct scope. **No Git writes, commit, push or deployment were performed.**


## Human M3 acceptance — 2026-10-16

**HUMAN_ACCEPTED — Verified human decision.** Khiêm directly stated on2026-10-16, Asia/Saigon (Asia/Ho_Chi_Minh), in desktop thread `01a1442c-b412-7f63-b03f-b23c76825bf2`, acceptance turn `01a144a4-a9a9-7271-9b3c-4c4da88c4854`:

> Nghiệm thu M3. Cập nhật hồ sơ và trạng thái dự án, chưa commit/push/deploy.

Desktop `/root` verified the direct human source. M3 S09–S12 is HUMAN_ACCEPTED within the approved local package. S01–S08/AUTH/M1/M2 acceptance remains unchanged. Technical status remains CODE_INTEGRATED + VERIFIED_LOCAL. READY_FOR_USER_REVIEW and pending acceptance in the original saved plan, execution ledger, final local handoff and `docs/evidence/m3/final-checks.json` are historical checkpoints, superseded only for current human acceptance. Those source/evidence bytes remain unchanged. The master plan retains18slice IDs and five milestones. This decision adds no runtime proof, full-MVP/Production acceptance or S13–S18 execution authority.

**Proof boundaries preserved.** API/SQL/native16tests/1597assertions, FE109/392, root pure30/128, build/lint/typecheck, scoped browser/worker/preservation/runtime and independent review CLOSED R1–R9 retain exactly their final recorded scopes. Overlapping suites are not added into a grand total. All historical FAIL/Unknown/NOT_RUN remain unchanged. Audit high braces stays FAIL/open under the fresh independently reviewed bounded local-M3 assessment; reassess2026-10-22 or earlier patch/dependency/exposure change and before Production. No Production waiver or dependency upgrade follows. Operational backup/restore, natural waiting, exhaustive browser/state/width coverage, production scale/SLO, EN/themes/domains/DNS/TLS, external delivery and full MVP/Production remain unexecuted or outside this proof. Resource invalidation remains distinct from physical Media purge.

**Latest authority and ownership.** The latest instruction authorizes settled acceptance documentation/status updates only and explicitly prohibits commit/push/deploy. No new app, dependency, runtime, DB, worker, fixture or browser action is part of this update. Desktop `/root` in the source thread remains accountable for shared records and final integration. Native `/root/m3_acceptance_record` prepares proposed replacement bytes only in `/private/tmp`; the authorized matrix-launched medium CLI coordinator mechanically integrates the reviewed bundle without transferring desktop accountability. The bounded preparation/integration assignments end at handoff.

**Coordination provenance.** Category agent-artifact-generation requires exact medium. Native preparation runtime thread `01a144a5-6299-7902-bfef-f5dc9ba6ab02`, turn `01a144ab-ba3a-7041-82ec-f5126f71d470`, observed2026-10-16T12:24:27.495Z: kit-implementer, exact desktop parent, inherited gpt-6.1-sol, medium, helper PASS. Parent independently checks native metadata before integration. Desktop observed xhigh and its exact-medium check FAIL, so desktop performs no affected substantive writes; the supported matrix launcher selects medium for the bounded integration coordinator. Exact integration metadata and actual static results belong in the separate [acceptance record](../evidence/m3/acceptance-record.json). These are agent coordination observations, not a product dependency or quality guarantee.

**Documentation verification and limits.** The bounded acceptance record stores actual package-integrity, whitespace and focused consistency results after integration, plus before/after preservation hashes. Old evidence, review/pins/logs, application source, lockfile and dependencies remain unchanged. New app/build/test/browser/worker/DB checks are NOT_RUN for this documentation-only update; existing technical proof is reused without expansion. Original Kit/upstream/mirror/adaptation pins are preserved; only maintained AGENTS/README hashes and appended acceptance provenance change in the manifest. No new automation or memory update is authorized.

**Coordinator handoff.** Desktop `/root` reviews the concrete diff and retains final accountability. Khiêm controls further scope and TechNote level progression; silence grants no approval. S13–S18 needs separate direct authority. No Git writes, commit, push or deployment is performed by this update.
