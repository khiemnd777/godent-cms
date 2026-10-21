# Local website data-loading performance

Owner: desktop `/root`, chat `01a15d87-b03e-7333-8cb9-f92d54109f2c`, bounded to this package. Shared project records remain with their existing owners.

## Authority and scope — 2026-10-21

Khiêm: “Duyệt sửa hiệu năng trong phạm vi local như đề xuất. Triển khai và đo trước/sau, giữ nguyên kiểm tra quyền, publication và revocation. Chưa commit/push hoặc deploy.”

Latest direction: “high-effort đã đủ dùng rồi. Tiếp tục sửa hiệu năng local theo phạm vi đã duyệt, đo trước/sau và giữ nguyên kiểm tra quyền, publication, revocation. Chưa commit/push hoặc deploy.” This directly overrides the xHigh effort floor for this package only. Required by matrix: xHigh (`implementation`, publication-integrity risk). Human-requested: High. Observed prior/current desktop model: gpt-6.1-sol, High; the initial mismatch stopped implementation before writes. No global policy/settings change. No delegation; sequential implementation and self-review.

Approved outcome: remove repeated database work and oversized metadata reads; measure before/after on the existing local website. Local additive function migration, focused tests and local application rebuild/restart are within the approved repair. No retained migration rewrite, credential change, data reset, commit/push or deployment.

## Verified diagnosis and implementation plan

Starting source revision: `6671b87ae93acde1f1a81f2a1c8aff46d0767f8d`, with existing uncommitted hero typography work preserved. Existing changed-file hashes were captured privately before performance edits.

HTTP investigation: homepage 1.13–1.26 s; doctor list 6.63–6.75 s (three requests each). Doctor-list API 2.12–2.28 s; entry resolution 4–6 ms. SQL: one doctor projection 1.2 ms, decoration 256 ms, signature navigation 134 ms, eight-doctor list 2071 ms. A list rebuilds shared configuration for each card and language. Proxy, renderer and alternate-language metadata each read a full list.

1. Capture repeatable HTTP/API baseline and retained data/file fingerprints.
2. Add migration 0066. Reuse current eligible configuration only within one SQL statement; keep full publication/reference/media permission checks, graph and byte budgets, locale fallback and current revocation. Avoid reprojecting the same current page for its self alternate.
3. Bound alternate-language list discovery to one item using the existing page-size contract. Keep proxy revalidation, expected publication/config checks and all cross-request no-store behavior.
4. Prove exact output equivalence against prior SQL, permission/revocation behavior, focused FE/API checks and retained data. Compile then apply only the new local migration, rebuild the local application and repeat the same measurements.

Acceptance: materially lower measured doctor-list and homepage server times; existing public JSON stays equivalent; revoked/unpublished/draft/inactive content stays denied; tenant/host/context checks and byte/graph limits stay enforced; old data, applied checksums and unrelated files stay intact.

## Local result — 2026-10-21

CODE_INTEGRATED + VERIFIED_LOCAL for the bounded repair. Migration `0066_public_read_performance.sql` compiled in a rolled-back transaction, then applied locally after all 64 prior receipts/checksums matched. It changes function definitions and adds one migration receipt; no retained business data, schema constraints or old migration files change. Configuration is reused once per language within a statement. The owner-only decorator reuses the already-checked page for its own language alternate. Other-locale projections, published references, permissions, graph/byte budgets, expected context checks, proxy revalidation and no-store behavior remain. Website language metadata requests one item using the existing pagination contract.

The shared local application image built successfully; only the website container was recreated using existing UID/GID and retained infrastructure. No API/admin/worker restart, volume reset, credentials/configuration change, commit, push or deployment. The running website's source hash matches the edited file.

### Measured result

Same public HTTP probe, three sequential requests per route. Medians are response completion times, not browser paint. [Full comparison](../evidence/website-performance/comparison.json), [before](../evidence/website-performance/before.json), [isolated after](../evidence/website-performance/after-idle.json). The first after-pass overlapped typechecks; it is retained separately in `after.json` and is not the reported comparison.

