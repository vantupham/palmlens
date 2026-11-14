/**
 * Knowledge base. Every "science" statement should be traceable to SOURCES.
 * Every "tradition" statement is presented as cultural entertainment.
 * Contributions welcome via pull request — keep both languages in sync.
 */
import type { T } from '../i18n';
import type { ElementKey, LineKey } from '../types';

export interface Source { id: string; label: string; url: string }

export const SOURCES: Record<string, Source> = {
  kimura86: {
    id: 'kimura86',
    label: 'Kimura & Kitagawa (1986). Embryological development of human palmar, plantar, and digital flexion creases. The Anatomical Record 216(2).',
    url: 'https://doi.org/10.1002/ar.1092160211',
  },
  wertheim: {
    id: 'wertheim',
    label: 'Wertheim, K. Embryology and Morphology of Friction Ridge Skin. The Fingerprint Sourcebook, ch. 3 (U.S. NIJ).',
    url: 'https://www.ojp.gov/pdffiles1/nij/225323.pdf',
  },
  medline: {
    id: 'medline',
    label: 'MedlinePlus (U.S. National Library of Medicine). Single palmar crease.',
    url: 'https://medlineplus.gov/ency/article/003290.htm',
  },
  manning98: {
    id: 'manning98',
    label: 'Manning et al. (1998). The ratio of 2nd to 4th digit length: a predictor of sperm numbers and concentrations of testosterone, luteinizing hormone and oestrogen. Human Reproduction 13(11).',
    url: 'https://doi.org/10.1093/humrep/13.11.3000',
  },
  honekopp10: {
    id: 'honekopp10',
    label: 'Hönekopp & Watson (2010). Meta-analysis of digit ratio 2D:4D shows greater sex difference in the right hand. American Journal of Human Biology 22(5).',
    url: 'https://doi.org/10.1002/ajhb.21054',
  },
  forer49: {
    id: 'forer49',
    label: 'Forer, B. R. (1949). The fallacy of personal validation: a classroom demonstration of gullibility. J. Abnormal and Social Psychology 44(1).',
    url: 'https://doi.org/10.1037/h0059240',
  },
  mediapipe20: {
    id: 'mediapipe20',
    label: 'Zhang et al. (2020). MediaPipe Hands: On-device Real-time Hand Tracking. arXiv:2006.10214.',
    url: 'https://arxiv.org/abs/2006.10214',
  },
};

// ------------------------------------------------------------------ elements

export const ELEMENTS: Record<ElementKey, { name: T; icon: string; shape: T; science: T; tradition: T }> = {
  earth: {
    name: { vi: 'Tay Đất', en: 'Earth hand' },
    icon: '◆',
    shape: { vi: 'Lòng bàn tay vuông, ngón tương đối ngắn', en: 'Square palm, relatively short fingers' },
    science: {
      vi: 'Tỷ lệ bàn tay chủ yếu do di truyền và quá trình phát triển xương quyết định. Đây là phân loại hình thái, không phải phân loại tính cách.',
      en: 'Hand proportions are mostly set by genes and bone growth. This is a shape category, not a personality category.',
    },
    tradition: {
      vi: 'Người tay Đất được xem là thực tế, đáng tin, kiên nhẫn; thích làm ra những thứ cầm nắm được.',
      en: 'Earth hands are said to be practical, dependable and patient; people who like making tangible things.',
    },
  },
  air: {
    name: { vi: 'Tay Khí', en: 'Air hand' },
    icon: '◇',
    shape: { vi: 'Lòng bàn tay vuông, ngón dài', en: 'Square palm, long fingers' },
    science: {
      vi: 'Ngón dài so với lòng bàn tay là biến thể bình thường về tỷ lệ xương đốt ngón. Nó không liên quan đã được chứng minh với cách suy nghĩ.',
      en: 'Long fingers relative to the palm are a normal variation in finger bone proportions, with no proven link to how you think.',
    },
    tradition: {
      vi: 'Người tay Khí được cho là ham hiểu biết, giỏi giao tiếp, thích ý tưởng và trò chuyện.',
      en: 'Air hands are said to be curious and communicative, drawn to ideas and conversation.',
    },
  },
  water: {
    name: { vi: 'Tay Nước', en: 'Water hand' },
    icon: '◐',
    shape: { vi: 'Lòng bàn tay dài, ngón dài', en: 'Long palm, long fingers' },
    science: {
      vi: 'Bàn tay thon dài là một đầu của dải phân bố hình thái bình thường. Nó thay đổi theo chiều cao, giới tính và di truyền.',
      en: 'A long, slender hand sits at one end of normal shape variation, which tracks height, sex and genetics.',
    },
    tradition: {
      vi: 'Người tay Nước được xem là nhạy cảm, giàu trực giác và trí tưởng tượng, đồng cảm sâu sắc.',
      en: 'Water hands are said to be sensitive, intuitive and imaginative, with deep empathy.',
    },
  },
  fire: {
    name: { vi: 'Tay Lửa', en: 'Fire hand' },
    icon: '▲',
    shape: { vi: 'Lòng bàn tay dài, ngón tương đối ngắn', en: 'Long palm, relatively short fingers' },
    science: {
      vi: 'Lòng bàn tay dài hơn tương đối so với ngón là biến thể tỷ lệ bình thường giữa xương bàn tay và xương ngón.',
      en: 'A palm that is long relative to the fingers is a normal variation in metacarpal-to-finger proportions.',
    },
    tradition: {
      vi: 'Người tay Lửa được cho là nhiệt huyết, quyết đoán, thích hành động và dẫn dắt.',
      en: 'Fire hands are said to be energetic and decisive, drawn to action and leadership.',
    },
  },
};

