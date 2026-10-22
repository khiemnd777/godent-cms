# GCMS-BRACES-001 — Loại bỏ cảnh báo braces trong dependency local

**Trạng thái mới nhất — 2026-10-22:** ACCEPTED_UNDER_DELEGATED_AUTHORITY cho bản sửa local; review tuần tự không có lỗi chặn. Khiêm đã cấp quyền commit/push riêng gói này trên `main` trong yêu cầu ghi ở phần cuối. Các trạng thái chưa nghiệm thu/chưa có quyền Git bên dưới là checkpoint trước đó, được giữ làm lịch sử. Không có quyền deploy hoặc Production.

## Phạm vi và quyền

- Ngày: 2026-10-22, Asia/Ho_Chi_Minh.
- Yêu cầu trực tiếp của Khiêm: `Sửa lỗi "cảnh báo braces"`.
- Delivery owner: desktop `/root`, thread `01a1612a-81d0-7a11-a3e0-23c1bbbefcb5`; chỉ sở hữu gói sửa dependency này, không tiếp nhận ownership các milestone trước.
- Được phép: sửa dependency/lockfile local, bản vá tương thích cho công cụ lint, regression tests, kiểm tra cài đặt/audit/lint/type/build liên quan và task record này.
- Không có quyền Git delivery/deploy/Production, migration, fixtures nghiệp vụ, thay credentials hoặc thay dữ liệu đã giữ lại. Giữ nguyên các bằng chứng FAIL/NOT_RUN lịch sử và file review HTML chưa được Git theo dõi có sẵn.
- Phân loại: `implementation` + `bun-runtime-compatibility`, matrix yêu cầu `high`. Runtime ghi nhận `gpt-6.1-sol`, `xhigh`; kiểm tra exact-match ban đầu FAIL. Khiêm trực tiếp chọn **“Tiếp tục ở xHigh”** trong cùng chat. Đây là ngoại lệ effort cho gói này; không sửa policy hoặc ghi kết quả FAIL thành PASS.
- Triển khai và self-review tuần tự; không có reviewer độc lập hoặc subagent.

## Nguyên nhân đã xác minh

