# PalmLens AI ✋✨

**Bàn tay bạn: điều khoa học đo được và điều người xưa tin.**
*Your hand: what science can measure and what tradition believes.*

👉 **Dùng thử: https://vantupham.github.io/palmlens/**

PalmLens AI là web app mã nguồn mở, chạy **hoàn toàn trên trình duyệt**. Bạn đưa lòng bàn tay lên webcam (hoặc tải ảnh lên). Thị giác máy tính dò 21 điểm khớp, tìm các đường chỉ tay, đo đạc, rồi đọc bàn tay theo **hai lớp** đặt cạnh nhau:

| 🔬 Khoa học | 🔮 Truyền thống |
| --- | --- |
| Số đo thật: tỷ lệ ngón, 2D:4D, dáng lòng bàn tay, độ dài/độ cong/độ rõ của từng nếp gấp | Diễn giải chỉ tay học: Tâm đạo, Trí đạo, Sinh đạo, Định mệnh, 4 dáng tay, 12 kiểu tay |
| Giải phẫu và phôi học của nếp gấp, kèm trích dẫn nghiên cứu | Ghi rõ là **giải trí và văn hoá**, không có giá trị dự đoán |

## Tính năng

- **Một bàn tay**: webcam có khung hướng dẫn, tự chụp khi tay đứng yên; hoặc tải ảnh lên; hoặc thử với tay mẫu.
- **Trợ giúp khi quét**: màn hướng dẫn ánh sáng, đồng hồ "Độ rõ chỉ tay" chạy trực tiếp, cảnh báo khi đưa mu bàn tay, ghép ~8 khung hình để giảm nhiễu, camera sau + đèn flash trên điện thoại.
- **Trung thực về độ chính xác**: chỉ báo đường chỉ khi nếp gấp sâu rõ hơn hẳn nhiễu ảnh; nếu không, app nói "không thấy rõ" và gợi ý chụp lại.
- **Sửa đường chỉ**: kéo các điểm để chỉnh khi AI nhận sai, hoặc đánh dấu tay không có đường đó.
- **AI nhìn thấy gì**: xem bản đồ nếp gấp mà thuật toán thực sự "thấy" trên lòng bàn tay bạn.
- **Hai bàn tay của tôi**: so tay trái với tay phải, có "Gương soi" chồng hai tay lên nhau và độ đối xứng.
- **Chế độ Cặp đôi**: hai người yêu nhau ghép tay trên cùng một máy hoặc qua link mời. Kết quả là 1 trong 10 kiểu cặp đôi, 3 điểm giống nhau và 3 điểm bổ trợ. Không bao giờ chấm "không hợp".
- **Thí nghiệm Barnum**: chấm điểm độ "trúng" của bài đọc, rồi lật bài xem câu nào ai đọc cũng thấy đúng (Forer, 1949).
- **Thẻ chia sẻ** 9:16 và 1:1 với bàn tay cách điệu (không dùng ảnh thật của bạn).
- Song ngữ **Tiếng Việt / English**.

## Quyền riêng tư

- Ảnh **không bao giờ** được tải lên đâu cả. Mọi xử lý chạy trên máy bạn (WebAssembly + Canvas).
- Mô hình AI và thư viện được phục vụ từ chính trang này, không qua CDN bên thứ ba.
- Link mời cặp đôi chỉ chứa **số đo đã làm tròn** và biệt danh, không chứa ảnh.
- Không cookie, không theo dõi. Xem [PRIVACY.md](PRIVACY.md).

## Cách hoạt động

```
Webcam / ảnh → MediaPipe Hands (21 điểm mốc 3D)
            → nắn phẳng lòng bàn tay theo khung toạ độ từ điểm mốc
            → bộ lọc Hessian đa tỉ lệ làm sáng các rãnh tối mảnh (nếp gấp)
            → quy hoạch động tìm đường mạnh nhất trong từng vùng giải phẫu
            → đo độ dài, độ cong, độ rõ → diễn giải hai lớp
```