/** 12 archetypes: element × dominant line (heart, head, life). */
export const ARCHETYPES: Record<ElementKey, [T, T, T]> = {
  earth: [
    { vi: 'Người giữ lửa', en: 'The Hearth Keeper' },
    { vi: 'Nhà kiến trúc', en: 'The Architect' },
    { vi: 'Người vun trồng', en: 'The Cultivator' },
  ],
  air: [
    { vi: 'Người kết nối', en: 'The Connector' },
    { vi: 'Nhà tư tưởng', en: 'The Thinker' },
    { vi: 'Người khám phá', en: 'The Explorer' },
  ],
  water: [
    { vi: 'Người chữa lành', en: 'The Healer' },
    { vi: 'Người mơ mộng', en: 'The Dreamer' },
    { vi: 'Người nghệ sĩ', en: 'The Artist' },
  ],
  fire: [
    { vi: 'Người truyền lửa', en: 'The Inspirer' },
    { vi: 'Nhà chiến lược', en: 'The Strategist' },
    { vi: 'Người tiên phong', en: 'The Pioneer' },
  ],
};

// --------------------------------------------------------------------- lines

export const LINE_INFO: Record<LineKey, { name: T; anatomy: T; science: T; sources: string[] }> = {
  heart: {
    name: { vi: 'Đường Tâm đạo', en: 'Heart line' },
    anatomy: { vi: 'Nếp gấp ngang xa (distal transverse crease)', en: 'Distal transverse crease' },
    science: {
      vi: 'Nếp gấp nằm trên vùng khớp gốc ngón áp út và ngón út, xuất hiện trong khoảng tuần 10–13 của thai kỳ. Nó cho phép da lòng bàn tay gập lại khi bạn nắm tay. Hình dạng phụ thuộc di truyền và sự phát triển của bàn tay thai nhi. Không có bằng chứng nó phản ánh đời sống tình cảm.',
      en: 'This crease lies over the ring and little finger knuckles and appears around weeks 10–13 of gestation. It lets the palm skin fold when you grip. Its shape depends on genes and fetal hand development. There is no evidence it reflects your love life.',
    },
    sources: ['kimura86', 'wertheim'],
  },
  head: {
    name: { vi: 'Đường Trí đạo', en: 'Head line' },
    anatomy: { vi: 'Nếp gấp ngang gần (proximal transverse crease)', en: 'Proximal transverse crease' },
    science: {
      vi: 'Nếp gấp bắt đầu gần khớp gốc ngón trỏ và chạy chéo qua lòng bàn tay, hình thành trong khoảng tuần 10–13 của thai kỳ. Nó tương ứng với mặt gập của các khớp gốc ngón. Không có nghiên cứu nào liên hệ nó với trí tuệ.',
      en: 'This crease starts near the index knuckle and runs across the palm. It forms around weeks 10–13 of gestation and follows the folding plane of the knuckles. No study links it to intelligence.',
    },
    sources: ['kimura86', 'wertheim'],
  },
  life: {
    name: { vi: 'Đường Sinh đạo', en: 'Life line' },
    anatomy: { vi: 'Nếp gấp ô mô cái (thenar crease)', en: 'Thenar crease' },
    science: {
      vi: 'Đây là nếp gấp xuất hiện sớm nhất, khoảng tuần 8–10 của thai kỳ. Nó bao quanh khối cơ gốc ngón cái, nơi ngón cái gập vào lòng bàn tay. Chiều dài của nó không cho biết tuổi thọ.',
      en: 'This is the first crease to appear, around weeks 8–10 of gestation. It curves around the thumb muscles where the thumb folds into the palm. Its length says nothing about lifespan.',
    },
    sources: ['wertheim', 'kimura86'],
  },
  fate: {
    name: { vi: 'Đường Định mệnh', en: 'Fate line' },
    anatomy: { vi: 'Nếp gấp dọc giữa lòng bàn tay', en: 'Longitudinal mid-palm crease' },
    science: {
      vi: 'Nếp dọc này rõ ở một số người và gần như không có ở người khác. Đây là biến thể bình thường của nếp da.',
      en: 'This vertical crease is clear in some people and nearly absent in others. It is a normal skin crease variation.',
    },
    sources: ['kimura86'],
  },
};

