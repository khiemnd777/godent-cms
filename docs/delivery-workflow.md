# GCMS-DELIVERY-001 v0.1 — Quy trình triển khai theo chặng

## Hiệu lực và phạm vi

**APPROVED_WORKFLOW.** Khiêm duyệt đề xuất GCMS-DELIVERY-001 v0.1 bằng yêu cầu trực tiếp **“Duyệt và lưu quy trình triển khai”**, ngày 2026-10-15, Asia/Ho_Chi_Minh. [Hồ sơ công việc](tasks/GCMS-DELIVERY-001.md) ghi nguồn phê duyệt, ownership và kết quả kiểm tra.

Đây là quy trình riêng của godent-cms, cụ thể hóa [team policy](team-policy.md), [team workflow](team-workflow.md) và [coordination templates](agent-coordination-templates.md). Tuân thủ thứ bậc instructions và quyền thực tế của môi trường. Tài liệu này không thay đổi policy chung, không cấp quyền thực thi và không tự phê duyệt một gói triển khai.

Kế hoạch vẫn là [GCMS-MASTER-PLAN-001 — Draft v0.2](project-plan.md), gồm 18 slices trong 5 chặng. [Mockup UI/UX v0.1+Lucide](design/admin-ui-ux.md) đã duyệt được cố định bằng [approved baseline](design/admin-mockup/approved-baseline.json). Phê duyệt quy trình và phê duyệt thiết kế không đồng nghĩa phê duyệt S01 hoặc ứng dụng.

## 1. Duyệt theo gói công việc

- Mặc định đề xuất một chặng thành một gói. Chỉ đưa vào gói những phần có phạm vi và điều kiện thực hiện rõ ràng; chỉ ra quyết định còn thiếu trước phần phụ thuộc.
- Gói cần xác định mục tiêu người dùng, slices/tasks, nguồn thiết kế, phạm vi trong/ngoài, ownership, contracts, phụ thuộc, quyền thực thi, effort và tiêu chí nghiệm thu/cách kiểm chứng.
- Ghi rõ các tác động được phép: ví dụ cài dependency trong dự án, chạy dịch vụ/Docker local, migration hoặc fixtures thử nghiệm nếu gói cần. Việc liệt kê không tự cấp quyền; người dùng phải duyệt phạm vi tương ứng.
- Sau khi người dùng duyệt gói, coordinator điều phối triển khai, kiểm tra và sửa lỗi thông thường trong phạm vi đã duyệt. Không xin duyệt lại từng file, task, bug hoặc bước kiểm tra.
- Nếu một phê duyệt bao gồm nhiều chặng, tiếp tục các chặng đó theo phụ thuộc mà không xin duyệt lại mỗi chặng. Hoàn thành chặng không tự cấp quyền cho chặng tiếp theo chưa được duyệt.
- Hỏi lại khi thiếu quyết định quan trọng, cần thay đổi đáng kể mục tiêu/phương án/giả định/ranh giới dữ liệu-quyền hoặc cần hành động ngoài phạm vi. Tiếp tục phần độc lập vẫn được phép.
- Lệnh dừng/replan mới nhất của người dùng chi phối phần bị ảnh hưởng. Không tiếp tục vì thời gian trôi qua, người dùng im lặng hoặc reviewer đã PASS.
- Git delivery, production/deploy, migration production, dịch vụ trả phí, cấu hình global, tích hợp ngoài mới và hành động phá hủy cần quyền rõ ràng theo policy; không gộp ngầm vào một gói local.

## 2. Chu trình thực hiện một gói

