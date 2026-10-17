import type { ContentReference, DentalContent } from '../apps/api/src/contracts/m3';
import type { BuilderSection, M4Content, M4Kind, M4Locale, M4NavigationNode, SitePresentation } from '../apps/api/src/contracts/m4';
import { parseM4Content, parseSitePresentation } from '../apps/api/src/contracts/m4-validation';
import type { RichTextDocument } from '../apps/api/src/contracts/s03';
import type { ServiceMediaReference } from '../apps/api/src/contracts/s07';

type Copy = readonly [vi: string, en: string];
export interface LacVanSpecification { key: string; kind: M4Kind; slug: string; title: Copy; summary: Copy; phase: 'home' | 'catalog' }
export interface LacVanContentEntry { key: string; kind: M4Kind; slug: string; id: string | null; publicationIds: Partial<Record<M4Locale, string>> }
export interface LacVanContentContext {
  entries: LacVanContentEntry[];
  assets: { key: string; id: string | null; revision: number | null; processed: boolean; alt: { vi: string; en: string } }[];
  legacyServicePublicationId: string | null;
  promotionDates: { startAt: string; endAt: string };
}
const text = (copy: Copy, locale: M4Locale) => copy[locale === 'vi' ? 0 : 1];
const copy = (vi: string, en: string): Copy => [vi, en];
export const LACVAN_PRICE_UNITS = {
  implant: copy('răng', 'tooth'), orthodontics: copy('kế hoạch', 'treatment plan'), restorative: copy('răng', 'tooth'),
  preventive: copy('lần', 'visit'), children: copy('lần', 'visit'), wisdom: copy('răng', 'tooth'),
} as const;
export function lacVanPriceUnit(service: string, locale: M4Locale): string {
  if (!Object.hasOwn(LACVAN_PRICE_UNITS, service)) throw new Error('Unknown clinic price service');
  return text(LACVAN_PRICE_UNITS[service as keyof typeof LACVAN_PRICE_UNITS], locale);
}
export function lacVanDocument(...paragraphs: string[]): RichTextDocument {
  return { type: 'doc', version: 1, blocks: paragraphs.map(value => ({ type: value.startsWith('# ') ? 'heading' : 'paragraph', children: [{ type: 'text', text: value.startsWith('# ') ? value.slice(2) : value }] })) };
}