/** Traditional readings by measured feature. */
export const TRADITION = {
  heart: {
    long: { vi: 'Đường Tâm đạo dài: bạn biểu cảm, sống tình cảm hết mình và không ngại cho đi.', en: 'A long heart line: expressive, wholehearted, generous with affection.' },
    short: { vi: 'Đường Tâm đạo ngắn: bạn kín đáo, thể hiện tình cảm bằng hành động hơn lời nói.', en: 'A short heart line: reserved, showing love through actions more than words.' },
    curved: { vi: 'Tâm đạo cong lên phía các ngón: bạn ấm áp, lãng mạn, dễ rung động.', en: 'Your heart line curves up toward the fingers: warm, romantic, quick to be moved.' },
    straight: { vi: 'Tâm đạo khá thẳng: bạn lý trí trong tình cảm và trân trọng sự ổn định.', en: 'Your heart line runs fairly straight: level-headed in love, valuing stability.' },
    endIndex: { vi: 'Tâm đạo kết thúc gần ngón trỏ: bạn lý tưởng hoá tình yêu và đặt tiêu chuẩn cao.', en: 'Your heart line ends near the index finger: idealistic about love, with high standards.' },
    endBetween: { vi: 'Tâm đạo kết thúc giữa ngón trỏ và ngón giữa: bạn cân bằng giữa trái tim và lý trí.', en: 'Your heart line ends between index and middle: a balance of heart and head.' },
    endMiddle: { vi: 'Tâm đạo kết thúc dưới ngón giữa: bạn thực tế và chủ động trong tình cảm.', en: 'Your heart line ends under the middle finger: practical and proactive in love.' },
  },
  head: {
    long: { vi: 'Đường Trí đạo dài: suy nghĩ thấu đáo, nhìn vấn đề nhiều chiều.', en: 'A long head line: thorough thinking, seeing many sides.' },
    short: { vi: 'Đường Trí đạo ngắn: quyết đoán, đi thẳng vào trọng tâm.', en: 'A short head line: decisive, straight to the point.' },
    curved: { vi: 'Trí đạo dốc xuống và cong: bạn sáng tạo, giàu trí tưởng tượng.', en: 'Your head line slopes and curves: creative and imaginative.' },
    straight: { vi: 'Trí đạo thẳng: bạn logic, thực tế, thích dữ kiện rõ ràng.', en: 'Your head line runs straight: logical, practical, fond of clear facts.' },
    joined: { vi: 'Trí đạo chung điểm đầu với Sinh đạo: bạn cẩn trọng trước khi hành động.', en: 'Your head and life lines start together: careful before acting.' },
    separate: { vi: 'Trí đạo tách khỏi Sinh đạo ở điểm đầu: bạn độc lập, thích phiêu lưu.', en: 'Your head line starts apart from the life line: independent and adventurous.' },
  },
  life: {
    wide: { vi: 'Đường Sinh đạo vòng rộng ra giữa lòng bàn tay: nhiều năng lượng, nhiệt huyết.', en: 'A life line sweeping wide into the palm: lots of energy and enthusiasm.' },
    close: { vi: 'Đường Sinh đạo ôm sát gốc ngón cái: điềm tĩnh, biết giữ sức.', en: 'A life line hugging the thumb: calm, pacing yourself.' },
    deep: { vi: 'Sinh đạo rõ và sâu: bạn bền bỉ, vững vàng.', en: 'A clear, deep life line: stamina and steadiness.' },
    faint: { vi: 'Sinh đạo mảnh: bạn nhạy cảm, linh hoạt với thay đổi.', en: 'A fine, light life line: sensitive and adaptable.' },
    note: { vi: 'Ngay cả chỉ tay học hiện đại cũng không cho rằng đường này cho biết tuổi thọ.', en: 'Even modern palmistry does not claim this line shows how long you will live.' },
  },
  fate: {
    present: { vi: 'Có đường Định mệnh rõ: bạn có định hướng và mục tiêu bền bỉ.', en: 'A clear fate line: a strong sense of direction and purpose.' },
    absent: { vi: 'Đường Định mệnh mờ hoặc không có: bạn tự do, tự vẽ con đường của mình.', en: 'A faint or absent fate line: a free spirit drawing your own path.' },
  },
};