| Bước | Thực hiện | Kết quả cần có |
| --- | --- | --- |
| Chuẩn bị | Đối chiếu yêu cầu, quyết định, code, phụ thuộc, quyền hiện tại và mockup đã duyệt | Phạm vi rõ, quyết định còn thiếu xuất hiện đúng thời điểm |
| Lập kế hoạch | Chia slices/tasks, ownership, contracts, effort và cách kiểm chứng | Kế hoạch cụ thể để người dùng duyệt; Planning chỉ cho phép đọc/đề xuất trong chat nếu chưa có quyền lưu |
| Triển khai từng slice | Làm xuyên các lớp liên quan UI → API → DB → kết quả người dùng | Luồng thực sự hoạt động theo phạm vi; không chỉ UI/dữ liệu giả hoặc một lớp CRUD |
| Kiểm chứng và sửa | Kiểm tra theo rủi ro, đối chiếu UI, sửa nguyên nhân có căn cứ rồi kiểm tra lại | Bằng chứng từng tiêu chí với PASS/FAIL/NOT_RUN và giới hạn |
| Tích hợp và review | Coordinator đọc kết quả, giải quyết contracts/xung đột, kiểm tra kết quả chung; review độc lập khi rủi ro cần | Kết quả tương thích, không còn lỗi chặn đã xác định; không tạo review lặp chỉ vì đổi giai đoạn |
| Demo và bàn giao | Cung cấp URL, cách chạy, điều kiện/tài khoản thử được phép và kịch bản nghiệm thu | Người dùng có thể trực tiếp kiểm tra; kết quả kỹ thuật và quyết định nghiệm thu được ghi riêng |

S01 là ngoại lệ có chủ đích về kết quả: dựng nền tảng và shell chạy được, kiểm chứng Bun/kết nối trong phạm vi. Không tính đăng nhập, phân quyền, tenant context hoặc CMS CRUD là hoàn thành ở S01; các phần đó bắt đầu S02/S03.

Sau preflight bảo vệ dữ liệu/quyền phù hợp, chứng minh một luồng tối thiểu thực tế trước khi mở rộng. Không biến receipt, reviewer identity, session hoặc model/effort thành điều kiện khởi động ứng dụng.

## 3. Mốc kiểm chứng của năm chặng

| Chặng | Slices | Kết quả cần chứng minh |
| --- | --- | --- |
| 1 — Luồng đầu tiên | S01–S04 | Admin đăng nhập → soạn dịch vụ → xuất bản → khách gửi tư vấn → lead xuất hiện trong CMS |
| 2 — Vận hành và bảo vệ dữ liệu | S05–S08 | Theo dõi lead, retention/audit, upload/thu hồi ảnh, lịch sử và khôi phục nội dung hoạt động đúng |
| 3 — Nội dung nha khoa | S09–S12 | Quản lý và xuất bản đầy đủ các nhóm nội dung nha khoa lên website |
| 4 — Website và marketing | S13–S15 | Hai theme, section editor, landing page, VI/EN và SEO hoạt động xuyên suốt |
| 5 — Hoàn tất MVP local | S16–S18 | Hai cách truy cập website, canonical/redirect local, quota/lifecycle và nghiệm thu toàn bộ MVP |