const services = [
  { key: 'implant', title: copy('Trồng răng Implant', 'Dental implants'), image: 'service-implant-consultation', summary: copy('Tìm hiểu lựa chọn phục hồi răng mất qua buổi thăm khám và kế hoạch phù hợp với bạn.', 'Explore tooth replacement options through an assessment and a plan shaped around you.'), detail: copy('Buổi tư vấn bắt đầu từ mong muốn ăn nhai, tình trạng răng miệng và thông tin sức khỏe bạn cung cấp. Bác sĩ giải thích các lựa chọn phục hồi, những bước cần đánh giá thêm và cách theo dõi sau điều trị.', 'Your consultation starts with your chewing needs, oral condition and health information. The dentist explains replacement options, any further assessment and follow-up care.') },
  { key: 'orthodontics', title: copy('Chỉnh nha', 'Orthodontics'), image: 'service-orthodontic-consultation', summary: copy('Trao đổi về sắp xếp răng, khớp cắn và những lựa chọn chỉnh nha trong sinh hoạt hằng ngày.', 'Discuss tooth alignment, your bite and orthodontic options that fit everyday life.'), detail: copy('Mỗi kế hoạch chỉnh nha cần một buổi đánh giá riêng. Bạn có thể trao đổi về mắc cài, khay trong, lịch hẹn, vệ sinh răng miệng và những giới hạn của từng lựa chọn trước khi quyết định.', 'Every orthodontic plan begins with an individual assessment. Discuss braces, clear aligners, visits, oral care and the limits of each option before deciding.') },
  { key: 'restorative', title: copy('Phục hình răng sứ', 'Restorative dentistry'), image: 'service-restorative-consultation', summary: copy('Cân nhắc hình dáng, chức năng và màu răng trong một kế hoạch phục hình có giải thích rõ ràng.', 'Consider shape, function and shade within a clearly explained restorative plan.'), detail: copy('Bác sĩ trao đổi về phần răng còn lại, nhu cầu sử dụng và mong muốn thẩm mỹ. Các lựa chọn vật liệu, phạm vi thực hiện và cách chăm sóc được giải thích trước khi bạn đồng ý điều trị.', 'The dentist discusses the remaining tooth structure, functional needs and appearance preferences. Materials, treatment scope and aftercare are explained before you agree to treatment.') },
  { key: 'preventive', title: copy('Nha khoa tổng quát', 'General dental care'), image: 'service-preventive-care', summary: copy('Dành thời gian cho thăm khám, vệ sinh răng miệng và những câu hỏi nhỏ trong cuộc sống.', 'Make time for examinations, oral care and the everyday questions that matter to you.'), detail: copy('Một cuộc hẹn có thể bắt đầu bằng việc lắng nghe điều bạn đang băn khoăn. Bác sĩ giải thích kết quả thăm khám, các lựa chọn chăm sóc và thời điểm theo dõi dựa trên tình trạng riêng của bạn.', 'A visit can begin with the question on your mind. Your dentist explains the examination findings, care options and follow-up timing for your individual situation.') },
  { key: 'children', title: copy('Nha khoa trẻ em', 'Children’s dentistry'), image: 'service-preventive-care', summary: copy('Một cuộc hẹn nhẹ nhàng để trẻ và gia đình làm quen với việc chăm sóc răng miệng.', 'A welcoming visit to help children and families get to know dental care.'), detail: copy('Gia đình có thể trao đổi trước về thói quen, những điều trẻ đang lo lắng và trải nghiệm thăm khám trước đây. Bác sĩ giới thiệu từng bước bằng cách phù hợp với độ tuổi và dành thời gian để phụ huynh đặt câu hỏi.', 'Families can share everyday routines, a child’s concerns and previous dental experiences. The dentist introduces each step in age-appropriate language and makes time for parents’ questions.') },
  { key: 'wisdom', title: copy('Tư vấn răng khôn', 'Wisdom tooth consultations'), image: 'service-digital-planning', summary: copy('Hiểu rõ việc đánh giá răng khôn và những lựa chọn cần trao đổi cùng bác sĩ.', 'Understand wisdom tooth assessment and the options to discuss with your dentist.'), detail: copy('Buổi trao đổi ghi nhận điều bạn đang quan tâm, lịch sử chăm sóc và thông tin cần đánh giá thêm. Bác sĩ giải thích lựa chọn theo dõi hoặc xử lý, các bước dự kiến và những điều cần chuẩn bị nếu có chỉ định riêng.', 'The consultation covers your concerns, care history and any further assessment needed. Your dentist explains observation or treatment options, the proposed steps and preparations for your individual plan.') },
] as const;
const doctors = [
  ['minh-an', 'Lê Minh An', 'Le Minh An', 'implant', 'Chăm sóc phục hồi và tư vấn Implant', 'Restorative care and implant consultations'],
  ['thanh-ha', 'Trần Thanh Hà', 'Tran Thanh Ha', 'orthodontics', 'Tư vấn chỉnh nha', 'Orthodontic consultations'],
  ['quang-huy', 'Nguyễn Quang Huy', 'Nguyen Quang Huy', 'restorative', 'Phục hình và thẩm mỹ răng', 'Restorative and aesthetic care'],
  ['duc-minh', 'Phạm Đức Minh', 'Pham Duc Minh', 'wisdom', 'Tư vấn và chăm sóc răng khôn', 'Wisdom tooth consultations and care'],
  ['bao-tram', 'Võ Bảo Trâm', 'Vo Bao Tram', 'preventive', 'Nha khoa tổng quát', 'General dental care'],
  ['ngoc-lan', 'Đỗ Ngọc Lan', 'Do Ngoc Lan', 'children', 'Nha khoa trẻ em và gia đình', 'Children’s and family dental care'],
  ['gia-khang', 'Lý Gia Khang', 'Ly Gia Khang', 'implant', 'Tư vấn phục hồi răng mất', 'Tooth replacement consultations'],
  ['hoang-nam', 'Bùi Hoàng Nam', 'Bui Hoang Nam', 'preventive', 'Chăm sóc răng miệng gia đình', 'Family dental care'],
] as const;
const locations = [
  ['an-nhien', 'Lạc Vân An Nhiên', 'Lac Van An Nhien', '18 đường Mây Trắng, khu An Nhiên, TP. Hồ Chí Minh', '18 May Trang Street, An Nhien Quarter, Ho Chi Minh City'],
  ['vuon-may', 'Lạc Vân Vườn Mây', 'Lac Van Vuon May', '36 đường Vườn Mây, khu Bình An, Bình Dương', '36 Vuon May Street, Binh An Quarter, Binh Duong'],
  ['ho-sen', 'Lạc Vân Hồ Sen', 'Lac Van Ho Sen', '12 đường Hồ Sen Nhỏ, khu Thanh Vân, Hà Nội', '12 Ho Sen Nho Street, Thanh Van Quarter, Hanoi'],
] as const;
const categories = [
  ['everyday', 'Chăm sóc mỗi ngày', 'Everyday care'], ['treatment', 'Hiểu về điều trị', 'Understanding treatment'], ['news', 'Nhịp sống Lạc Vân', 'Life at Lac Van'],
] as const;
const articles = [
  ['lan-kham-dau', 'Chuẩn bị cho lần thăm khám đầu tiên', 'Preparing for your first visit', 'everyday', 'service-preventive-care', 'Ghi lại điều bạn muốn trao đổi và mang theo thông tin chăm sóc trước đây nếu có.', 'Write down your questions and bring previous care information if available.'],
  ['tim-hieu-implant', 'Những câu hỏi nên trao đổi khi tìm hiểu Implant', 'Questions to discuss about dental implants', 'treatment', 'service-implant-consultation', 'Hỏi về các bước đánh giá, lựa chọn thay thế, chi phí và lịch theo dõi dự kiến.', 'Ask about assessment, alternatives, costs and the proposed follow-up schedule.'],
  ['hanh-trinh-chinh-nha', 'Một buổi tư vấn chỉnh nha gồm những gì?', 'What happens at an orthodontic consultation?', 'treatment', 'service-orthodontic-consultation', 'Chia sẻ mong muốn, tìm hiểu các lựa chọn và dành thời gian hỏi về sinh hoạt hằng ngày.', 'Share your goals, explore options and ask about everyday routines.'],
  ['khong-gian-lang-nghe', 'Một không gian dành cho sự lắng nghe', 'A place to be heard', 'news', 'facility-consultation-lounge', 'Không gian tư vấn riêng giúp bạn trao đổi những điều đang quan tâm một cách thoải mái.', 'A private consultation space gives you room to discuss what matters to you.'],
  ['ke-hoach-ro-rang', 'Đọc và trao đổi về kế hoạch điều trị', 'Reading and discussing your care plan', 'treatment', 'service-digital-planning', 'Đề nghị giải thích từng bước, phạm vi chi phí và những điều cần xác nhận trước khi bắt đầu.', 'Ask for an explanation of each step, the cost scope and what needs confirming before starting.'],
  ['lich-hen-phu-hop', 'Sắp xếp lịch hẹn phù hợp với nhịp sống', 'Making room for dental visits', 'everyday', 'hero-couple', 'Cho phòng khám biết khoảng thời gian thuận tiện và hỏi rõ cách thay đổi lịch khi cần.', 'Tell the clinic which times suit you and ask how to change a visit when needed.'],
  ['mau-rang-tu-nhien', 'Trao đổi về màu răng trong phục hình', 'Discussing tooth shades in restorative care', 'treatment', 'service-restorative-consultation', 'Ánh sáng, mong muốn cá nhân và những răng bên cạnh đều là chủ đề để trao đổi với bác sĩ.', 'Lighting, personal preferences and neighbouring teeth are useful topics to discuss with your dentist.'],
  ['cau-hoi-ve-noi-nha', 'Ghi lại câu hỏi trước buổi tư vấn nội nha', 'Questions for a root canal consultation', 'treatment', 'service-endodontic-consultation', 'Mô tả điều bạn cảm nhận, thời điểm xuất hiện và những chăm sóc đã thực hiện.', 'Describe what you have noticed, when it started and any care already received.'],
  ['gia-dinh-cung-quan-tam', 'Cùng gia đình quan tâm đến răng miệng', 'Making dental care a family conversation', 'everyday', 'hero-family', 'Một cuộc trò chuyện nhẹ nhàng giúp mỗi thành viên nói ra điều mình đang băn khoăn.', 'A calm conversation gives each family member room to share their questions.'],
  ['chi-phi-minh-bach', 'Hiểu phạm vi của một bảng chi phí', 'Understanding a dental cost estimate', 'treatment', 'service-digital-planning', 'Kiểm tra hạng mục bao gồm, hạng mục riêng và thời hạn áp dụng của kế hoạch được đề nghị.', 'Check included items, separate items and the validity period of the proposed plan.'],
  ['ngay-moi-lac-van', 'Một ngày mới tại Lạc Vân', 'A new day at Lac Van', 'news', 'facility-reception', 'Từ đón tiếp đến trao đổi riêng, mỗi bước được tổ chức để thông tin đến với bạn rõ ràng.', 'From reception to private discussion, each step is organised to keep information clear.'],
  ['luu-thong-tin-cham-soc', 'Lưu lại thông tin sau buổi tư vấn', 'Keeping your consultation notes', 'everyday', 'facility-consultation-lounge', 'Giữ bản kế hoạch và các hướng dẫn dành riêng cho bạn để thuận tiện hỏi lại trong lần hẹn sau.', 'Keep your individual plan and instructions so you can revisit questions at your next visit.'],
  ['dong-hanh-tung-buoc', 'Đồng hành từ câu hỏi đầu tiên', 'Here for the first question', 'news', 'facility-treatment-room', 'Bạn có thể bắt đầu bằng một yêu cầu tư vấn ngắn; phòng khám sẽ liên hệ để trao đổi bước phù hợp.', 'Start with a short consultation request; the clinic will contact you to discuss the next step.'],
] as const;
const articleDetails: Record<string, readonly Copy[]> = {
  'lan-kham-dau': [
    copy('# Trước khi đến phòng khám', '# Before your visit'),
    copy('Ghi lại lý do bạn muốn thăm khám và hai hoặc ba câu hỏi quan trọng nhất. Nếu có kế hoạch chăm sóc hoặc hình ảnh từ lần khám trước, hãy hỏi phòng khám xem bạn có cần mang theo không.', 'Write down why you would like a visit and your two or three main questions. If you have a previous care plan or images, ask the clinic whether you should bring them.'),
    copy('# Khi nhân viên liên hệ', '# When the team contacts you'),
    copy('Xác nhận cơ sở, thời gian dự kiến và ngôn ngữ trao đổi. Cho nhân viên biết nếu bạn cần hỗ trợ khi đến nơi. Gửi biểu mẫu trên website mới là bước tiếp nhận yêu cầu; lịch hẹn cần được xác nhận riêng.', 'Confirm the location, proposed time and preferred language. Tell the team if you need help on arrival. Submitting the website form starts an enquiry; an appointment requires separate confirmation.'),
  ],
  'tim-hieu-implant': [
    copy('# Làm rõ điều bạn mong muốn', '# Clarify what you want to discuss'),
    copy('Bạn đang quan tâm đến ăn nhai, khoảng mất răng hay việc sử dụng phục hình hiện tại? Mô tả điều muốn cải thiện giúp cuộc trao đổi tập trung vào nhu cầu của bạn thay vì một lựa chọn có sẵn.', 'Are you concerned about chewing, a missing tooth or an existing restoration? Describing what you want to address keeps the discussion focused on your needs rather than a preset choice.'),
    copy('# Những câu hỏi cho kế hoạch', '# Questions about the plan'),
    copy('Hỏi bác sĩ cần đánh giá những gì trước khi đưa ra đề nghị. Yêu cầu giải thích các lựa chọn thay thế, những bước dự kiến, phạm vi chi phí và lịch theo dõi. Chỉ thống nhất kế hoạch khi những câu hỏi quan trọng của bạn đã được làm rõ.', 'Ask what assessment is needed before a recommendation. Discuss alternatives, proposed steps, the scope of costs and follow-up visits. Agree on a plan once your main questions have been answered.'),
  ],
  'hanh-trinh-chinh-nha': [
    copy('# Bắt đầu bằng mục tiêu của bạn', '# Begin with your goals'),
    copy('Bạn có thể chia sẻ mong muốn về sắp xếp răng và những điều đang ảnh hưởng đến sinh hoạt. Bác sĩ sẽ trao đổi thông tin cần đánh giá trước khi đề nghị một kế hoạch chỉnh nha riêng.', 'Share your thoughts about tooth alignment and anything affecting everyday life. Your dentist will explain what needs assessment before proposing an individual orthodontic plan.'),
    copy('# Hỏi về cuộc sống trong quá trình chăm sóc', '# Ask about everyday life during care'),
    copy('Trao đổi về lịch hẹn, công việc, học tập và cách chăm sóc tại nhà. Nếu muốn tìm hiểu mắc cài hoặc khay trong, hãy yêu cầu giải thích những điểm cần cân nhắc của từng lựa chọn và cách xác nhận chi phí.', 'Discuss visits, work, study and home care. If you are considering braces or clear aligners, ask about the considerations for each option and how costs will be confirmed.'),
  ],
  'khong-gian-lang-nghe': [
    copy('# Một khoảng riêng cho câu hỏi', '# Room for your questions'),
    copy('Ánh sáng dịu, chỗ ngồi thoải mái và cuộc trò chuyện riêng tạo nên nhịp mở đầu tại Lạc Vân. Bạn có thể bắt đầu từ điều đang lo lắng hoặc đơn giản là một câu hỏi chưa biết hỏi ở đâu.', 'Soft light, comfortable seating and a private conversation set the pace at Lac Van. Begin with a concern, or simply a question you have not yet had the chance to ask.'),
    copy('# Thông tin rõ trước mỗi bước', '# Clear information before each step'),
    copy('Sau khi lắng nghe, nhân viên giới thiệu bước tiếp theo và người sẽ trao đổi cùng bạn. Bạn có thể đề nghị nhắc lại thông tin, ghi chú hoặc dành thêm thời gian xem xét kế hoạch.', 'After listening, the team explains the next step and who you will speak with. You can ask to hear information again, make notes or take more time to consider a plan.'),
  ],
  'ke-hoach-ro-rang': [
    copy('# Nhìn từng phần của kế hoạch', '# Read each part of the plan'),
    copy('Một kế hoạch dễ trao đổi cần làm rõ mục tiêu, các bước dự kiến và những thông tin còn chờ đánh giá. Đánh dấu những thuật ngữ bạn muốn bác sĩ giải thích bằng lời đơn giản.', 'A useful plan makes the goals, proposed steps and any outstanding assessment clear. Mark terms you would like your dentist to explain in plain language.'),
    copy('# Xác nhận trước khi đồng ý', '# Confirm before you agree'),
    copy('Hỏi phần nào đã nằm trong chi phí, phần nào có thể cần xác nhận thêm và khi nào kế hoạch được xem lại. Giữ một bản thông tin để thuận tiện trao đổi trong lần hẹn tiếp theo.', 'Ask what is included in the cost, what may need further confirmation and when the plan will be reviewed. Keep a copy to support the conversation at your next visit.'),
  ],
  'lich-hen-phu-hop': [
    copy('# Chọn khoảng thời gian thuận tiện', '# Share convenient times'),
    copy('Ghi lại vài khoảng thời gian phù hợp với công việc hoặc học tập. Khi gửi yêu cầu, cho phòng khám biết cơ sở mong muốn để nhân viên có thông tin trao đổi với bạn.', 'Note a few times that fit work or study. Include your preferred location in the request so the team can discuss suitable arrangements with you.'),
    copy('# Nếu lịch sinh hoạt thay đổi', '# If your routine changes'),
    copy('Trao đổi với nhân viên về cách thông báo thay đổi và những thông tin cần xác nhận lại. Không coi thời gian đã ghi trong lời nhắn là lịch hẹn cho đến khi phòng khám xác nhận.', 'Ask the team how to notify a change and what needs reconfirming. A time suggested in a message becomes an appointment only when confirmed by the clinic.'),
  ],
  'mau-rang-tu-nhien': [
    copy('# Diễn đạt điều bạn yêu thích', '# Explain your preferences'),
    copy('Thay vì chỉ chọn một màu, hãy nói về cảm giác tự nhiên mà bạn mong muốn và những điều bạn đang quan tâm ở nụ cười hiện tại. Buổi trao đổi giúp bác sĩ hiểu rõ mong muốn trước khi đánh giá lựa chọn.', 'Alongside a shade preference, describe the natural appearance you have in mind and your thoughts about your current smile. The discussion helps your dentist understand your goals before assessing options.'),
    copy('# Xem và hỏi trong buổi tư vấn', '# Look and ask during the consultation'),
    copy('Bạn có thể hỏi cách sử dụng bảng màu và ảnh tham khảo trong quá trình trao đổi. Hình ảnh hỗ trợ giao tiếp; vật liệu và phương án cuối cùng cần được xác nhận trong kế hoạch cá nhân.', 'Ask how shade guides and reference images are used in the discussion. Images help communication; materials and final choices need confirmation in your individual plan.'),
  ],
  'cau-hoi-ve-noi-nha': [
    copy('# Ghi lại điều đã quan sát', '# Note what you have noticed'),
    copy('Mô tả bằng từ ngữ của bạn điều đang cảm nhận và thời điểm xuất hiện. Nếu đã được chăm sóc ở nơi khác, mang thông tin có sẵn để bác sĩ biết bối cảnh khi trao đổi.', 'Describe what you have noticed in your own words and when it started. If you have received care elsewhere, bring available information to give your dentist context.'),
    copy('# Hiểu trước khi lựa chọn', '# Understand before choosing'),
    copy('Hỏi về những đánh giá còn cần thực hiện, các lựa chọn có thể cân nhắc và phạm vi chi phí. Không dùng một bài viết để tự xác định tình trạng hoặc lựa chọn điều trị cho riêng mình.', 'Ask about further assessment, the options to consider and the scope of costs. An article cannot determine your individual condition or treatment choice.'),
  ],
  'gia-dinh-cung-quan-tam': [
    copy('# Mỗi người một câu hỏi', '# A question from each person'),
    copy('Một thành viên có thể quan tâm đến lần khám đầu, người khác muốn hỏi về kế hoạch chăm sóc đang có. Dành chỗ cho từng câu hỏi giúp gia đình chuẩn bị cuộc trao đổi mà không áp chung một nhu cầu.', 'One family member may be thinking about a first visit; another may have questions about an existing care plan. Making room for each question helps everyone prepare without assuming the same needs.'),
    copy('# Chuẩn bị cùng trẻ', '# Preparing with children'),
    copy('Gia đình có thể hỏi phòng khám cách giới thiệu buổi hẹn cho trẻ và những thông tin cần chia sẻ trước. Cho nhân viên biết ngôn ngữ, cách xưng hô và điều trẻ đang lo lắng để cuộc trao đổi gần gũi hơn.', 'Ask the clinic how to introduce a visit to a child and what information to share beforehand. Tell the team about preferred language, names and any concerns so the conversation feels familiar.'),
  ],
  'chi-phi-minh-bach': [
    copy('# So sánh cùng một phạm vi', '# Compare the same scope'),
    copy('Một con số chỉ có ý nghĩa khi bạn hiểu hạng mục đi cùng. Khi đọc bảng giá, hỏi rõ đơn vị tính, vật liệu hoặc công việc được bao gồm và những phần được xác nhận riêng.', 'A number is useful when you understand what it covers. When reading a price list, clarify the unit, materials or work included and any separately confirmed items.'),
    copy('# Giữ lại thông tin đã thống nhất', '# Keep the agreed information'),
    copy('Sau thăm khám, đề nghị một bản kế hoạch có phạm vi chi phí để tiện xem lại. Nếu có thay đổi, trao đổi về lý do và phần cần xác nhận trước khi thực hiện bước tiếp theo.', 'After assessment, ask for a plan showing the scope of costs. If anything changes, discuss why and what needs confirming before the next step.'),
  ],
  'ngay-moi-lac-van': [
    copy('# Đón tiếp bằng sự rõ ràng', '# A clear welcome'),
    copy('Khi đến nơi, bạn được hướng dẫn xác nhận thông tin và biết bước tiếp theo của buổi hẹn. Khoảng chờ cũng là thời gian để bạn xem lại câu hỏi muốn trao đổi.', 'On arrival, the team explains how to confirm your details and what happens next. The waiting time gives you a moment to revisit the questions you want to ask.'),
    copy('# Khép lại bằng một bước tiếp theo', '# Finish with a next step'),
    copy('Trước khi rời phòng khám, bạn có thể nhắc lại những nội dung đã thống nhất và cách liên hệ khi cần làm rõ. Sự quan tâm được thể hiện qua những thông tin nhỏ nhưng hữu ích trong từng buổi hẹn.', 'Before leaving, review what has been agreed and how to clarify anything later. Thoughtful care includes the small, practical details that support each visit.'),
  ],
  'luu-thong-tin-cham-soc': [
    copy('# Tạo một nơi lưu dễ tìm', '# Keep notes easy to find'),
    copy('Giữ kế hoạch, hướng dẫn riêng và thông tin lịch hẹn cùng một nơi. Ghi ngày trao đổi và những câu hỏi còn muốn hỏi để không phải nhớ mọi thứ trong buổi tư vấn.', 'Keep your plan, individual instructions and appointment details together. Note the discussion date and any remaining questions so you do not need to remember everything during the consultation.'),
    copy('# Bảo vệ thông tin cá nhân', '# Look after personal information'),
    copy('Chỉ chia sẻ hồ sơ với người hỗ trợ việc chăm sóc khi cần. Ô lời nhắn trên website dành cho yêu cầu tư vấn ngắn; hãy hỏi phòng khám về cách cung cấp hồ sơ nếu được đề nghị.', 'Share records only when needed with people helping with your care. The website message field is for a short enquiry; ask the clinic how to provide records if requested.'),
  ],
  'dong-hanh-tung-buoc': [
    copy('# Không cần biết sẵn mọi câu trả lời', '# You do not need all the answers'),
    copy('Bạn có thể gửi một yêu cầu ngắn về điều muốn trao đổi và cơ sở mong muốn. Nhân viên sẽ liên hệ để làm rõ nhu cầu thay vì yêu cầu bạn tự chọn ngay một kế hoạch điều trị.', 'Send a short request about what you want to discuss and your preferred location. The team will contact you to understand your needs rather than expecting you to choose a treatment plan first.'),
    copy('# Một cuộc trò chuyện có điểm tiếp nối', '# A conversation with a next step'),
    copy('Sau khi tiếp nhận, phòng khám trao đổi cách sắp xếp buổi tư vấn và thông tin cần chuẩn bị. Thời gian cụ thể chỉ được xác nhận khi hai bên đã thống nhất.', 'After receiving your request, the clinic discusses consultation arrangements and what to prepare. A specific time is confirmed only once agreed with you.'),
  ],
};
const faqs = [
  ['first-visit', 'Tôi cần chuẩn bị gì trước lần hẹn đầu?', 'What should I bring to my first visit?', 'Bạn có thể ghi lại câu hỏi, thông tin sức khỏe và các chăm sóc nha khoa trước đây. Nhân viên sẽ trao đổi thêm về thông tin cần thiết khi xác nhận lịch.', 'Bring your questions, health information and details of previous dental care. The team will explain any other information needed when confirming your visit.'],
  ['appointment', 'Gửi yêu cầu tư vấn có phải là đặt lịch thành công?', 'Does sending a request confirm an appointment?', 'Biểu mẫu ghi nhận yêu cầu của bạn. Phòng khám cần liên hệ để trao đổi và xác nhận thời gian trước khi có lịch hẹn.', 'The form records your request. The clinic will contact you to discuss and confirm a time before an appointment is arranged.'],
  ['cost', 'Chi phí được xác định như thế nào?', 'How are treatment costs confirmed?', 'Bảng giá giúp bạn tham khảo các hạng mục. Chi phí và phạm vi thực hiện được bác sĩ trao đổi sau khi thăm khám và trước khi bạn đồng ý điều trị.', 'The price list introduces the available items. Costs and treatment scope are discussed after an assessment and before you agree to treatment.'],
  ['language', 'Tôi có thể trao đổi bằng tiếng Anh không?', 'Can I request a consultation in English?', 'Bạn có thể chọn ngôn ngữ mong muốn trong biểu mẫu. Nhân viên sẽ trao đổi khả năng sắp xếp khi liên hệ xác nhận.', 'Choose your preferred language in the request form. The team will discuss arrangements when contacting you.'],
] as const;
const stories = [
  ['mai-phuong', 'Mai Phương', 'Mai Phuong', 'orthodontics', 'thanh-ha', 'Bắt đầu từ một câu hỏi về nụ cười', 'Starting with a question about a smile'],
  ['tuan-kiet', 'Tuấn Kiệt', 'Tuan Kiet', 'restorative', 'quang-huy', 'Dành thời gian hiểu các lựa chọn', 'Taking time to understand the options'],
  ['thu-huong', 'Thu Hương', 'Thu Huong', 'preventive', 'bao-tram', 'Một cuộc hẹn cho bản thân', 'Making time for personal care'],
  ['minh-triet', 'Minh Triết', 'Minh Triet', 'implant', 'gia-khang', 'Trao đổi để có kế hoạch rõ ràng', 'A conversation for a clearer plan'],
] as const;
export const LACVAN_TESTIMONIAL_QUOTES = {
  'mai-phuong': copy('Tôi muốn bắt đầu từ những câu hỏi nhỏ: lịch hẹn ra sao, sinh hoạt có gì cần lưu ý và từng bước sẽ được giải thích như thế nào.', 'I would start with the small questions: how visits fit my routine, what everyday care involves and how each step will be explained.'),
  'tuan-kiet': copy('Khi cân nhắc phục hình, tôi quan tâm đến vẻ tự nhiên và phạm vi chi phí. Tôi muốn hiểu từng lựa chọn trước khi quyết định.', 'When considering a restoration, I care about a natural appearance and a clear cost breakdown. I want to understand each option before deciding.'),
  'thu-huong': copy('Giữa những việc của gia đình, tôi muốn dành một buổi hẹn cho bản thân. Một cuộc trò chuyện nhẹ nhàng sẽ giúp tôi nói ra những điều còn băn khoăn.', 'Between family commitments, I want to make time for my own care. A calm conversation would give me room to share the questions I have put aside.'),
  'minh-triet': copy('Với tôi, kế hoạch cần dễ theo dõi: bước nào trước, cần chuẩn bị gì và khi nào hỏi lại. Hiểu rõ những điều đó giúp tôi chủ động sắp xếp thời gian.', 'I look for a plan I can follow: what comes first, what to prepare and when to ask more questions. Clear information would help me organise my time.'),
} as const;
export function lacVanTestimonialQuote(person: string, locale: M4Locale): string {
  if (!Object.hasOwn(LACVAN_TESTIMONIAL_QUOTES, person)) throw new Error('Unknown clinic perspective');
  return text(LACVAN_TESTIMONIAL_QUOTES[person as keyof typeof LACVAN_TESTIMONIAL_QUOTES], locale);
}
const pages = [
  ['about', 'gioi-thieu', 'Về Nha khoa Lạc Vân', 'About Lac Van Dental', 'home'],
  ['services', 'tong-quan-dich-vu', 'Chăm sóc cho từng nụ cười', 'Care for every smile', 'home'],
  ['prices', 'chi-phi-dieu-tri', 'Chi phí điều trị', 'Treatment costs', 'home'],
  ['contact', 'lien-he', 'Kết nối với Lạc Vân', 'Connect with Lac Van', 'home'],
  ['visit', 'huong-dan-tham-kham', 'Hướng dẫn thăm khám', 'Planning your visit', 'home'],
  ['privacy', 'chinh-sach-bao-mat', 'Thông tin riêng tư', 'Your privacy', 'home'],
  ['aftercare', 'cham-soc-sau-tu-van', 'Sau buổi tư vấn', 'After your consultation', 'home'],
  ['spaces', 'khong-gian-lac-van', 'Không gian Lạc Vân', 'Our clinic spaces', 'home'],
] as const;
function spec(key: string, kind: M4Kind, slug: string, title: Copy, summary: Copy, phase: 'home' | 'catalog' = 'home'): LacVanSpecification { return { key, kind, slug, title, summary, phase }; }
export const LACVAN_SPECIFICATIONS: readonly LacVanSpecification[] = [
  ...services.map(s => spec(`specialty-${s.key}`, 'specialty', `chuyen-khoa-${s.key}`, s.title, s.summary)),
  spec('group-care', 'service_group', 'cham-soc-rang-mieng', copy('Chăm sóc răng miệng', 'Dental care'), copy('Từ câu hỏi đầu tiên đến kế hoạch chăm sóc rõ ràng.', 'From your first question to a clear care plan.')),
  ...locations.map(l => spec(`location-${l[0]}`, 'location', l[0], copy(l[1], l[2]), copy('Không gian gần gũi để trao đổi và chăm sóc nụ cười.', 'A welcoming place to talk about and care for your smile.'))),
  ...categories.map(c => spec(`category-${c[0]}`, 'category', c[0], copy(c[1], c[2]), copy('Những điều hữu ích để chuẩn bị cho cuộc trò chuyện cùng bác sĩ.', 'Useful starting points for your conversation with a dentist.'))),
  ...services.map(s => spec(`service-${s.key}`, 'service', s.key, s.title, s.summary)),
  ...faqs.map(f => spec(`faq-${f[0]}`, 'faq', f[0], copy(f[1], f[2]), copy(f[3], f[4]))),
  ...doctors.map(d => spec(`doctor-${d[0]}`, 'doctor', d[0], copy(`Bác sĩ ${d[1]}`, `Dr ${d[2]}`), copy(d[4], d[5]))),
  ...services.map(s => spec(`price-${s.key}`, 'price', `chi-phi-${s.key}`, s.title, copy('Chi phí tham khảo; kế hoạch cụ thể được trao đổi sau thăm khám.', 'Indicative cost; your individual plan is discussed after assessment.'))),
  spec('gallery-spaces', 'gallery', 'khong-gian-tu-van-va-cham-soc', copy('Từ trao đổi đến chăm sóc', 'From conversation to care'), copy('Hai góc nhìn trong không gian Lạc Vân.', 'Two views of the Lac Van clinic spaces.')),
  spec('gallery-welcome', 'gallery', 'khong-gian-don-tiep', copy('Một khoảng dừng dễ chịu', 'A welcoming pause'), copy('Khám phá không gian đón tiếp và tư vấn riêng.', 'Explore our reception and private consultation spaces.')),
  ...stories.map((s, i) => spec(`case-${s[0]}`, 'case', s[0], copy(s[5], s[6]), copy(`Câu chuyện minh họa cùng ${s[1]} về những điều cần trao đổi trước khi bắt đầu.`, `An illustrated story with ${s[2]} about the questions to ask before getting started.`), i < 3 ? 'home' : 'catalog')),
  ...stories.map((s, i) => spec(`testimonial-${s[0]}`, 'testimonial', `loi-chia-se-${s[0]}`, copy(`Chia sẻ cùng ${s[1]}`, `A conversation with ${s[2]}`), copy('Một góc nhìn về sự lắng nghe và thông tin rõ ràng.', 'A perspective on being heard and receiving clear information.'), i < 3 ? 'home' : 'catalog')),
  ...articles.map((a, i) => spec(`article-${a[0]}`, 'article', a[0], copy(a[1], a[2]), copy(a[5], a[6]), i < 4 ? 'home' : 'catalog')),
  spec('promotion', 'promotion', 'hen-ban-mot-nu-cuoi', copy('Hẹn bạn một nụ cười', 'Make time for your smile'), copy('Dành một khoảng thời gian để trao đổi về kế hoạch chăm sóc răng miệng.', 'Set aside time to discuss your dental care plans.')),
  spec('landing', 'landing', 'bat-dau-cung-lac-van', copy('Bắt đầu cùng Lạc Vân', 'Begin with Lac Van'), copy('Chia sẻ điều bạn quan tâm. Chúng tôi sẽ liên hệ để trao đổi bước tiếp theo.', 'Tell us what matters to you. Our team will contact you to discuss the next step.')),
  ...pages.map(p => spec(`page-${p[0]}`, 'page', p[1], copy(p[2], p[3]), copy('Lắng nghe kỹ hơn, giải thích rõ hơn, đồng hành từng bước.', 'Listening carefully, explaining clearly and taking each step together.'), p[4])),
  spec('home', 'home', 'home', copy('Nha khoa Lạc Vân — Nâng niu từng nụ cười', 'Lac Van Dental — Care for every smile'), copy('Một không gian để được lắng nghe và hiểu rõ lựa chọn chăm sóc răng miệng của bạn.', 'A place to be heard and understand your choices in dental care.')),
];
export function lacVanEntry(context: LacVanContentContext, key: string): LacVanContentEntry {
  const entry = context.entries.find(e => e.key === key); if (!entry) throw new Error('Missing clinic content dependency'); return entry;
}
export function lacVanReferences(context: LacVanContentContext, locale: M4Locale, ...keys: string[]): ContentReference[] {
  return keys.map(key => { const e = lacVanEntry(context, key), publicationId = e.publicationIds[locale]; if (!e.id || !publicationId || ['home', 'page', 'landing', 'promotion'].includes(e.kind)) throw new Error('Unpublished clinic reference'); return { kind: e.kind, id: e.id, publicationId } as ContentReference; });
}
function image(context: LacVanContentContext, key: string, locale: M4Locale): ServiceMediaReference {
  const a = context.assets.find(a => a.key === key); if (!a?.id || !a.revision || !a.processed) throw new Error('Clinic media is not ready'); return { assetId: a.id, revision: a.revision, alt: a.alt[locale] };
}
export function lacVanContent(context: LacVanContentContext, item: LacVanContentEntry, locale: M4Locale, legacyIdentity = false): M4Content {
  const s = LACVAN_SPECIFICATIONS.find(s => s.key === item.key); if (!s || s.kind !== item.kind || s.slug !== item.slug) throw new Error('Clinic content plan changed');
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const title = text(s.title, locale), summary = text(s.summary, locale), base = { slug: s.slug, title, summary, seo: { title: `${title} | ${t('Lạc Vân', 'Lac Van')}`.slice(0, 160), description: summary } };
  const links = (...keys: string[]): ContentReference[] => {
    if (!legacyIdentity) return lacVanReferences(context, locale, ...keys);
    if (item.kind !== 'price') return [];
    const service = lacVanEntry(context, 'service-implant'); if (!service.id || !context.legacyServicePublicationId) throw new Error('Legacy price service pin required');
    return [{ kind: 'service', id: service.id, publicationId: context.legacyServicePublicationId }];
  };
  const introductory = lacVanDocument(summary, t('Chúng tôi dành thời gian nghe điều bạn quan tâm và giải thích các lựa chọn trước khi cùng bạn xác định bước tiếp theo.', 'We take time to hear your concerns and explain the options before agreeing on the next step together.'));
  if (item.kind === 'service') {
    const service = services.find(v => item.key === `service-${v.key}`)!;
    return parseM4Content('service', { ...base, body: lacVanDocument(`# ${t('Bắt đầu từ nhu cầu của bạn', 'Start with your needs')}`, text(service.detail, locale), `# ${t('Buổi tư vấn tại Lạc Vân', 'Your consultation at Lac Van')}`, t('Thăm khám và trao đổi mong muốn. Giải thích lựa chọn, chi phí dự kiến và các bước thực hiện. Thống nhất kế hoạch sau khi bạn đã có đủ thông tin.', 'Discuss your needs and assessment. Review the options, estimated costs and proposed steps. Agree on a plan once you have the information you need.'), `# ${t('Những điều nên trao đổi', 'Questions to bring')}`, t('Bạn muốn cải thiện điều gì? Có thông tin sức khỏe hoặc chăm sóc trước đây nào cần chia sẻ? Những lịch hẹn nào phù hợp với sinh hoạt của bạn?', 'What would you like to address? Is there health information or previous care to share? Which visit times fit your routine?')), coverImage: image(context, service.image, locale), contentLinks: { references: links(`specialty-${service.key}`, 'group-care', 'location-an-nhien') } });
  }
  if (item.kind === 'promotion') return parseM4Content('promotion', { ...base, kind: 'promotion', body: introductory, ...context.promotionDates, authoredTimezone: 'Asia/Ho_Chi_Minh', conditions: t('Chương trình tiếp nhận yêu cầu tư vấn trong thời gian công bố. Không áp dụng giảm giá tự động. Nội dung tư vấn, chi phí và lịch hẹn cần được phòng khám xác nhận riêng sau khi trao đổi nhu cầu.', 'Consultation enquiries are welcome during the stated period. No automatic discount applies. Consultation scope, costs and appointment times require individual confirmation by the clinic.'), references: links('service-preventive', 'location-an-nhien', 'price-preventive') });
  if (['home', 'page', 'landing'].includes(item.kind)) {
    const action = (key: string, label: string) => { const e = lacVanEntry(context, key); if (!e.id) throw new Error('Missing clinic action identity'); return { label, target: { kind: e.kind, id: e.id, locale }, allowViFallback: false }; };
    const sections: BuilderSection[] = [];
    const section = (type: 'services' | 'doctors' | 'locations' | 'prices' | 'cases' | 'gallery' | 'testimonials' | 'articles' | 'faq', heading: string, keys: string[]) => sections.push({ id: type, type, hidden: false, title: heading, references: links(...keys), required: true });
    const serviceKeys = services.map(s => `service-${s.key}`), locationKeys = locations.map(l => `location-${l[0]}`);
    const form = () => sections.push({ id: 'consultation', type: 'consultation', hidden: false, title: t('Bắt đầu bằng một cuộc trò chuyện', 'Start with a conversation'), promotion: null, serviceOptions: item.kind === 'home' ? [] : links(...serviceKeys), locationOptions: links(...locationKeys) });
    if (item.kind === 'home') {
      sections.push({ id: 'welcome', type: 'hero_carousel', hidden: false, autoplay: true, intervalMs: 7000, slides: [
        { id: 'family', title: t('Nâng niu từng nụ cười', 'Care for every smile'), text: t('Lắng nghe bạn. Hiểu điều bạn cần. Cùng chọn bước tiếp theo.', 'Listening to you. Understanding your needs. Choosing the next step together.'), image: image(context, 'hero-family', locale), action: action('page-contact', t('Trao đổi cùng Lạc Vân', 'Talk with Lac Van')) },
        { id: 'care', title: t('An tâm từ sự thấu hiểu', 'Confidence begins with understanding'), text: t('Một kế hoạch rõ ràng bắt đầu từ cuộc trò chuyện cởi mở.', 'A clear plan begins with an open conversation.'), image: image(context, 'hero-couple', locale), action: action('page-services', t('Khám phá dịch vụ', 'Explore our services')) },
        { id: 'wellbeing', title: t('Dành thời gian cho chính bạn', 'Make time for yourself'), text: t('Chăm sóc răng miệng theo nhịp sống và điều bạn mong muốn.', 'Dental care shaped around your routine and your goals.'), image: image(context, 'hero-wellbeing', locale), action: action('page-about', t('Tìm hiểu Lạc Vân', 'Meet Lac Van')) },
      ] });
      sections.push({ id: 'introduction', type: 'hero', hidden: false, title: t('Nha khoa Lạc Vân — Nơi sự quan tâm bắt đầu', 'Lac Van Dental — Where thoughtful care begins'), text: t('Chúng tôi tin một trải nghiệm chăm sóc tốt bắt đầu khi bạn được lắng nghe. Từ câu hỏi đầu tiên đến từng buổi hẹn, thông tin rõ ràng giúp bạn chủ động hơn với lựa chọn của mình.', 'We believe a thoughtful care experience begins when you are heard. From the first question to each visit, clear information helps you take an active role in your choices.'), image: image(context, 'facility-reception', locale), action: action('page-about', t('Câu chuyện Lạc Vân', 'Our story')) });
      section('services', t('Chăm sóc cho từng nụ cười', 'Care for every smile'), serviceKeys);
      section('doctors', t('Gặp gỡ đội ngũ bác sĩ', 'Meet our dentists'), doctors.slice(0, 4).map(d => `doctor-${d[0]}`));
      section('testimonials', t('Lắng nghe để đồng hành', 'Listening and taking the next step'), stories.slice(0, 2).map(s => `testimonial-${s[0]}`));
      section('gallery', t('Không gian dành cho bạn', 'A space for you'), ['gallery-spaces']);
      section('articles', t('Cùng hiểu, cùng chăm sóc', 'Understand more, care together'), [articles[0], articles[3]].map(a => `article-${a[0]}`));
      form();
    } else {
      sections.push({ id: 'hero', type: 'hero', hidden: false, title, text: summary, image: image(context, item.key === 'page-about' || item.key === 'page-spaces' ? 'facility-reception' : item.key === 'page-contact' ? 'facility-consultation-lounge' : 'hero-wellbeing', locale), action: item.key === 'page-contact' ? null : action('page-contact', t('Gửi yêu cầu tư vấn', 'Request a consultation')) });
      const paragraphs = item.key === 'page-privacy' ? [t('Thông tin bạn gửi được sử dụng để tiếp nhận và liên hệ về yêu cầu tư vấn. Chỉ gửi những thông tin cần thiết cho yêu cầu của bạn; không gửi hồ sơ y tế nhạy cảm qua ô lời nhắn.', 'The information you submit is used to receive and respond to your consultation request. Share only what is needed for your enquiry; do not put sensitive medical records in the message field.'), t('Nếu muốn trao đổi về thông tin đã gửi, hãy nêu yêu cầu trong lần liên hệ tiếp theo với phòng khám. Nhân viên sẽ xác minh thông tin trước khi xử lý.', 'If you want to discuss information you have submitted, tell the clinic during your next contact. The team will verify the request before handling it.')] : item.key === 'page-visit' ? [t('Ghi lại câu hỏi và thời gian thuận tiện. Mang theo các thông tin chăm sóc có liên quan nếu có. Khi phòng khám liên hệ, hãy xác nhận địa điểm, thời gian và những chuẩn bị cần thiết.', 'Write down your questions and convenient times. Bring relevant care information if available. When the clinic contacts you, confirm the location, time and any preparations.'), t('Yêu cầu từ website chưa phải lịch hẹn đã xác nhận. Nếu cần thay đổi thời gian, hãy trao đổi với nhân viên khi được liên hệ.', 'A website request is not a confirmed appointment. If you need a different time, discuss it with the team when they contact you.')] : item.key === 'page-aftercare' ? [t('Giữ lại kế hoạch và hướng dẫn được bác sĩ cung cấp cho riêng bạn. Nếu có câu hỏi về một hướng dẫn, hãy liên hệ phòng khám để làm rõ trước khi tự thay đổi kế hoạch.', 'Keep the plan and instructions provided specifically for you. If an instruction is unclear, contact the clinic for clarification before changing your plan.'), t('Thông tin trên website hỗ trợ cuộc trò chuyện và không thay thế đánh giá trực tiếp cho tình trạng riêng của bạn.', 'Website information supports the conversation and does not replace an individual assessment.')] : [summary, t('Lắng nghe kỹ hơn, giải thích rõ hơn và dành đủ thời gian cho câu hỏi của bạn. Chúng tôi cùng bạn xem xét từng lựa chọn trước khi thống nhất kế hoạch chăm sóc.', 'Listening carefully, explaining clearly and making room for your questions. Together, we review the options before agreeing on a care plan.')];
      sections.push({ id: 'information', type: 'rich_text', hidden: false, body: lacVanDocument(...paragraphs) });
      if (item.key === 'page-about') section('doctors', t('Những người đồng hành cùng bạn', 'The people alongside you'), doctors.map(d => `doctor-${d[0]}`));
      if (item.key === 'page-services') section('services', t('Các lựa chọn chăm sóc', 'Explore your care options'), serviceKeys);
      if (item.key === 'page-prices') section('prices', t('Bảng chi phí tham khảo', 'Indicative fees'), services.map(s => `price-${s.key}`));
      if (item.key === 'page-spaces') section('gallery', t('Góc nhìn không gian', 'Explore our spaces'), ['gallery-spaces', 'gallery-welcome']);
      if (item.key === 'page-contact' || item.key === 'page-about') section('locations', t('Không gian Lạc Vân', 'Lac Van locations'), locationKeys);
      if (item.kind === 'landing' || item.key === 'page-contact') form();
    }
    return parseM4Content(item.kind, { ...base, kind: item.kind, sections });
  }
  let extra: Record<string, unknown> = {}, body = introductory;
  switch (item.kind) {
    case 'location': { const l = locations.find(l => item.key === `location-${l[0]}`)!; extra = { address: l[locale === 'vi' ? 3 : 4], phone: '', email: '', mapUrl: '', openingHours: Array.from({ length: 7 }, (_, day) => ({ day, closed: day === 0, intervals: day === 0 ? [] : [{ opens: '08:00', closes: '12:00' }, { opens: '13:30', closes: '18:00' }] })) }; body = lacVanDocument(summary, t('Gửi yêu cầu tư vấn và chọn cơ sở mong muốn. Nhân viên sẽ trao đổi địa điểm, thời gian và hướng dẫn đến cơ sở khi liên hệ xác nhận.', 'Send a consultation request and choose your preferred location. The team will confirm the address, time and arrival details when contacting you.')); break; }
    case 'doctor': { const d = doctors.find(d => item.key === `doctor-${d[0]}`)!; extra = { professionalTitle: t(d[4], d[5]), credentials: [], languages: ['Tiếng Việt', 'English'], image: image(context, `doctor-${d[0]}`, locale), references: links(`specialty-${d[3]}`, `location-${locations[doctors.indexOf(d) % 3][0]}`) }; body = lacVanDocument(`# ${t('Lắng nghe trước khi lập kế hoạch', 'Listening before planning')}`, t(`${d[1]} dành thời gian trao đổi về mong muốn và những điều bạn đang băn khoăn. Mỗi buổi hẹn hướng đến việc giải thích rõ các lựa chọn và thống nhất bước tiếp theo cùng bạn.`, `${d[2]} takes time to discuss your goals and concerns. Each visit focuses on explaining the options clearly and agreeing on the next step with you.`), `# ${t('Nội dung có thể trao đổi', 'Topics for your visit')}`, t(d[4], d[5]), t('Bạn có thể yêu cầu trao đổi về quy trình, chi phí dự kiến và lịch theo dõi trước khi quyết định.', 'You can ask about the process, estimated costs and follow-up before deciding.')); break; }
    case 'price': { const service = services.find(s => item.key === `price-${s.key}`)!, index = services.indexOf(service); const amounts = ['18000000', '28000000', '4500000', '350000', '350000', '1500000']; extra = { price: { type: 'from', amount: amounts[index], currency: 'VND', unit: lacVanPriceUnit(service.key, locale) }, inclusions: t('Phạm vi cơ bản được giải thích trong kế hoạch cá nhân trước khi thực hiện.', 'The basic scope is explained in your individual plan before care starts.'), notes: t('Mức tham khảo, không phải báo giá cá nhân. Vật liệu, hạng mục bổ sung và chi phí theo dõi cần được xác nhận sau thăm khám.', 'Indicative fee, not an individual quotation. Materials, additional items and follow-up costs require confirmation after assessment.'), references: links(`service-${service.key}`, 'location-an-nhien') }; break; }
    case 'faq': { const f = faqs.find(f => item.key === `faq-${f[0]}`)!; body = lacVanDocument(t(f[3], f[4])); break; }
    case 'gallery': { const welcome = item.key === 'gallery-welcome'; extra = { pairs: [{ before: { ...image(context, welcome ? 'facility-reception' : 'facility-consultation-lounge', locale), caption: t(welcome ? 'Không gian đón tiếp' : 'Không gian trao đổi', welcome ? 'Reception space' : 'Consultation space') }, after: { ...image(context, welcome ? 'facility-consultation-lounge' : 'facility-treatment-room', locale), caption: t(welcome ? 'Không gian tư vấn riêng' : 'Không gian chăm sóc', welcome ? 'Private consultation space' : 'Care space') } }] }; body = lacVanDocument(summary, t('Hai hình ảnh giới thiệu những không gian khác nhau của phòng khám; không mô tả kết quả điều trị trước và sau.', 'These images introduce different clinic spaces; they do not describe before-and-after treatment results.')); break; }
    case 'case': { const story = stories.find(s => item.key === `case-${s[0]}`)!; extra = { image: image(context, `patient-${story[0]}`, locale), references: links(`service-${story[3]}`, `doctor-${story[4]}`) }; body = lacVanDocument(summary, `# ${t('Điều muốn hiểu rõ', 'What matters in the conversation')}`, t('Điều gì có thể thực hiện, cần bao nhiêu bước và kế hoạch nào phù hợp với nhịp sống? Cuộc trò chuyện dành chỗ cho những câu hỏi nhỏ trước khi đưa ra quyết định.', 'What are the options, how many steps are involved and what fits everyday life? The conversation makes room for small questions before a decision is made.'), `# ${t('Từng bước có giải thích', 'Each step explained')}`, t('Bác sĩ trao đổi những thông tin cần đánh giá và cách thống nhất kế hoạch. Câu chuyện và nhân vật được minh họa; không đại diện cho một kết quả điều trị.', 'The dentist discusses what needs assessment and how to agree on a plan. The story and character are illustrative and do not represent a treatment outcome.')); break; }
    case 'testimonial': { const story = stories.find(s => item.key === `testimonial-${s[0]}`)!; extra = { quote: lacVanTestimonialQuote(story[0], locale), displayName: t(story[1], story[2]), attribution: t('Góc nhìn minh họa về trải nghiệm tư vấn', 'An illustrative perspective on the consultation experience'), image: image(context, `patient-${story[0]}`, locale) }; break; }
    case 'article': { const a = articles.find(a => item.key === `article-${a[0]}`)!; extra = { attribution: t('Ban biên tập Lạc Vân', 'Lac Van editorial team'), image: image(context, a[4], locale), references: links(`category-${a[3]}`) }; body = lacVanDocument(summary, ...articleDetails[a[0]].map(p => text(p, locale))); break; }
  }
  return parseM4Content(item.kind, { ...base, kind: item.kind, body, references: [], ...extra }) as DentalContent;
}