export const TRAITS = {
  longPinky: {
    science: { vi: 'Đầu ngón út vượt qua khớp trên cùng của ngón áp út. Độ dài tương đối của các ngón chủ yếu do di truyền.', en: 'Your little fingertip reaches past the ring finger’s top joint. Relative finger length is mostly genetic.' },
    tradition: { vi: 'Ngón út dài: giỏi ăn nói, thuyết phục và kết nối.', en: 'A long little finger: persuasive, a gifted communicator.' },
  },
  singleCrease: {
    science: {
      vi: 'Hai nếp ngang có vẻ nhập thành một (nếp ngang đơn). Theo MedlinePlus, khoảng 1/30 người có đặc điểm này. Ở phần lớn người, nó hoàn toàn bình thường. Ứng dụng này không chẩn đoán bất cứ điều gì.',
      en: 'Your two transverse creases appear to merge into one (single transverse crease). MedlinePlus puts this at about 1 in 30 people, and it is usually entirely normal. This app does not diagnose anything.',
    },
    tradition: { vi: 'Chỉ tay học gọi đây là "đường đoạn chưởng": người tập trung cao độ, làm gì cũng dồn hết tâm sức.', en: 'Palmists treat this as a sign of intense focus, someone who gives everything to what they do.' },
  },
};

export const DIGIT_RATIO_SCIENCE: T = {
  vi: 'Ở cấp độ quần thể, tỷ lệ ngón trỏ/ngón áp út (2D:4D) ở nam thường thấp hơn ở nữ một chút. Chênh lệch rõ hơn ở tay phải, và tỷ lệ này được xem là dấu vết của nội tiết tố trước khi sinh. Nhưng hai phân bố chồng lấn rất nhiều, nên con số này không nói lên điều gì chắc chắn về một cá nhân. Số đo từ camera chỉ là ước lượng.',
  en: 'Across populations, the index-to-ring finger ratio (2D:4D) tends to be slightly lower in males than in females, more so on the right hand. It is studied as a trace of prenatal hormones. The two distributions overlap heavily, so it says nothing certain about an individual. Camera measurements are approximate.',
};