| Route | Before | After | Reduction |
| --- | --- | --- | --- |
| Doctor list VI | 6.516 s | 0.796 s | 87.8% |
| Doctor list EN | 6.688 s | 0.686 s | 89.8% |
| Doctor-list API | 2.119 s | 0.306 s | 85.6% |
| Homepage EN | 1.104 s | 0.830 s | 24.8% |
| Homepage VI | 1.132 s | 1.122 s | Effectively unchanged |
| Homepage API | 0.563 s | 0.521 s | 7.5%; modest local result |

All sampled HTTP statuses are 200. Sampled homepage/doctor API JSON hashes are identical before/after. The primary repeated-list hotspot is corrected; a meaningful VI-homepage speedup is **not demonstrated**. No claim that every page is now fast or that this proves field Core Web Vitals.

### Verification and review

[Actual checks and source pins](../evidence/website-performance/checks.json):

- SQL regression: **5 tests / 56 assertions PASS**. Exact historical list JSON for twelve kinds in both locales; selected details; filters, limits and continuation; helper ACL denial; pending drafts; unpublish; active-publication text permission withdrawal; media withdrawal and foreign-tenant denial; tenant suspension; missing locale configuration/fallback. State perturbations were transaction-rolled-back against synthetic fixture content. No retained mutation committed.
- Website suite: **129 tests / 1421 assertions PASS**. Focused proxy/listing/metadata subset: 26/209 PASS. API contract/security subset: **32/338 PASS**.
- API, website and root TypeScript checks PASS. Owned TypeScript ESLint and whitespace checks PASS. Docker application build (admin, website, API) PASS.
- Actual browser: both VI/EN doctor lists render all eight items, and the actual VI→EN language link works. No VI console errors/warnings observed. Browser timing API unavailable in the exposed read scope; paint/hydration timing remains NOT_RUN.
- [Retained application data](../evidence/website-performance/preservation.json): **80 tables / 238945 rows**, identical row-multiset hashes. Auth schema excluded; no auth/session/credential operations performed. All **33 pre-existing modified/untracked files** retained their captured bytes. Existing hero typography work is untouched.
- Sequential self-review completed; **no independent reviewer ran**. Reviewed helper privileges, statement-local lifetime, raw-project-only callers, JSON-null handling, locale fallback, output budgets, stale context checks and preservation. No actionable blocker found within this scope.

Earlier failures remain recorded: test initially omitted owner-role setup; expected red assertion proved 0066 absent; first revocation fixture selected historical permission revision 2 while active publication used revision 3. The selector was corrected to the active publication's exact revision; the denial assertion stayed unchanged and passed. Original matrix mismatch remains FAIL in `effort.json`, superseded for this task only by Khiêm's direct High-effort override.

Existing advisory FAIL and all prior acceptance/Production limits remain unchanged. User acceptance is pending. Next: review the improved local doctor-list flow and the measured limits; investigate the remaining VI-homepage cost separately if useful. No automatic Git delivery or deployment follows.

## VI-homepage follow-up authority — 2026-10-21

Khiêm: “Tiếp tục điều tra và tối ưu trang chủ VI đang còn khoảng 1,12 giây. Dùng High, đo trước/sau và giữ nguyên kiểm tra quyền, publication, revocation. Chưa commit/push hoặc deploy.” Same bounded owner and restrictions; explicit High override renewed. Current runtime observation is High on gpt-6.1-sol; the matrix's xHigh comparison remains a known, directly human-overridden mismatch. No delegation or global policy change.

Read-only profile: VI full homepage projection 110 ms; action-free navigation homepage projection 20 ms; shared configuration VI 120 ms and EN 125 ms. Navigation repeatedly constructs complete target-page JSON merely to decide whether a link is available. The same target checks also run for hero actions. Full proxy and renderer reads remain necessary revalidation boundaries for this repair.

Plan: measure five sequential reads per route before/after. Add migration 0067 with an owner-only availability predicate that follows the existing projection's site, publication, generation, locale, text-permission and required-reference rules. Keep graph/byte admission in target resolution, exact locale fallback, and all full content/media projections and revocation checks. Use the predicate only for navigation/listing reachability and hero-action target resolution. No cross-request cache or public API shape change. Prove boolean equivalence to the original action-free projection, exact navigation/target output, transition/revocation cases and retained data before reporting an improvement. SQL-only runtime change requires no app restart. Existing 0066 and other applied migration bytes remain frozen.