`bun audit --json` với Bun local 1.4.3 trả exit 1 và advisory high [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Chuỗi dependency duy nhất trong lockfile:

`eslint-config-next@16.4.1 → @next/eslint-plugin-next@16.4.1 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3`.

Advisory chính thức vẫn ghi patched version **None** tại lần kiểm tra này. Cảnh báo liên quan đệ quy quá sâu trong parser/walkers; không có căn cứ gọi việc nâng cùng phiên bản hoặc ẩn advisory là bản sửa.

## Phương án sửa và tiêu chí

1. Chỉ thay `fast-glob` của đúng `@next/eslint-plugin-next@16.4.1` bằng alias `tinyglobby@0.2.17`, phiên bản đã tồn tại trong lockfile. Giữ phiên bản Next/ESLint/Bun và các quy tắc lint.
2. Consumer thực tế duy nhất dùng `globSync(pattern, { onlyDirectories: true })`. Lưu một Bun patch thêm `expandDirectories: false` vào consumer này, theo [migration guide](https://superchupu.dev/tinyglobby/migration). Nếu không có tùy chọn đó, thư mục con trở thành root ngoài ý muốn.
3. Dùng regression tests để kiểm tra thư mục chính xác, wildcard/brace patterns, root dạng mảng, thư mục không tồn tại/file và các lỗi `no-html-link-for-pages` vẫn được phát hiện. Lockfile không được resolve `braces`/`micromatch`/gói `fast-glob` gốc.
4. Cài lại với frozen lockfile và scripts disabled, chạy audit thực tế, lint, typecheck và build phù hợp. Dockerfile local phải copy patch trước bước frozen install.

Đây là bản thay dependency có pin theo phiên bản, không phải bản vá upstream của `braces`. Khi nâng Next ESLint, phải đánh giá lại override/patch và chạy regression tests; không áp alias này cho API fast-glob nói chung.

## Sửa tương thích phát hiện trong kiểm chứng

Sau `bun prune`, lần typecheck tiếp theo phát hiện `TS2307` tại `scripts/m3-performance.ts:3`: script import từ đường dẫn vật lý `../apps/api/node_modules/drizzle-orm`. Đường dẫn này không tồn tại trong bản cài hoisted sạch. Typecheck trước khi prune đã PASS; FAIL sau prune được giữ là kết quả trung gian, không che thành PASS.

Sửa tối thiểu: khai báo `drizzle-orm@0.45.4` làm dev dependency của root tooling, đúng phiên bản API đã dùng, và import theo tên package. Không có phiên bản/package resolution mới. Regression test xác nhận root tooling và API resolve cùng một instance. Chỉ sửa import; không chạy script hiệu năng, fixtures, truy vấn hoặc thao tác DB.

## Kiểm chứng và bàn giao

**CODE_INTEGRATED + VERIFIED_LOCAL cho bản sửa dependency; không phải nghiệm thu người dùng hoặc release.** [Bằng chứng tổng hợp](../evidence/braces-001/checks.json) ghi các kết quả và source hashes.

| Kiểm tra | Kết quả thực tế |
| --- | --- |
| Audit trước sửa | FAIL/exit 1: một advisory high cho braces, đúng GHSA ở trên |
| Regression trước sửa | RED: 6 PASS/1 FAIL, assertion về chuỗi dependency bị lỗi; 6 kiểm tra hành vi PASS |
| Frozen install hiện tại và bản sao sạch | PASS; Bun 1.4.3, offline, scripts disabled; package/lock/patch bytes không đổi |
| Audit bản cài cuối | PASS/exit 0, JSON `{}`, gồm cả dev dependencies; không ignore advisory |
| `bun run test:lint-globs` | PASS: 9 tests/15 assertions ở checkout hiện tại và bản sao sạch |
| `bun run typecheck` | PASS ở checkout hiện tại và bản sao sạch sau sửa import layout |
| `bun run lint` | PASS/0 warnings ở checkout hiện tại; gồm tests mới và toàn bộ phạm vi lint cũ |
| `bun run build` | PASS trong bản sao sạch cho Admin, Website, API |
| Lockfile diff | 544 package entries giữ nguyên; một alias thay `fast-glob` bằng `tinyglobby@0.2.17`; 15 entries không còn dùng được loại; không thêm package resolution mới |
| Installed graph | `braces` và `micromatch` không còn trong node_modules hiện tại hoặc bản cài sạch |
| Review | Self-review tuần tự: giữ lint rules, bản vá option tương thích, alias chỉ đúng phiên bản consumer, trustedDependencies không đổi, Docker copy patch trước install và copy tests; không có phát hiện chặn còn mở |

Ghi chú môi trường: sandbox ban đầu chặn npm DNS và ghi temp/cache; các lệnh cần thiết đã chạy qua cơ chế escalation chuẩn. Không tắt sandbox hoặc kiểm tra integrity. Bản cài sạch ban đầu tắt mọi scripts nên `bun run build` báo Bun postinstall chưa chạy. Sau khi đọc script và xác nhận optional binary đúng 1.4.3, chỉ chạy postinstall của `bun` đã có trong trustedDependencies tại bản sao tạm; không có npm/download fallback hoặc mở rộng trust. Lệnh build thông thường sau đó PASS. Không sửa runner/config để che lỗi.

Lockfile v3 là định dạng Bun dùng cho version-scoped overrides; manager vẫn pin 1.4.3. Source build được kiểm tra trong `/private/tmp/gcms-braces-001-d1pfaijd`, không copy `.env`/`.local` hoặc credentials. Không rebuild/start/stop Docker, không kiểm tra HTTP/browser/DB, không chạy lại nghiệp vụ hoặc bộ test tích hợp có tác dụng ghi; các bằng chứng nghiệp vụ cũ không được cấp thêm trạng thái PASS. Dockerfile đã được nối đủ đầu vào nhưng **Docker image build/runtime là NOT_RUN**.

Các task/evidence lịch sử cùng trạng thái FAIL/Unknown/NOT_RUN được giữ nguyên. Chỉ runbook thêm ghi chú audit hiện tại; không tiếp nhận ownership hoặc sửa quyết định của các milestone khác. Git index/HEAD giữ nguyên, file HTML chưa theo dõi có sẵn được giữ. Chưa commit/push/deploy. Cần tiếp tục giữ override và patch cùng nhau; khi nâng Next ESLint phải đánh giá lại và chạy tests.

## Bước tiếp theo

1. Khuyến nghị: Khiêm review bản sửa và bằng chứng local; không cần thêm quyền thực thi.
2. Nếu muốn đưa bản sửa lên Git, Khiêm cấp quyền commit/push riêng cho gói này; các thay đổi không liên quan vẫn nằm ngoài gói.

## Review, nghiệm thu được ủy quyền và quyền Git — 2026-10-22

**Nguồn quyền trực tiếp:** Khiêm yêu cầu **“Review và nghiệm thu bản sửa braces, commit, push”** trong desktop thread `01a1612a-81d0-7a11-a3e0-23c1bbbefcb5`, turn `01a16132-cc05-7982-95ac-f5efe51eedbb`. Yêu cầu này giao review/nghiệm thu local cho delivery owner và cấp quyền staging/commit/push thông thường trên `main` chỉ cho gói GCMS-BRACES-001. Không bao gồm file `docs/design/dental-go-plus/hero-typography-review.html` có sẵn hoặc quyền deploy/Production.

**Quyết định của delivery owner:** **ACCEPTED_UNDER_DELEGATED_AUTHORITY**, local only. Đây là quyết định nghiệm thu của `/root` theo yêu cầu của Khiêm, không phải trích dẫn giả rằng Khiêm tự tuyên bố HUMAN_ACCEPTED. Technical status giữ CODE_INTEGRATED + VERIFIED_LOCAL.

- Phân loại gói review/nghiệm thu bảo mật dependency: `final-architecture-security-audit`, required/requested/observed `xhigh/xhigh/xhigh`, model `gpt-6.1-sol`, runtime check PASS. Ngoại lệ effort của lần triển khai và FAIL ban đầu vẫn được giữ trong hồ sơ gốc.
- Trước mọi thay đổi tài liệu nghiệm thu: cả **8 source/document pins** của `checks.json` đều khớp, HEAD vẫn `c354cd037fe47f2fa1f29dfd9490468df29be8f1`, index rỗng. Bản cài sạch còn nguyên 6 đầu vào tương ứng. `checks.json` cùng task hash cũ là checkpoint lịch sử, không bị viết lại để che việc task có thêm phần nghiệm thu.
- Review toàn bộ diff, patch, tests, consumer Next thực tế và lock graph: alias chỉ áp cho đúng `@next/eslint-plugin-next@16.4.1`, consumer duy nhất dùng `globSync`, patch giữ `expandDirectories: false`, không tắt lint rule hoặc ignore advisory. Root Drizzle pin đúng phiên bản API; Docker copy đủ patch/tests; trustedDependencies không đổi. **Không có phát hiện chặn còn mở.**
- Chạy lại thực tế: audit exit 0/JSON `{}`; regression **9 tests/15 assertions PASS**; `git diff --check` PASS. Bằng chứng frozen install/lint/typecheck/build Admin–Website–API được tái sử dụng vì source và build inputs khớp hash, không chạy lại chỉ để tạo thêm log.
- Review/nghiệm thu do cùng delivery owner thực hiện tuần tự; **không có reviewer độc lập**. [Bằng chứng review và nghiệm thu](../evidence/braces-001/review-acceptance.json) ghi nguồn quyền, checks và source pins cuối.
- Đã fetch `origin`; `main` và `origin/main` không lệch commit tại preflight, không có active Git hooks. Gói Git gồm đúng 10 files của bản sửa/tài liệu/evidence. Dùng commit/push thông thường, không sửa lịch sử hoặc bypass hook/check. SHA và remote parity sau push được trả trong báo cáo chat cuối, tránh ghi một commit tự tham chiếu chính SHA của nó.
- Docker image build/runtime, HTTP/browser/DB và Production vẫn **NOT_RUN**; không chạy lại M3 performance, fixtures, workers hoặc migrations. Không biến nghiệm thu dependency thành nghiệm thu thêm luồng nghiệp vụ hoặc Production. Các giới hạn lịch sử còn nguyên.

**Bước tiếp theo trong quyền hiện có:** commit và push đúng gói đã nghiệm thu lên `origin/main`, xác nhận remote parity và file HTML ngoài gói vẫn nguyên vẹn. Sau giao Git, Khiêm có thể kiểm tra commit; deploy/rebuild runtime là quyền riêng nếu có yêu cầu tiếp theo.