// --------------------------------------------------------------------- couple

export const COUPLE_TYPES: Record<string, { name: T; story: T }> = {
  'earth+earth': { name: { vi: 'Đá tảng', en: 'Bedrock' }, story: { vi: 'Hai người vững chãi xây một nền móng chung: chậm mà chắc, bền theo năm tháng.', en: 'Two steady souls building one foundation: slow, sure, and lasting.' } },
  'air+earth': { name: { vi: 'Cánh diều', en: 'The Kite' }, story: { vi: 'Một người giữ dây, một người bay cao: tự do mà vẫn có chỗ để về.', en: 'One holds the string, one flies high: freedom with a place to come home to.' } },
  'earth+water': { name: { vi: 'Vườn xanh', en: 'The Garden' }, story: { vi: 'Đất giữ nước, nước nuôi đất: hai bạn chăm sóc nhau một cách tự nhiên.', en: 'Earth holds water, water feeds earth: you care for each other naturally.' } },
  'earth+fire': { name: { vi: 'Lò gốm', en: 'The Kiln' }, story: { vi: 'Ngọn lửa đam mê gặp đôi tay kiên nhẫn: ý tưởng được nung thành điều bền vững.', en: 'Passion meets patient hands: ideas fired into something lasting.' } },
  'air+air': { name: { vi: 'Gió lộng', en: 'Open Sky' }, story: { vi: 'Hai tâm hồn tự do, trò chuyện không dứt, luôn có chuyện mới để cùng khám phá.', en: 'Two free spirits with endless conversation and always something new to explore.' } },
  'air+water': { name: { vi: 'Mây trời', en: 'Clouds' }, story: { vi: 'Ý tưởng gặp cảm xúc: một cặp mơ mộng, giàu tưởng tượng.', en: 'Ideas meet feelings: a dreamy, imaginative pair.' } },
  'air+fire': { name: { vi: 'Pháo hoa', en: 'Fireworks' }, story: { vi: 'Gió thổi lửa bùng: rực rỡ, nhiều năng lượng, không bao giờ nhàm chán.', en: 'Wind feeds the flame: brilliant, energetic, never boring.' } },
  'water+water': { name: { vi: 'Biển sâu', en: 'Deep Sea' }, story: { vi: 'Hai người thấu cảm, hiểu nhau không cần nói nhiều.', en: 'Two empaths who understand each other without many words.' } },
  'fire+water': { name: { vi: 'Hơi nước', en: 'Steam' }, story: { vi: 'Đam mê gặp dịu dàng: khi hoà vào nhau thành một nguồn năng lượng mới.', en: 'Passion meets tenderness: together they become a new kind of energy.' } },
  'fire+fire': { name: { vi: 'Mặt trời đôi', en: 'Twin Suns' }, story: { vi: 'Nhiệt huyết nhân đôi: cùng dám nghĩ, dám làm, cùng toả sáng.', en: 'Double the fire: bold together, shining together.' } },
};

export const coupleKey = (a: ElementKey, b: ElementKey) => [a, b].sort().join('+');