Follow-up state: investigation complete; implementation and fresh checks/measurements in progress. Earlier results remain historical and valid within their recorded inputs.

## Kết quả tối ưu trang chủ VI — 2026-10-21

**CODE_INTEGRATED + VERIFIED_LOCAL**, chờ Khiêm nghiệm thu. Migration `0067_navigation_availability.sql` đã được compile và kiểm tra trong transaction rollback trước khi áp dụng local. Toàn bộ **65 checksum migration trước đó** khớp; hiện có 66 receipt. Không sửa bytes của migration cũ. Đây là thay đổi SQL nên không rebuild/restart ứng dụng, không đổi dữ liệu nghiệp vụ hay cấu hình.

Nguyên nhân: điều hướng và các nút hero dựng toàn bộ JSON nội dung, reference và media chỉ để xác định liên kết có thể hiển thị hay không. Hàm nội bộ `navigation_available` trả về điều kiện có thể truy cập, tương đương `project_core(..., false) IS NOT NULL`. Hàm giữ kiểm tra site/tenant đang hoạt động, publication hiện tại hoặc snapshot được pin, generation, locale, quyền văn bản và reference bắt buộc. Nhánh legacy tiếp tục dùng projection cũ. `target_path` vẫn chạy admission với giới hạn graph/bytes và fallback cũ. Việc trả nội dung/ảnh thực tế vẫn dùng đầy đủ projection và kiểm tra revocation hiện có. Không thêm cache xuyên request hoặc endpoint công khai.

### Đo trước/sau

[So sánh đầy đủ](../evidence/website-performance/home-comparison.json), [trước](../evidence/website-performance/home-before.json), [sau](../evidence/website-performance/home-after.json). Mỗi đường dẫn có năm request tuần tự; không chạy test/build đồng thời. Trung vị là thời gian hoàn tất phản hồi máy chủ, không phải thời gian paint của trình duyệt. Mốc 1,12 giây ở lần trước được giữ nguyên trong lịch sử; baseline mới được dùng để tính mức cải thiện.

| Đường dẫn | Trước | Sau | Giảm |
| --- | --- | --- | --- |
| Trang chủ VI | 0,980 s | **0,528 s** | **46,2%** |
| API trang chủ VI | 0,450 s | 0,270 s | 40,0% |
| Trang chủ EN | 0,686 s | 0,427 s | 37,7% |
| Danh sách bác sĩ VI | 0,692 s | 0,363 s | 47,5% |
| Danh sách bác sĩ EN | 0,569 s | 0,318 s | 44,1% |

Trang chủ VI trước tối ưu nằm trong khoảng 0,934–1,053 s; sau tối ưu 0,520–0,615 s. Hai khoảng tách biệt. Tất cả HTTP 200; JSON công khai của API trang chủ và danh sách bác sĩ có hash giống nhau ở cả mười mẫu trước/sau mỗi API. Profile thành phần sau tối ưu: projection trang chủ VI 77 ms; cấu hình VI/EN 57/54 ms, so với 110 và 120/125 ms trước đó. Đây là kết quả local, không suy rộng thành Core Web Vitals hay bằng chứng Production.

### Kiểm chứng và review

[Kết quả và source pins](../evidence/website-performance/home-checks.json):