Chặng là mốc quản lý, không phải hàng rào buộc mọi task chạy tuần tự. Dùng phụ thuộc thật trong [dependency waves](project-plan.md#dependency-waves-and-integration). Ví dụ: sau S03 có thể làm media hoặc lịch sử nội dung nếu đủ phụ thuộc và đã được duyệt; S06 không chờ toàn bộ S05; S14 không chờ section/theme không sử dụng. S02b có thể hoàn tất sau luồng xuất bản đầu tiên nhưng phải đóng trước S18 theo master plan.

Phần chưa hoàn tất phải ghi còn mở, owner, tiêu chí còn thiếu và ảnh hưởng phụ thuộc. Không đánh dấu toàn bộ slice/chặng đã Verified khi tiêu chí bắt buộc của nó chưa đạt. Vẫn cho phép phần độc lập, đã được duyệt tiếp tục. Chứng minh luồng cốt lõi không thay thế việc đóng toàn bộ phạm vi còn lại.

## 4. Đóng một slice và áp dụng mockup

Một slice chỉ được ghi **Verified** khi đạt các tiêu chí bắt buộc trong phạm vi, luồng chính đã chạy thực tế, các ngoại lệ/quyền/dữ liệu được kiểm tra theo rủi ro, có bằng chứng và giới hạn, và hồ sơ liên quan đã đồng bộ. [Acceptance criteria](acceptance-criteria.md) là nguồn nghiệp vụ; không tự hạ tiêu chí để đóng slice.

Giữ riêng các mức: đã viết/tích hợp code; đã kiểm chứng local; người dùng đã nghiệm thu; sẵn sàng production. Trạng thái không tạo quyền. Có thể dùng Planning, In Progress, Ready for Review, Integrated, Verified và lý do Blocked/Stopped theo workflow chung; không bắt mọi sửa đổi nhỏ đi qua một chuỗi trạng thái đầy đủ. CODE_COMPLETE_UNTESTED chỉ dùng cho bàn giao source tự kiểm thử mà người dùng yêu cầu, không thay thế mục tiêu kiểm chứng runtime/UI.

Khi triển khai giao diện:

1. Ghi đúng nguồn/version/hash của mockup v0.1+Lucide đã duyệt, phần cần giữ và khác biệt đã được duyệt. Giữ cấu trúc, bố cục, navigation, thứ tự thao tác, controls, responsive và Lucide theo baseline.
2. Chọn một màn hình đại diện và tiêu chí quan sát được. Với slice nghiệp vụ, nối controller và dữ liệu thật trong phạm vi trước khi mở rộng; S01 chỉ chứng minh shell đúng giới hạn của nó.
3. So sánh render ở viewport desktop/mobile tương ứng. Kiểm tra thao tác chính, focus/bàn phím, trạng thái có dữ liệu/trống/tải/lỗi/từ chối quyền khi áp dụng và khả năng nhìn/thao tác controls trong chính container. Không chỉ dựa vào build hoặc việc cả trang không tràn ngang.
4. Dùng các dòng phù hợp trong [template acceptance checklist](template-application-acceptance.md); không tạo bảng trạng thái cạnh tranh. Prerequisite thiếu phải ghi NOT_RUN sớm, có owner và bước tiếp theo.
5. Chỉ mở rộng UI phụ thuộc sau khi màn hình đại diện đạt tiêu chí. Đây là kiểm chứng trong quyền đã duyệt, không phải vòng duyệt mới của người dùng. Công việc độc lập vẫn có thể tiếp tục.
6. Loại bỏ/thay thế toolbar review, dữ liệu giả, logic mô phỏng trong bộ nhớ và thông báo dành riêng cho prototype khi nối nghiệp vụ thật. Những mục menu chưa có màn hình chi tiết không được coi là full MVP UX đã hoàn thành.

## 5. Team, ownership và effort khi chạy task

Coordinator chịu trách nhiệm mục tiêu, contracts, tích hợp, bằng chứng và báo cáo; chỉ coordinator hoặc writer được ủy quyền đúng phạm vi cập nhật hồ sơ chung. Implementer nhận files/module và tiêu chí cụ thể. Reviewer trả phát hiện theo câu hỏi/rủi ro, không tự sửa code hoặc deploy.

Chỉ delegate khi có lợi ích rõ ràng, được quyền và runtime hỗ trợ đúng vai trò; dùng các Kit roles theo hướng dẫn dự án, không thay ngầm bằng vai trò dự án khác. Một writer cho mỗi file/contract chung, thống nhất interface trước khi chạy song song, giữ thay đổi của người khác; child không delegate tiếp. Nếu không có agent độc lập, áp dụng vai trò tuần tự và nói rõ. Không dựng cả đội hoặc harness cho một việc nhỏ.

Áp dụng [task effort policy](task-effort-policy.md) và [matrix JSON](task-effort-policy.json) trước công việc thực chất. Tài liệu này không thay matrix:

- Phân tích yêu cầu/chọn stack: High theo loại task tương ứng. Thiết kế/review kiến trúc và các risk floors về isolation, auth/RBAC, dữ liệu nhạy cảm, toàn vẹn xuất bản/giao dịch: xHigh khi khớp policy.
- Implementation/tests thông thường theo contracts đã chốt: Medium; nâng theo task/risk floor áp dụng. Chọn mức cao nhất cho task hỗn hợp không thể tách, hoặc tách phần độc lập khi hữu ích.
- Giao một effort cụ thể, không giao khoảng Medium/High. Chỉ fallback chung khi không phân loại được loại task/rủi ro sau khảo sát hợp lý.
- Giữ model do developer chọn. Ghi required/requested/observed effort riêng; truyền mức effort bằng điều khiển runtime được hỗ trợ và đối chiếu metadata thực tế. Prompt nói “dùng xHigh” không phải bằng chứng runtime.
- Dùng runtime check tại ranh giới task có ý nghĩa và tái sử dụng khi task/turn/settings còn hợp lệ. Mismatch giữ phần công việc bị ảnh hưởng chờ phương án runtime được hỗ trợ; không đổi tên task, hạ effort hoặc đổi model để vượt kiểm tra.

Metadata effort/approval/reviewer chỉ thuộc hồ sơ điều phối, không trở thành dependency của ứng dụng.

## 6. Báo cáo, lỗi và bàn giao

Dùng [adaptive reports](technote.md#adaptive-reports). Cuối slice, báo ngắn: đã chạy được gì; bằng chứng; phần chưa đạt/giới hạn; việc tiếp theo và owner. Cuối chặng thêm kịch bản demo để người dùng nghiệm thu. Bàn giao phải có URL/commands/prerequisites thực tế và quyền/tài khoản thử khi được phép, không lộ secrets. Hiện chưa có application start/test/build command; chỉ ghi commands sau khi thực sự tồn tại và được kiểm tra.

Khi gặp API/UI/library error: dừng luồng bị ảnh hưởng, giữ bằng chứng, nêu nguyên nhân được chứng minh hoặc giả thuyết, files/consumers liên quan, cách sửa và phép kiểm tra xác nhận trước khi sửa. Sửa thông thường tiếp tục trong quyền còn hiệu lực; thay đổi phương án/ranh giới quan trọng cần người dùng quyết định. Nếu lỗi lặp cùng loại hoặc sửa không tiến triển tiêu chí nghiệm thu, đánh giá lại giả định và chọn bước chẩn đoán hữu hạn; không lặp mù hoặc tự restart/xóa dữ liệu. Phần độc lập vẫn tiếp tục.

Chọn checks theo rủi ro, không chạy mọi suite/build/browser/audit cho mọi sửa đổi. Tái sử dụng bằng chứng còn hiệu lực, kiểm tra lại phần bị thay đổi hoặc còn thiếu. Không xóa/tắt tests hay giảm assertion để có PASS. Không coi mock, source, screenshot đơn lẻ hoặc build là proof của runtime/security/production.

Hồ sơ chuẩn: [project context](project-context.md), [project plan](project-plan.md), [project state](project-state.md), một task record tương ứng trong docs/tasks. Plan là chỉ mục, state là tóm tắt, task giữ chi tiết; không tạo tracker cạnh tranh. Ghi nguồn phê duyệt hiện tại và latest stop, không kế thừa quyền từ template, tài liệu hay status của agent.

## Bước tiếp theo hiện tại

**S01 là gói đầu tiên được khuyến nghị để lập kế hoạch chi tiết.** Đối chiếu nền tảng Bun và các shell Platform Admin/Tenant CMS theo mockup đã duyệt trước khi mở rộng S02–S04. Việc lưu quy trình này không viết hoặc duyệt kế hoạch S01, không giao implementation owner và không chạy ứng dụng/Docker. Bước kế tiếp là đề xuất S01 cụ thể để người dùng review.