/** Comparable features for "alike" and "complement" (always phrased positively). */
export const COUPLE_FEATURES: { id: string; sd: number; alike: T; complement: T }[] = [
  { id: 'heartCurv', sd: 0.06,
    alike: { vi: 'Hai đường Tâm đạo cong gần như nhau. Theo truyền thống, hai bạn thể hiện tình cảm bằng cùng một "ngôn ngữ".', en: 'Your heart lines curve almost alike. Tradition says you speak the same "language" of affection.' },
    complement: { vi: 'Một Tâm đạo cong, một Tâm đạo thẳng: một người nói bằng lời, một người nói bằng hành động. Hai cách yêu bổ sung cho nhau.', en: 'One heart line curves, one runs straight: one shows love in words, the other in actions. The two styles complete each other.' } },
  { id: 'heartLen', sd: 0.2,
    alike: { vi: 'Đường Tâm đạo dài tương đương: mức độ cởi mở cảm xúc của hai bạn khá giống nhau.', en: 'Heart lines of similar length: you open up emotionally at a similar pace.' },
    complement: { vi: 'Một người bộc lộ, một người kín đáo: người này giúp người kia thoải mái hơn, người kia giúp người này bình tâm hơn.', en: 'One open, one reserved: each helps the other relax or settle.' } },
  { id: 'headLen', sd: 0.2,
    alike: { vi: 'Đường Trí đạo dài tương đương: hai bạn suy nghĩ với cùng một nhịp.', en: 'Head lines of similar length: you think at the same tempo.' },
    complement: { vi: 'Một người cân nhắc kỹ, một người quyết nhanh: đủ cả kế hoạch lẫn hành động.', en: 'One deliberates, one decides fast: you have both the plan and the action.' } },
  { id: 'headCurv', sd: 0.06,
    alike: { vi: 'Cùng kiểu tư duy: cùng thực tế hoặc cùng bay bổng, nên dễ hiểu ý nhau.', en: 'The same thinking style, both practical or both imaginative, so you read each other easily.' },
    complement: { vi: 'Một người thực tế, một người giàu tưởng tượng: người mơ, người biến giấc mơ thành thật.', en: 'One practical, one imaginative: one dreams, the other makes it real.' } },
  { id: 'lifeCurv', sd: 0.06,
    alike: { vi: 'Đường Sinh đạo vòng giống nhau: nhịp năng lượng hằng ngày của hai bạn ăn khớp.', en: 'Life lines with a similar sweep: your daily energy rhythms match.' },
    complement: { vi: 'Một người bùng nổ, một người bền bỉ: một người khởi động, một người giữ nhịp.', en: 'One bursts, one endures: one starts things, the other keeps the pace.' } },
  { id: 'palm', sd: 0.1,
    alike: { vi: 'Dáng lòng bàn tay rất giống nhau, một chi tiết nhỏ mà hiếm.', en: 'Your palms have very similar proportions, a small but rare match.' },
    complement: { vi: 'Hai dáng lòng bàn tay khác nhau, đặt cạnh nhau như hai mảnh ghép.', en: 'Two different palm shapes that fit together like puzzle pieces.' } },
  { id: 'fingers', sd: 0.06,
    alike: { vi: 'Tỷ lệ ngón tay trên lòng bàn tay gần như nhau, nên hai bàn tay đan vào nhau rất khớp.', en: 'Nearly the same finger-to-palm proportion, so your hands interlace neatly.' },
    complement: { vi: 'Ngón tay của một người dài hơn tương đối: khi đan tay, bàn tay này ôm trọn bàn tay kia.', en: 'One of you has relatively longer fingers: when you hold hands, one hand wraps the other.' } },
  { id: 'fate', sd: 0.25,
    alike: { vi: 'Đường Định mệnh của hai bạn giống nhau: cùng một kiểu định hướng cuộc sống.', en: 'Your fate lines match: a similar way of steering through life.' },
    complement: { vi: 'Một người có lộ trình rõ, một người thích ngẫu hứng: cùng nhau vừa có la bàn vừa có phiêu lưu.', en: 'One follows a map, one improvises: together you have a compass and an adventure.' } },
];

// ---------------------------------------------------------------------- Barnum

/** Generic statements in the style of Forer (1949) — nearly everyone accepts them. */
export const BARNUM: T[] = [
  { vi: 'Bạn có nhiều tiềm năng chưa được dùng hết.', en: 'You have a great deal of unused potential.' },
  { vi: 'Đôi khi bạn hướng ngoại, hoà đồng; lúc khác lại khép kín, dè dặt.', en: 'At times you are outgoing and sociable; at other times reserved and wary.' },
  { vi: 'Bạn khá nghiêm khắc với bản thân.', en: 'You tend to be critical of yourself.' },
  { vi: 'Bạn thích một mức độ thay đổi và không thích bị gò bó.', en: 'You prefer some change and variety and dislike being hemmed in.' },
  { vi: 'Bạn tự hào mình suy nghĩ độc lập, không dễ nghe theo người khác.', en: 'You pride yourself on thinking independently.' },
];
