import type { ContentReference, DentalContent } from '../apps/api/src/contracts/m3';
import type { BuilderSection, M4Content, M4Kind, M4Locale, M4NavigationNode, SitePresentation } from '../apps/api/src/contracts/m4';
import { parseM4Content, parseSitePresentation } from '../apps/api/src/contracts/m4-validation';
import type { RichTextDocument } from '../apps/api/src/contracts/s03';
import type { ServiceMediaReference } from '../apps/api/src/contracts/s07';

type Copy = readonly [string, string];
export interface DentalGoSpec { key: string; kind: M4Kind; slug: string; title: Copy; summary: Copy }
export interface DentalGoEntry extends DentalGoSpec { id: string; legacyCreated: boolean; publicationIds: Partial<Record<M4Locale, string>> }
export interface DentalGoContext {
  entries: DentalGoEntry[];
  assets: { key: string; id: string; revision: number; alt: { vi: string; en: string } }[];
  legacyServicePublicationId: string | null;
}
const spec = (key: string, kind: M4Kind, slug: string, vi: string, en: string, summaryVi: string, summaryEn: string): DentalGoSpec => ({ key, kind, slug, title: [vi, en], summary: [summaryVi, summaryEn] });
export const DENTAL_GO_SPEC: DentalGoSpec[] = [
  spec('location', 'location', 'phong-kham-dental-go', 'Phòng khám Dental GO+', 'Dental GO+ Clinic', 'Một không gian sáng, ấm và riêng tư cho buổi thăm khám của bạn.', 'A bright, warm and private setting for your visit.'),
  spec('category', 'category', 'cham-soc-nu-cuoi', 'Chăm sóc nụ cười', 'Smile care', 'Những thông tin để bạn tự tin bắt đầu cuộc trò chuyện về răng miệng.', 'Information to help you start a confident conversation about dental care.'),
  spec('service-general', 'service', 'nha-khoa-tong-quat', 'Khám & chăm sóc tổng quát', 'General dental care', 'Bắt đầu từ việc lắng nghe, thăm khám và trao đổi kế hoạch chăm sóc phù hợp.', 'Begin with listening, an examination and a care plan shaped around you.'),
  spec('service-ortho', 'service', 'tu-van-chinh-nha', 'Tư vấn chỉnh nha', 'Orthodontic consultations', 'Cùng bác sĩ làm rõ mong muốn, các lựa chọn và những bước cần cân nhắc.', 'Discuss your goals, available options and the steps to consider with your dentist.'),
  spec('service-restorative', 'service', 'cham-soc-phuc-hoi', 'Chăm sóc phục hồi răng', 'Restorative care', 'Tìm hiểu các lựa chọn phục hồi chức năng và hình dáng răng theo tình trạng của bạn.', 'Explore options for restoring tooth function and appearance for your situation.'),
  spec('doctor-mai-anh', 'doctor', 'nguyen-mai-anh', 'BS. Nguyễn Mai Anh', 'Dr Nguyen Mai Anh', 'Lắng nghe kỹ, giải thích rõ và dành thời gian cho những câu hỏi của bạn.', 'Listening carefully, explaining clearly and making room for your questions.'),
  spec('doctor-minh-khang', 'doctor', 'le-minh-khang', 'BS. Lê Minh Khang', 'Dr Le Minh Khang', 'Đồng hành cùng bạn trong việc tìm hiểu và thống nhất kế hoạch chăm sóc phục hồi.', 'Helping you understand and agree on a restorative care plan.'),
  spec('price-general', 'price', 'phi-kham-tong-quat', 'Khám tổng quát', 'General examination', 'Chi phí tham khảo cho buổi thăm khám và trao đổi ban đầu.', 'An indicative fee for an initial examination and discussion.'),
  spec('price-ortho', 'price', 'chi-phi-chinh-nha', 'Kế hoạch chỉnh nha', 'Orthodontic plan', 'Chi phí khởi điểm; phạm vi được xác nhận sau khi đánh giá và thống nhất kế hoạch.', 'A starting fee; scope is confirmed after assessment and agreement on a plan.'),
  spec('price-restorative', 'price', 'chi-phi-phuc-hoi', 'Phục hồi răng', 'Tooth restoration', 'Mức phí khởi điểm cho một răng, tùy lựa chọn và phạm vi chăm sóc.', 'A starting fee per tooth, depending on the option and scope of care.'),
  spec('faq-first', 'faq', 'lan-dau-tham-kham', 'Tôi cần chuẩn bị gì cho lần khám đầu?', 'How should I prepare for my first visit?', 'Ghi lại điều bạn quan tâm và thông tin chăm sóc trước đây để thuận tiện trao đổi.', 'Write down your concerns and previous care information to support the conversation.'),
  spec('faq-fees', 'faq', 'xac-nhan-chi-phi', 'Chi phí được xác nhận khi nào?', 'When are fees confirmed?', 'Phòng khám giải thích phạm vi và chi phí trước khi bạn quyết định thực hiện kế hoạch.', 'The clinic explains the scope and fees before you decide to proceed with a plan.'),
  spec('faq-booking', 'faq', 'yeu-cau-tu-van', 'Gửi yêu cầu có phải đã đặt lịch?', 'Does sending a request confirm an appointment?', 'Chưa. Nhân viên sẽ liên hệ để trao đổi nhu cầu và xác nhận thời gian phù hợp.', 'No. The team will contact you to discuss your needs and confirm a suitable time.'),
  spec('faq-options', 'faq', 'trao-doi-lua-chon', 'Tôi có thể hỏi về lựa chọn khác không?', 'Can I ask about alternatives?', 'Bạn có thể trao đổi về lựa chọn, các bước dự kiến và điều cần xác nhận trước khi đồng ý.', 'You can ask about alternatives, proposed steps and what needs confirming before you agree.'),
  spec('article-first', 'article', 'chuan-bi-lan-kham-dau', 'Một khởi đầu nhẹ nhàng cho lần thăm khám đầu', 'A comfortable start to your first visit', 'Những điều nhỏ giúp buổi trao đổi tại phòng khám rõ ràng và thoải mái hơn.', 'Small preparations that can make the clinic conversation clearer and more comfortable.'),
  spec('article-plan', 'article', 'hieu-ke-hoach-cham-soc', 'Hiểu kế hoạch, chủ động lựa chọn', 'Understand the plan, make your choice', 'Dành thời gian làm rõ mục tiêu, phạm vi và chi phí trước khi bắt đầu.', 'Take time to clarify goals, scope and fees before you begin.'),
  spec('article-ortho', 'article', 'cau-hoi-tu-van-chinh-nha', 'Những câu hỏi cho buổi tư vấn chỉnh nha', 'Questions for an orthodontic consultation', 'Bắt đầu từ mong muốn của bạn và tìm hiểu cách kế hoạch phù hợp với nhịp sống.', 'Begin with your goals and explore how a plan would fit your routine.'),
  spec('gallery', 'gallery', 'khong-gian-dental-go', 'Không gian Dental GO+', 'Inside Dental GO+', 'Từ sảnh đón tiếp đến phòng chăm sóc, mỗi góc đều dành chỗ cho sự thoải mái.', 'From reception to the care room, every space makes room for comfort.'),
  spec('contact', 'page', 'lien-he', 'Bắt đầu bằng một cuộc trò chuyện', 'Start with a conversation', 'Chia sẻ điều bạn quan tâm. Chúng tôi sẽ liên hệ để trao đổi bước tiếp theo.', 'Share what matters to you. We will contact you to discuss the next step.'),
  spec('about', 'page', 've-dental-go', 'Thêm một chút an tâm', 'A little more peace of mind', 'Dental GO+ chọn sự lắng nghe và thông tin rõ ràng làm điểm khởi đầu của chăm sóc.', 'At Dental GO+, care begins with listening and clear information.'),
  spec('fees', 'page', 'chi-phi-cham-soc', 'Chi phí rõ ràng, lựa chọn chủ động', 'Clear fees, informed choices', 'Xem phạm vi tham khảo và trao đổi trực tiếp để có kế hoạch phù hợp với bạn.', 'Review indicative scope and discuss an individual plan with the clinic.'),
  spec('home', 'home', 'home', 'Nụ cười tự nhiên. Khởi đầu từ sự thấu hiểu.', 'Natural smiles. Care begins with understanding.', 'Lắng nghe bạn, giải thích rõ từng bước và cùng bạn lựa chọn kế hoạch chăm sóc phù hợp.', 'Listening to you, explaining each step and helping you choose a suitable care plan.'),
];
export function dentalGoDocument(...paragraphs: string[]): RichTextDocument {
  return { type: 'doc', version: 1, blocks: paragraphs.map(p => ({ type: p.startsWith('# ') ? 'heading' : 'paragraph', children: [{ type: 'text', text: p.startsWith('# ') ? p.slice(2) : p }] })) };
}
export function dentalGoImage(c: DentalGoContext, key: string, locale: M4Locale): ServiceMediaReference {
  const a = c.assets.find(a => a.key === key); if (!a?.id || !a.revision) throw new Error(`Missing ready image: ${key}`);
  return { assetId: a.id, revision: a.revision, alt: a.alt[locale] };
}
export function dentalGoContent(c: DentalGoContext, e: DentalGoEntry, locale: M4Locale, legacy = false): M4Content {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en, index = locale === 'vi' ? 0 : 1;
  const title = e.title[index], summary = e.summary[index], base = { slug: e.slug, title, summary, seo: { title: `${title} | Dental GO+`.slice(0, 160), description: summary } };
  const refs = (...keys: string[]): ContentReference[] => {
    if (legacy && e.kind !== 'price') return [];
    if (legacy) { const first = c.entries.find(v => v.key === 'service-general')!; if (!c.legacyServicePublicationId) throw new Error('Legacy price service pin missing'); return [{ kind: 'service', id: first.id, publicationId: c.legacyServicePublicationId }]; }
    return keys.map(key => { const x = c.entries.find(x => x.key === key); if (!x?.publicationIds[locale]) throw new Error(`Missing published dependency ${key}/${locale}`); return { kind: x.kind as ContentReference['kind'], id: x.id, publicationId: x.publicationIds[locale]! }; });
  };
  const image = (key: string) => dentalGoImage(c, key, locale);
  const normal = dentalGoDocument(summary, t('Bạn có thể trao đổi về mong muốn, những điều đang băn khoăn và đề nghị giải thích lại thông tin trước khi quyết định bước tiếp theo.', 'Share your goals and concerns, and ask for information to be explained again before deciding on the next step.'));
  if (e.kind === 'service') return parseM4Content('service', { ...base, body: dentalGoDocument(`# ${t('Bắt đầu từ điều bạn quan tâm', 'Begin with what matters to you')}`, summary, `# ${t('Một kế hoạch có giải thích rõ ràng', 'A clearly explained plan')}`, t('Bác sĩ lắng nghe, thăm khám và giải thích những thông tin cần đánh giá thêm. Bạn có thể hỏi về các lựa chọn, phạm vi chi phí và lịch theo dõi trước khi thống nhất kế hoạch.', 'Your dentist listens, examines and explains any further assessment needed. Ask about options, the scope of fees and follow-up before agreeing on a plan.'), `# ${t('Chuẩn bị cho buổi trao đổi', 'Prepare for the conversation')}`, t('Ghi lại những câu hỏi quan trọng và thông tin chăm sóc trước đây nếu có. Yêu cầu tư vấn trên website giúp phòng khám liên hệ với bạn; thời gian hẹn cần được xác nhận riêng.', 'Note your main questions and previous care information if available. A website enquiry lets the clinic contact you; appointment times require separate confirmation.')), coverImage: image(e.key.replace('service-general', 'service-preventive').replace('service-ortho', 'service-orthodontic')), contentLinks: { references: refs('location') } });
  if (['home', 'page'].includes(e.kind)) {
    const target = c.entries.find(x => x.key === 'contact')!;
    const action = e.key === 'contact' ? null : { label: t('Đăng ký tư vấn', 'Request a consultation'), target: { kind: target.kind, id: target.id, locale }, allowViFallback: false };
    const sections: BuilderSection[] = [];
    const section = (type: 'services' | 'doctors' | 'locations' | 'prices' | 'gallery' | 'articles' | 'faq', heading: string, keys: string[]) => sections.push({ id: type, type, hidden: false, title: heading, references: refs(...keys), required: true });
    if (e.kind === 'home') {
      sections.push({ id: 'hero', type: 'hero_carousel', hidden: false, autoplay: false, intervalMs: 7000, slides: [{ id: 'smile', title, text: summary, image: image('hero-smile'), action }] });
      sections.push({ id: 'intro', type: 'hero', hidden: false, title: t('Thêm an tâm trong mỗi lựa chọn', 'More confidence in every choice'), text: t('Không gian thoải mái, cuộc trò chuyện cởi mở và thông tin rõ ràng. Dental GO+ đồng hành cùng bạn từ câu hỏi đầu tiên.', 'A comfortable setting, an open conversation and clear information. Dental GO+ is here from your first question.'), image: image('clinic-reception'), action });
      section('services', t('Chăm sóc theo nhu cầu của bạn', 'Care shaped around you'), ['service-general', 'service-ortho', 'service-restorative']);
      section('doctors', t('Gặp người lắng nghe bạn', 'Meet the people who listen'), ['doctor-mai-anh', 'doctor-minh-khang']);
      section('gallery', t('Một không gian để an tâm bắt đầu', 'A comfortable place to begin'), ['gallery']);
      section('prices', t('Thông tin chi phí rõ ràng', 'Clear fee information'), ['price-general', 'price-ortho', 'price-restorative']);
      section('articles', t('Dành thêm sự quan tâm cho nụ cười', 'Make room for your smile'), ['article-first', 'article-plan', 'article-ortho']);
      section('faq', t('Điều bạn đang muốn biết', 'Questions on your mind'), ['faq-first', 'faq-fees', 'faq-booking', 'faq-options']);
    } else {
      sections.push({ id: 'hero', type: 'hero', hidden: false, title, text: summary, image: image(e.key === 'fees' ? 'service-preventive' : 'clinic-reception'), action });
      if (e.key === 'about') { sections.push({ id: 'story', type: 'rich_text', hidden: false, body: dentalGoDocument(t('Dental GO+ tin rằng trải nghiệm chăm sóc tốt bắt đầu từ sự thấu hiểu. Chúng tôi dành thời gian nghe mong muốn, giải thích các lựa chọn và cùng bạn thống nhất một kế hoạch có thể hiểu rõ.', 'At Dental GO+, a thoughtful care experience begins with understanding. We take time to hear your goals, explain the options and agree on a plan you can understand.'), t('Bạn có thể hỏi lại, cân nhắc thêm hoặc trao đổi về lựa chọn khác. Sự chủ động của bạn là một phần của cuộc trò chuyện tại phòng khám.', 'You can ask again, take time to consider or discuss an alternative. Your involvement is part of the clinic conversation.')) }); section('doctors', t('Đội ngũ Dental GO+', 'The Dental GO+ team'), ['doctor-mai-anh', 'doctor-minh-khang']); section('gallery', t('Không gian chăm sóc', 'Our care spaces'), ['gallery']); }
      if (e.key === 'fees') section('prices', t('Bảng phí tham khảo', 'Indicative fees'), ['price-general', 'price-ortho', 'price-restorative']);
      if (e.key === 'contact') section('locations', t('Ghé thăm Dental GO+', 'Visit Dental GO+'), ['location']);
      section('faq', t('Trước buổi hẹn', 'Before your visit'), ['faq-first', 'faq-booking']);
    }
    sections.push({ id: 'consultation', type: 'consultation', hidden: false, title: t('Bắt đầu bằng một cuộc trò chuyện', 'Start with a conversation'), promotion: null, serviceOptions: refs('service-general', 'service-ortho', 'service-restorative'), locationOptions: refs('location') });
    return parseM4Content(e.kind, { ...base, kind: e.kind, sections });
  }
  let extra: Record<string, unknown> = {}, body = normal;
  switch (e.kind) {
    case 'location': extra = { address: t('28 đường Vườn Nắng, khu Nam An, TP. Hồ Chí Minh', '28 Vuon Nang Street, Nam An Quarter, Ho Chi Minh City'), phone: '', email: '', mapUrl: '', openingHours: Array.from({ length: 7 }, (_, day) => ({ day, closed: day === 0, intervals: day === 0 ? [] : [{ opens: '08:30', closes: '18:00' }] })) }; break;
    case 'doctor': extra = { professionalTitle: e.key === 'doctor-mai-anh' ? t('Chăm sóc tổng quát', 'General dental care') : t('Tư vấn phục hồi răng', 'Restorative care consultations'), credentials: [], languages: ['Tiếng Việt', 'English'], image: image(e.key), references: refs(e.key === 'doctor-mai-anh' ? 'service-general' : 'service-restorative', 'location') }; break;
    case 'price': { const key = e.key.replace('price-', 'service-'), amount = e.key === 'price-general' ? '150000' : e.key === 'price-ortho' ? '25000000' : '1500000'; extra = { price: { type: 'from', amount, currency: 'VND', unit: e.key === 'price-general' ? t('lần', 'visit') : e.key === 'price-ortho' ? t('kế hoạch', 'plan') : t('răng', 'tooth') }, inclusions: t('Phạm vi được giải thích trong kế hoạch chăm sóc cá nhân.', 'The scope is explained in your individual care plan.'), notes: t('Chi phí tham khảo. Phòng khám xác nhận hạng mục, lựa chọn và tổng chi phí sau khi thăm khám; không tự động áp dụng cho mọi trường hợp.', 'Indicative fees. The clinic confirms items, options and total fees after assessment; these do not automatically apply to every situation.'), references: refs(key, 'location') }; break; }
    case 'gallery': extra = { pairs: [{ before: { ...image('clinic-reception'), caption: t('Sảnh đón tiếp', 'Reception') }, after: { ...image('clinic-treatment-room'), caption: t('Phòng chăm sóc', 'Care room') } }] }; body = dentalGoDocument(summary, t('Hình ảnh giới thiệu hai không gian của phòng khám, không mô tả kết quả điều trị trước và sau.', 'These images introduce two clinic spaces and do not show before-and-after treatment results.')); break;
    case 'article': extra = { attribution: t('Dental GO+ · Góc chăm sóc', 'Dental GO+ · Care journal'), image: image(e.key === 'article-ortho' ? 'service-orthodontic' : e.key === 'article-plan' ? 'service-restorative' : 'service-preventive'), references: refs('category') }; body = dentalGoDocument(`# ${t('Những điều đáng trao đổi', 'Points to discuss')}`, summary, t('Ghi lại hai hoặc ba câu hỏi quan trọng nhất với bạn. Nếu có kế hoạch hoặc thông tin chăm sóc trước đây, hãy hỏi phòng khám xem bạn cần mang theo những gì.', 'Write down your two or three most important questions. If you have previous care information or a plan, ask the clinic what to bring.'), `# ${t('Rõ thông tin trước mỗi bước', 'Clear information before each step')}`, t('Hỏi về mục tiêu, lựa chọn thay thế, phạm vi chi phí và lịch theo dõi. Bạn có thể đề nghị bác sĩ giải thích lại các thuật ngữ bằng lời dễ hiểu trước khi thống nhất bước tiếp theo.', 'Ask about goals, alternatives, the scope of fees and follow-up. You can ask your dentist to explain unfamiliar terms in plain language before agreeing on the next step.')); break;
  }
  return parseM4Content(e.kind, { ...base, kind: e.kind, body, references: [], ...extra }) as DentalContent;
}
export function dentalGoPresentation(c: DentalGoContext, locale: M4Locale, complete: boolean): SitePresentation {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const page = (key: string, label: string): M4NavigationNode => { const e = c.entries.find(e => e.key === key)!; return { id: key, type: 'resource', label, target: { kind: e.kind, id: e.id, locale }, allowViFallback: false, children: [] }; };
  const list = (kind: 'service' | 'doctor' | 'article' | 'gallery', label: string): M4NavigationNode => ({ id: kind, type: 'listing', kind, locale, label, children: [] });
  const location = c.entries.find(e => e.key === 'location')!;
  return parseSitePresentation({ name: 'Dental GO+', logo: dentalGoImage(c, 'logo-mark', locale), theme: 'signature', themeVersion: 1, palette: 'teal', font: 'system', layout: 'comfortable', menu: [], footer: { intro: t('Chăm sóc nụ cười. Thêm một chút an tâm.', 'A little plus. A brighter smile.'), body: dentalGoDocument(t('Lắng nghe bạn, giải thích rõ từng bước và cùng bạn chủ động lựa chọn.', 'Listening to you, explaining each step and helping you make an informed choice.')) }, signature: { navigation: complete ? [page('home', t('Trang chủ', 'Home')), page('about', t('Về Dental GO+', 'About us')), list('service', t('Dịch vụ', 'Services')), list('doctor', t('Bác sĩ', 'Our dentists')), page('fees', t('Bảng phí', 'Fees')), list('article', t('Góc chăm sóc', 'Journal')), page('contact', t('Liên hệ', 'Contact'))] : [], headerLocation: complete ? { kind: 'location', id: location.id, publicationId: location.publicationIds[locale]! } : null, footerLocations: complete ? [{ kind: 'location', id: location.id, publicationId: location.publicationIds[locale]! }] : [] } });
}
