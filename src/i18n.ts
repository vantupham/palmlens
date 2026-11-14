import type { Lang } from './types';

export type T = { vi: string; en: string };

let lang: Lang = (() => {
  try {
    const saved = localStorage.getItem('palmlens.lang');
    if (saved === 'vi' || saved === 'en') return saved;
  } catch { /* storage unavailable */ }
  return navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
})();

export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l;
  try { localStorage.setItem('palmlens.lang', l); } catch { /* ignore */ }
}
export const tr = (x: T) => x[lang];

const S = {
  tagline: { vi: 'Bàn tay bạn: điều khoa học đo được và điều người xưa tin', en: 'Your hand: what science can measure and what tradition believes' },
  heroLead: {
    vi: 'Đưa lòng bàn tay lên camera hoặc tải ảnh lên. AI dò 21 điểm khớp, tìm các đường chỉ tay rồi đọc chúng theo hai cách: khoa học và truyền thống.',
    en: 'Hold your palm up to the camera or upload a photo. The AI finds 21 joints and your palm creases, then reads them two ways: science and tradition.',
  },
  privacy: { vi: 'Ảnh không bao giờ rời khỏi máy bạn', en: 'Your photo never leaves your device' },
  startCamera: { vi: 'Đưa tay lên camera', en: 'Use my camera' },
  upload: { vi: 'Tải ảnh lên', en: 'Upload a photo' },
  demo: { vi: 'Thử với tay mẫu', en: 'Try a sample hand' },
  modeSingle: { vi: 'Một bàn tay', en: 'One hand' },
  modeBoth: { vi: 'Hai bàn tay của tôi', en: 'Both my hands' },
  modeCouple: { vi: 'Cặp đôi', en: 'Couple' },
  modeSingleDesc: { vi: 'Đọc nhanh một tay, khoảng 30 giây', en: 'A quick reading of one hand, about 30 seconds' },
  modeBothDesc: { vi: 'So tay trái với tay phải: bẩm sinh và hiện tại', en: 'Compare left and right: who you were born as and who you became' },
  modeCoupleDesc: { vi: 'Hai người yêu nhau ghép tay, nhận kiểu cặp đôi', en: 'Two partners match hands and get their couple type' },
  loadingModel: { vi: 'Đang tải mô hình AI (lần đầu có thể mất vài giây)…', en: 'Loading the AI model (the first time can take a few seconds)…' },
  cameraDenied: { vi: 'Không mở được camera. Bạn có thể tải ảnh lên thay thế.', en: 'Could not open the camera. You can upload a photo instead.' },
  noHand: { vi: 'Không tìm thấy bàn tay trong ảnh. Hãy chụp lòng bàn tay, xoè ngón, đủ sáng.', en: 'No hand found. Photograph your open palm, fingers spread, in good light.' },
  modelError: { vi: 'Không tải được mô hình AI. Kiểm tra kết nối mạng rồi thử lại.', en: 'Could not load the AI model. Check your connection and try again.' },
  guideShow: { vi: 'Đưa lòng bàn tay vào khung, xoè 5 ngón', en: 'Place your open palm in the frame, fingers spread' },
  guideCloser: { vi: 'Đưa tay lại gần hơn', en: 'Move your hand closer' },
  guidePalm: { vi: 'Hãy quay lòng bàn tay về phía camera', en: 'Turn your palm toward the camera' },
  guideSpread: { vi: 'Xoè rộng các ngón tay', en: 'Spread your fingers' },
  guideHold: { vi: 'Giữ yên…', en: 'Hold still…' },
  guideDark: { vi: 'Hơi tối, hãy ra chỗ sáng hơn', en: 'A bit dark, find more light' },
  scanLeft: { vi: 'Quét tay TRÁI', en: 'Scan your LEFT hand' },
  scanRight: { vi: 'Quét tay PHẢI', en: 'Scan your RIGHT hand' },
  capture: { vi: 'Chụp ngay', en: 'Capture now' },
  cancel: { vi: 'Huỷ', en: 'Cancel' },
  back: { vi: 'Quay lại', en: 'Back' },
  analyzing: { vi: 'AI đang đọc bàn tay…', en: 'Reading your hand…' },
  science: { vi: 'Khoa học', en: 'Science' },
  mystic: { vi: 'Truyền thống', en: 'Tradition' },
  scienceTag: { vi: 'KHOA HỌC', en: 'SCIENCE' },
  mysticTag: { vi: 'TRUYỀN THỐNG · GIẢI TRÍ', en: 'TRADITION · FOR FUN' },
  mysticNote: {
    vi: 'Phần Truyền thống mang tính giải trí và văn hoá, không có giá trị dự đoán.',
    en: 'The Tradition layer is cultural entertainment and has no predictive value.',
  },
  yourHand: { vi: 'Dáng tay của bạn', en: 'Your hand shape' },
  lines: { vi: 'Các đường chỉ tay', en: 'Palm lines' },
  measures: { vi: 'Số đo', en: 'Measurements' },
  traits: { vi: 'Đặc điểm đáng chú ý', en: 'Notable features' },
  sources: { vi: 'Nguồn tham khảo', en: 'Sources' },
  confidence: { vi: 'Độ tin cậy của phép đo', en: 'Measurement confidence' },
  notFound: { vi: 'Không thấy rõ', en: 'Not clearly visible' },
  layerSkeleton: { vi: 'Khung xương', en: 'Skeleton' },
  layerLines: { vi: 'Chỉ tay', en: 'Lines' },
  layerAI: { vi: 'AI nhìn thấy gì', en: 'What the AI sees' },
  aiSeesNote: {
    vi: 'Lòng bàn tay được nắn phẳng theo 21 điểm mốc, rồi bộ lọc Hessian làm sáng những rãnh tối mảnh. Đường sáng nhất trong từng vùng giải phẫu được chọn làm đường chỉ.',
    en: 'The palm is flattened using the 21 landmarks, then a Hessian filter lights up thin dark grooves. The brightest path in each anatomical zone becomes a line.',
  },
  makeCard: { vi: 'Tạo thẻ chia sẻ', en: 'Make a share card' },
  share: { vi: 'Chia sẻ', en: 'Share' },
  download: { vi: 'Tải ảnh về', en: 'Download' },
  copied: { vi: 'Đã sao chép liên kết', en: 'Link copied' },
  scanOther: { vi: 'Quét tay còn lại để so sánh', en: 'Scan your other hand to compare' },
  startCouple: { vi: 'Ghép đôi với người ấy', en: 'Match with your partner' },
  again: { vi: 'Làm lại từ đầu', en: 'Start over' },
  fingerLengths: { vi: 'Độ dài tương đối các ngón (so với ngón giữa)', en: 'Relative finger lengths (vs middle finger)' },
  thumb: { vi: 'Cái', en: 'Thumb' },
  index: { vi: 'Trỏ', en: 'Index' },
  middle: { vi: 'Giữa', en: 'Middle' },
  ring: { vi: 'Áp út', en: 'Ring' },
  pinky: { vi: 'Út', en: 'Little' },
  digitRatio: { vi: 'Tỷ lệ ngón trỏ / ngón áp út (2D:4D)', en: 'Index / ring finger ratio (2D:4D)' },
  palmRatio: { vi: 'Lòng bàn tay dài / rộng', en: 'Palm length / width' },
  fingerRatio: { vi: 'Ngón giữa / lòng bàn tay', en: 'Middle finger / palm' },
  shapeMap: { vi: 'Bản đồ dáng tay', en: 'Hand shape map' },
  longPalm: { vi: 'lòng dài', en: 'long palm' },
  squarePalm: { vi: 'lòng vuông', en: 'square palm' },
  longFingers: { vi: 'ngón dài', en: 'long fingers' },
  shortFingers: { vi: 'ngón ngắn', en: 'short fingers' },
  you: { vi: 'Bạn', en: 'You' },
  // two hands
  compareTitle: { vi: 'Tay trái và tay phải', en: 'Left hand and right hand' },
  mirror: { vi: 'Gương soi: hai tay chồng lên nhau', en: 'Mirror: both hands overlaid' },
  symmetry: { vi: 'Độ đối xứng', en: 'Symmetry' },
  dominantQ: { vi: 'Bạn thuận tay nào?', en: 'Which is your dominant hand?' },
  leftHand: { vi: 'Tay trái', en: 'Left hand' },
  rightHand: { vi: 'Tay phải', en: 'Right hand' },
  innate: { vi: 'Tay bẩm sinh', en: 'Born-with hand' },
  present: { vi: 'Tay hiện tại', en: 'Present hand' },
  leftSays: { vi: 'Tay trái nói', en: 'Left hand says' },
  rightSays: { vi: 'Tay phải nói', en: 'Right hand says' },
  sameSideWarn: { vi: 'Có vẻ bạn vừa quét lại cùng một tay. Hãy đổi tay nhé.', en: 'Looks like the same hand again. Please switch hands.' },
  // couple
  coupleTitle: { vi: 'Chế độ Cặp đôi: Hợp tay', en: 'Couple mode: Hand in Hand' },
  coupleIntro: {
    vi: 'Mỗi người quét hai tay của mình. Kết quả chỉ nói về điểm giống nhau và điểm bổ trợ, không chấm điểm hợp hay không hợp.',
    en: 'Each person scans their own hands. The result only shows what you share and how you complement each other. No compatibility score.',
  },
  ageCheck: { vi: 'Cả hai chúng tôi đều từ 16 tuổi trở lên và đồng ý tham gia', en: 'We are both 16 or older and both agree to take part' },
  nameA: { vi: 'Tên hoặc biệt danh của bạn', en: 'Your name or nickname' },
  nameB: { vi: 'Tên hoặc biệt danh người ấy', en: "Your partner's name or nickname" },
  sexOpt: { vi: 'Giới tính (không bắt buộc, chỉ dùng để so với số liệu trung bình)', en: 'Sex (optional, only used for population averages)' },
  sexNone: { vi: 'Không nêu', en: 'Prefer not to say' },
  male: { vi: 'Nam', en: 'Male' },
  female: { vi: 'Nữ', en: 'Female' },
  sameDevice: { vi: 'Cùng một máy', en: 'On this device' },
  sameDeviceDesc: { vi: 'Hai bạn đang ngồi cạnh nhau: lần lượt quét tay', en: 'Sitting together: scan one after the other' },
  remote: { vi: 'Gửi link mời', en: 'Send an invite link' },
  remoteDesc: { vi: 'Người ấy quét trên máy của họ. Link chỉ chứa số đo, không có ảnh.', en: 'Your partner scans on their own device. The link holds only numbers, no photo.' },
  personTurn: { vi: 'Lượt của', en: 'Turn:' },
  inviteReady: { vi: 'Link mời đã sẵn sàng', en: 'Your invite link is ready' },
  inviteFrom: { vi: 'mời bạn ghép tay trên PalmLens', en: 'invited you to match hands on PalmLens' },
  inviteAccept: { vi: 'Tôi đồng ý, bắt đầu quét tay', en: 'I agree, start scanning' },
  coupleType: { vi: 'Kiểu cặp đôi', en: 'Couple type' },
  alike: { vi: '3 điểm giống nhau', en: '3 things you share' },
  complement: { vi: '3 điểm bổ trợ', en: '3 ways you complement each other' },
  heartTogether: { vi: 'Hai đường Tâm đạo đặt cạnh nhau', en: 'Your heart lines side by side' },
  interlace: { vi: 'Đan tay', en: 'Hands together' },
  coupleScience: {
    vi: 'Nghiên cứu cho thấy bạn đời thường giống nhau ở một số đặc điểm như chiều cao hay học vấn (assortative mating). Nhưng không có bằng chứng nào cho thấy chỉ tay dự đoán được độ bền của một mối quan hệ.',
    en: 'Partners tend to resemble each other in some traits such as height or education (assortative mating). There is no evidence that palm lines predict how a relationship will go.',
  },
  sendBack: { vi: 'Gửi kết quả cho người ấy', en: 'Send the result to your partner' },
  // barnum
  barnumTitle: { vi: 'Bài đọc này đúng với bạn đến đâu?', en: 'How well does this reading fit you?' },
  barnumAsk: { vi: 'Chấm từ 1 đến 5 trước khi xem bí mật', en: 'Rate 1 to 5 before the reveal' },
  barnumReveal: { vi: 'Lật bài', en: 'Reveal' },
  portrait: { vi: 'Chân dung theo truyền thống', en: 'Traditional portrait' },
  // misc
  langSwitch: { vi: 'EN', en: 'VI' },
  footer: {
    vi: 'Mã nguồn mở · Ảnh được xử lý ngay trên trình duyệt · Phần Truyền thống chỉ để giải trí',
    en: 'Open source · Photos are processed in your browser · The Tradition layer is for fun',
  },
  github: { vi: 'Mã nguồn trên GitHub', en: 'Source on GitHub' },
  methodology: { vi: 'Phương pháp', en: 'Methodology' },
  qDark: { vi: 'Ảnh hơi tối', en: 'Photo is dark' },
  qBright: { vi: 'Ảnh bị chói', en: 'Photo is overexposed' },
  qBlurry: { vi: 'Ảnh hơi mờ', en: 'Photo is blurry' },
  qSmall: { vi: 'Bàn tay quá nhỏ trong ảnh', en: 'Hand is small in the frame' },
  qTip: { vi: 'Kết quả đường chỉ có thể kém chính xác. Thử lại ở nơi sáng, tay gần camera hơn.', en: 'Line results may be less accurate. Try brighter light with your hand closer.' },
  sampleBadge: { vi: 'TAY MẪU', en: 'SAMPLE HAND' },
  palmShort: { vi: 'Dài / rộng', en: 'Length / width' },
  linesFound: { vi: 'Đường chỉ', en: 'Lines found' },
  whichHand: { vi: 'Đây là tay nào?', en: 'Which hand is this?' },
};

export type Key = keyof typeof S;
export const t = (k: Key) => S[k][lang];