/** Empty navigation is the explicitly published bootstrap; final links only use owned identities. */
export function lacVanPresentation(context: LacVanContentContext, locale: M4Locale, complete: boolean): SitePresentation {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const resource = (key: string, label: string, children: M4NavigationNode[] = []): M4NavigationNode => { const e = lacVanEntry(context, key); if (!e.id || !e.publicationIds[locale]) throw new Error('Navigation target is not published'); return { id: `nav-${key}`, type: 'resource', label, target: { kind: e.kind, id: e.id, locale }, allowViFallback: false, children }; };
  const listing = (kind: 'doctor' | 'case' | 'article' | 'gallery' | 'promotion', label: string, children: M4NavigationNode[] = []): M4NavigationNode => ({ id: `list-${kind}`, type: 'listing', kind, locale, label, children });
  const navigation: M4NavigationNode[] = complete ? [
    resource('home', t('Trang chủ', 'Home')),
    resource('page-about', t('Về Lạc Vân', 'About us'), [listing('doctor', t('Đội ngũ bác sĩ', 'Our dentists')), resource('page-spaces', t('Không gian Lạc Vân', 'Our spaces')), { id: 'nav-visit-information', type: 'group', label: t('Hướng dẫn & thông tin', 'Visit information'), children: [resource('page-visit', t('Hướng dẫn thăm khám', 'Your visit')), resource('page-aftercare', t('Sau buổi tư vấn', 'After your consultation')), resource('page-privacy', t('Thông tin riêng tư', 'Your privacy'))] }]),
    resource('page-services', t('Dịch vụ', 'Services'), services.map(s => resource(`service-${s.key}`, text(s.title, locale)))),
    resource('page-prices', t('Bảng giá', 'Fees')),
    listing('case', t('Câu chuyện', 'Stories'), [listing('gallery', t('Không gian & hình ảnh', 'Spaces & images'))]),
    listing('article', t('Kiến thức', 'Journal'), categories.map(c => resource(`category-${c[0]}`, t(c[1], c[2])))),
    listing('promotion', t('Chương trình', 'What’s on'), [resource('landing', t('Hẹn một cuộc trò chuyện', 'Make time for a conversation'))]),
    resource('page-contact', t('Liên hệ', 'Contact')),
  ] : [];
  const footerLocations = complete ? lacVanReferences(context, locale, ...locations.map(l => `location-${l[0]}`)) : [];
  return parseSitePresentation({ name: t('Nha khoa Lạc Vân', 'Lac Van Dental'), logo: null, theme: 'signature', themeVersion: 1, palette: 'plum', font: 'system', layout: 'comfortable', footer: { intro: t('Nâng niu từng nụ cười.', 'Care for every smile.'), body: lacVanDocument(t('Lắng nghe kỹ hơn. Giải thích rõ hơn. Đồng hành từng bước.', 'Listening carefully. Explaining clearly. Taking each step together.')) }, menu: [], signature: { navigation, headerLocation: footerLocations[0] ?? null, footerLocations } });
}