- Trước áp dụng: 5 tests / 40 assertions PASS trong transaction rollback. Sau áp dụng: **10 SQL tests / 96 assertions PASS**. Bao gồm tương đương projection cho các variant/locale/giới hạn độ sâu, JSON điều hướng, ACL của helper, reference bắt buộc, quyền của snapshot được pin, unpublished/draft, media revocation, tenant isolation/suspension và fallback.
- Proxy/metadata: **26 tests / 209 assertions PASS**. API/root TypeScript và ESLint cho files thay đổi PASS. Whitespace trong phạm vi PASS. Build ứng dụng NOT_RUN vì thay đổi chỉ thuộc SQL; compile migration và HTTP thực tế đã đạt.
- Trình duyệt: trang chủ VI hiển thị đầy đủ; thao tác menu **Dịch vụ** mở đúng trang tổng quan và hiển thị nội dung. Không ghi nhận lỗi/warning console ở trang chủ. Paint/hydration timing vẫn NOT_RUN do Performance API không được công cụ hiện tại cung cấp.
- [Bảo toàn dữ liệu](../evidence/website-performance/home-preservation.json): **80 bảng / 238945 dòng không đổi**. Schema auth không nằm trong phép hash; không thực hiện thao tác auth/session/credential. Đối chiếu 49 files đã tồn tại: chỉ ba files thuộc task được cập nhật theo kế hoạch; không có sửa đổi ngoài phạm vi. Công việc hero typography, migration 0066 và bằng chứng cũ được giữ nguyên.
- Tự review tuần tự, **không có reviewer độc lập**. Đã rà tương đương điều kiện truy cập, reference bắt buộc/tùy chọn, legacy, generation/snapshot, ACL, admission/fallback và vòng đời không cache. Không phát hiện blocker có bằng chứng trong phạm vi local này.

Các lỗi test ban đầu được giữ trong hồ sơ: assertion đỏ đúng khi helper chưa tồn tại; thiếu ép kiểu JSON qua `text`; fixture thu hồi nhầm quyền của bản mới nhất thay vì snapshot cũ được trang chủ pin. Đã sửa setup/selector, không giảm assertion từ chối truy cập. Không có thay đổi fixture nào được commit vào dữ liệu.

Tiếp tục dùng High theo chỉ định trực tiếp; không sửa policy global. Quy định trao đổi tiếng Việt mới nhất của Khiêm được áp dụng từ phần báo cáo này. Audit FAIL và các giới hạn cũ vẫn giữ nguyên. **Chưa commit/push/deploy.** Bước tiếp theo khuyến nghị: Khiêm kiểm tra trang chủ VI và điều hướng để nghiệm thu kết quả local; không tự động phát sinh Git delivery hay triển khai.

## Review và nghiệm thu được ủy quyền — 2026-10-21

Chỉ định trực tiếp của Khiêm: “Review và nghiệm thu gói tối ưu hiệu năng local cho tôi. Dùng High, kiểm tra lại quyền, publication, revocation và bằng chứng trước/sau. Chưa commit/push hoặc deploy.” Đây là ủy quyền review/nghiệm thu local cho cùng owner; chưa phải phát biểu Khiêm trực tiếp HUMAN_ACCEPTED. High tiếp tục là override trực tiếp. Review tuần tự của cùng phiên, không giả nhận reviewer độc lập. Không cập nhật shared project records của owner khác.

**Phát hiện R1 — P2, đang sửa:** `0067.signature_navigation` thay nhánh listing bằng phép tìm nội dung eligible, làm mất contract của migration 0064: danh sách typed vẫn hiển thị khi rỗng; EN cần Published EN config head hợp lệ. Khi collection rỗng hoặc các nội dung bị unpublish/revoke, liên kết public bị ẩn dù private navigation vẫn cho phép. Test oracle lấy trực tiếp 0060 nên không bao gồm repair 0064; các fixture đầy đủ nội dung không tái hiện được lỗi này. Kết quả trước đó chỉ có giá trị trong các ca đã chạy, không chứng minh empty-list contract.

Chưa nghiệm thu khi R1 còn mở. Đây là regression của implementation đang được duyệt, sửa trong quyền triển khai local còn hiệu lực: thêm migration 0068 để khôi phục contract 0064, không sửa bytes 0067; sửa oracle theo đúng 0064 và thêm ca danh sách rỗng VI/EN + Published config head. Giữ availability predicate mới cho resource/hero targets và mọi kiểm tra quyền/publication/revocation.

Đã đối chiếu tám source pins của candidate ban đầu PASS; đã tính lại cả hai bảng trước/sau từ raw samples PASS. Đối chiếu catalog ban đầu bỏ sót biến đổi động `clock_timestamp()` của 0063 trên `project_core`; sẽ đưa đúng biến đổi đã có trong migration vào phép đối chiếu, không sửa hàm đang chạy để khớp phép kiểm tra.

### Quyết định nghiệm thu local