Chi tiết thuật toán, công thức và giới hạn: [METHODOLOGY.md](METHODOLOGY.md).

## Chạy trên máy

```bash
npm install
npm run fetch-model   # tải mô hình hand_landmarker.task (~7.5 MB) vào public/models
npm run dev           # http://localhost:5173/palmlens/
```

Bỏ qua `fetch-model` thì app tự lấy mô hình từ máy chủ của Google khi chạy.

## Triển khai lên GitHub Pages

1. Đẩy code lên repo `palmlens` (nhánh `main`).
2. Vào **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Workflow `.github/workflows/deploy.yml` sẽ build và đăng lên `https://<user>.github.io/palmlens/`.

Nếu đổi tên repo, sửa `base` trong `vite.config.ts`.

## Đo lượng truy cập (tuỳ chọn)

PalmLens dùng [GoatCounter](https://www.goatcounter.com): miễn phí cho dự án phi thương mại, không cookie, không thu thập dữ liệu cá nhân. Mặc định **tắt**.

1. Đăng ký tại goatcounter.com, chọn mã trang, ví dụ `palmlens` (bảng số liệu sẽ ở `palmlens.goatcounter.com`).
2. Trong repo: **Settings → Secrets and variables → Actions → Variables → New variable**, tên `GOATCOUNTER_CODE`, giá trị `palmlens`.
3. Chạy lại workflow deploy.

Trình duyệt bật "Do Not Track" sẽ không bị đếm. App chỉ gửi tên màn hình và tên sự kiện, không bao giờ gửi ảnh, số đo, tên hay nội dung link mời.

| Sự kiện | Ý nghĩa | Dùng cho chỉ số |
| --- | --- | --- |
| `analysis_done/<camera\|upload\|demo>` | Phân tích xong một bàn tay | Tỷ lệ hoàn thành |
| `card_open/<loại>`, `card_share/<loại>-<khổ>-<shared\|downloaded>` | Mở và chia sẻ thẻ | Tỷ lệ chia sẻ |
| `video_made/<loại>` | Xuất video 6 giây | Tỷ lệ chia sẻ |
| `invite_created`, `invite_opened`, `couple_result/<cặp nguyên tố>` | Link mời cặp đôi | Hệ số lan toả (K-factor) |
| `heart_start`, `heart_captured` | Mini-game Trái tim hai bàn tay | |
| `barnum_rated/<1-5>` | Điểm người dùng chấm bài đọc | Tỷ lệ làm thí nghiệm Barnum |
| `line_edit_open`, `line_edit_saved` | Người dùng sửa đường chỉ | Đo chất lượng bộ tách chỉ tay |

## Cấu trúc

```
src/
├── vision/       # MediaPipe, khung toạ độ lòng bàn tay, tách đường chỉ
├── metrics/      # 2D:4D, tỷ lệ bàn tay, phân loại dáng tay
├── interpret/    # kho tri thức song ngữ (có nguồn), diễn giải, cặp đôi
├── render/       # vẽ khung xương, đường chỉ phát sáng, bàn tay cách điệu
├── share/        # thẻ chia sẻ, mã hoá link mời
└── ui/           # màn hình: chụp, kết quả, hai tay, cặp đôi
```

## Đóng góp

Rất hoan nghênh, đặc biệt là:
- Kiểm chứng và bổ sung trích dẫn khoa học trong `src/interpret/knowledge.ts`.
- Cải thiện bộ tách đường chỉ (ảnh thiếu sáng, da sẫm màu, tay nhiều nếp phụ).
- Thêm ngôn ngữ.

Xem [CONTRIBUTING.md](CONTRIBUTING.md).

## Giấy phép

Mã nguồn: MIT. Nội dung kho tri thức: CC BY-SA 4.0. MediaPipe: Apache 2.0.

---

*Phần Truyền thống mang tính giải trí và văn hoá. PalmLens không chẩn đoán y khoa và không dự đoán tương lai.*