**ACCEPTED_UNDER_DELEGATED_AUTHORITY.** Desktop `/root` nghiệm thu gói tối ưu local theo chỉ định trực tiếp ở trên, sau khi sửa và kiểm tra lại R1. Đây là quyết định của owner dưới quyền được ủy nhiệm; không ghi nhận một phát biểu HUMAN_ACCEPTED của Khiêm. Phạm vi gồm migration 0066–0068, truy vấn metadata alternate-language giới hạn một phần tử và tests/scripts đo liên quan. Các trạng thái chờ nghiệm thu ở phần trước là checkpoint lịch sử. Không mở rộng nghiệm thu sang hero typography, milestone khác hay Production.

**R1 — P2 CLOSED.** Test mới tái hiện đúng lỗi trên 0067: danh sách rỗng trả 0 liên kết thay vì 2. Migration additive `0068_signature_listing_navigation.sql` khôi phục chính xác contract 0064 cho listing; không sửa bytes migration đã áp dụng. Resource/hero targets tiếp tục dùng predicate 0067. Oracle lịch sử đã bổ sung biến đổi 0064. Test kiểm tra cả danh sách rỗng VI/EN, EN config chưa Published và generation không khớp. Trước áp dụng, 6 tests/50 assertions PASS trong rollback; sau áp dụng, bộ SQL cuối PASS bên dưới. Các test cũ không bao phủ empty-list được giữ nguyên lịch sử, không dùng làm bằng chứng cho ca mới.

[Hồ sơ nghiệm thu cuối](../evidence/website-performance/acceptance.json) liên kết source pins, hash bằng chứng và logs. Kết quả thực tế:

- **11 SQL tests / 106 assertions PASS**: `PUBLIC_READ_PERFORMANCE_SQL=1 node_modules/.bin/bun --env-file=.local/s02.env test apps/api/test/navigation-availability.test.ts apps/api/test/public-read-performance.test.ts`. Kiểm tra quyền helper, tenant isolation/suspension, Published/draft/unpublish, generation, quyền văn bản đúng revision của snapshot, reference bắt buộc, media revocation và fallback. Mọi thay đổi fixture đều rollback.
- **26 FE tests / 209 assertions PASS**: `node_modules/.bin/bun test apps/website/proxy.test.ts apps/website/components/listing-alternates.test.ts apps/website/components/content-route.test.tsx`. API/root TypeScript, ESLint cho test/script thay đổi và whitespace trong phạm vi PASS.
- Catalog thực tế: **67 checksum migration**, **17 function bodies cùng owner/STABLE/SECURITY DEFINER/search_path**, **8 quyền gọi helper bị từ chối** đều PASS. Phép đối chiếu đã replay biến đổi động từ source 0063/0064/0068; lỗi thiếu input 0063 của công cụ audit được sửa, không sửa hàm runtime để khớp audit. Chín source pins của bản cuối khớp.
- **6 kiểm tra HTTP từ chối PASS**: CMS config ẩn danh 401; stale primary context 409; tenant không tồn tại 404; locale sai 400; hai website route với Host không hỗ trợ 421. Source `builder-route.tsx` trong container đang chạy khớp workspace. Không dùng credentials hay đọc nội dung private.
- **80 bảng / 238945 dòng** có row-multiset hash không đổi. Schema auth nằm ngoài phép hash; không thực hiện thao tác auth/session/credential. Trong 49 files đã có ở baseline, chỉ ba files thuộc task thay đổi theo kế hoạch; không có thay đổi ngoài phạm vi. Migration cũ, công việc hero typography và bằng chứng trước được bảo toàn.

### Đối chiếu hiệu năng bản cuối sau 0068

Đã tính lại cả hai bộ so sánh lịch sử từ raw samples: 12 cặp route PASS. Không dựng lại trạng thái trước tối ưu. Baseline dưới đây tái sử dụng `home-before.json` đã audit; bản cuối đo mới năm request tuần tự mỗi route, không chạy test/build đồng thời, lưu trong [acceptance-current.json](../evidence/website-performance/acceptance-current.json).

| Đường dẫn | Trước | Bản cuối | Giảm |
| --- | --- | --- | --- |
| Trang chủ VI | 0,980 s | **0,539 s** | **45,0%** |
| Trang chủ EN | 0,686 s | 0,417 s | 39,2% |
| Danh sách bác sĩ VI | 0,692 s | 0,368 s | 46,7% |
| Danh sách bác sĩ EN | 0,569 s | 0,294 s | 48,3% |
| API trang chủ VI | 0,450 s | 0,272 s | 39,5% |
| API danh sách bác sĩ VI | 0,274 s | 0,139 s | 49,3% |

Tất cả mẫu HTTP 200; API JSON canonical có hash giữ nguyên so với bản 0067, đã được đối chiếu với baseline ở lần trước. Đây là trung vị thời gian hoàn tất phản hồi local. Bằng chứng build/browser/full suite trước được tái sử dụng đúng phạm vi; không tuyên bố vừa chạy browser lại. SQL-only 0068 không cần rebuild/restart. Paint/hydration và Core Web Vitals thực tế vẫn NOT_RUN.

Review cuối là **tự review tuần tự, không có reviewer độc lập**. Không còn finding có bằng chứng đang mở trong phạm vi gói này. Audit `braces` vẫn FAIL/open cùng lịch reassessment và giới hạn cũ; không có Production waiver. High được dùng theo override trực tiếp, không sửa cấu hình global. **Chưa commit/push/deploy.**

Bước tiếp theo khuyến nghị: sử dụng và kiểm tra [trang chủ local](http://localhost:5892/lac-van) đã nghiệm thu. Nếu muốn giao qua Git, Khiêm cần chỉ định riêng phạm vi commit/push; nghiệm thu này không cấp quyền Git delivery hoặc deploy.

## Quyền Git delivery riêng gói hiệu năng — 2026-10-21

Chỉ định trực tiếp tiếp theo của Khiêm: “Commit và push riêng gói tối ưu hiệu năng local đã nghiệm thu, giữ nguyên các thay đổi hero typography chưa thuộc phạm vi. Chưa deploy.” Quyền mới chỉ bao gồm normal commit/push gói hiệu năng trên nhánh `main` hiện tại. Các câu chưa có quyền Git ở trên là checkpoint lịch sử; nghiệm thu local, giới hạn bằng chứng và audit FAIL/open không thay đổi. Không deploy.

Phạm vi: chín source files được pin trong `acceptance.json`, task record này và 29 files bằng chứng dưới `docs/evidence/website-performance/` (39 files tổng cộng). `builder-route.tsx` có đúng một hunk metadata thuộc hiệu năng; không có hunk hero typography trong file này. Migration 0065, fonts, UI/contracts, hero tests/scripts, task và bằng chứng riêng hero đều bị loại khỏi commit. Các phép đo đã nghiệm thu dùng local baseline có hero typography đang tồn tại; Git delivery này không đưa hero typography vào commit và không tạo bằng chứng cho một deployment từ checkout sạch.

Trước stage: `HEAD`, `origin/main` và đầu nhánh remote thực tế cùng `6671b87ae93acde1f1a81f2a1c8aff46d0767f8d`; index trống. Source/evidence pins của nghiệm thu khớp. Chạy lại bộ proxy/listing/content-route: **26 tests/209 assertions PASS**. Không đổi source sau bộ SQL cuối 11/106, nên tái sử dụng bằng chứng đó. Literal secret-pattern scan trong phạm vi PASS; không đọc credentials. Captured SHA-256 toàn bộ 72 files local đang thay đổi để kiểm tra bảo toàn sau Git delivery; chỉ task record được bổ sung đoạn này.

Đây là thao tác Git trên package đã chốt, không thiết kế lại permission/publication. Tiếp tục High theo chỉ định trực tiếp của Khiêm trong phạm vi gói. Runtime ghi nhận `gpt-6.1-sol/high`; phép so sánh mechanical `implementation/medium` trả mismatch exact-effort, được giữ như khác biệt với lựa chọn High trực tiếp, không sửa policy hoặc settings. Không delegate; owner hiện tại chịu trách nhiệm staging, review diff và xác minh remote. Bước tiếp theo của thao tác được duyệt là stage theo allowlist, kiểm tra staged diff/whitespace, normal commit/push và xác minh SHA remote cùng các files hero còn nguyên.
