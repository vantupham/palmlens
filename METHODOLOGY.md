# Phương pháp / Methodology

Tài liệu này mô tả chính xác PalmLens đo gì, đo thế nào, và **không** đo được gì.

## 1. Điểm mốc bàn tay

[MediaPipe Hand Landmarker](https://arxiv.org/abs/2006.10214) trả về 21 điểm mốc theo pixel ảnh, kèm 21 điểm "world" theo mét (3D, ước lượng). Số đo tỷ lệ dùng điểm world khi có, vì chúng ít bị méo phối cảnh hơn.

Chỉ số các điểm: 0 cổ tay · 1–4 ngón cái · 5–8 ngón trỏ · 9–12 ngón giữa · 13–16 ngón áp út · 17–20 ngón út (khớp gốc → đầu ngón).

## 2. Khung toạ độ lòng bàn tay

- `v`: trục từ cổ tay (0) tới khớp gốc ngón giữa (1).
- `u`: vuông góc, đơn vị = khoảng cách khớp gốc ngón trỏ ↔ ngón út; dấu dương hướng về phía ngón trỏ/ngón cái.

Khung này giống nhau cho tay trái, tay phải và ảnh lật gương, nên mọi bước sau không cần biết đó là tay nào.

## 3. Số đo

| Chỉ số | Công thức | Ghi chú |
| --- | --- | --- |
| Độ dài ngón | tổng đoạn khớp gốc → khớp giữa → khớp đầu → đầu ngón | Không phải phương pháp nhân trắc chuẩn (đo từ nếp gốc ngón), nên giá trị tuyệt đối khác các nghiên cứu đo bằng thước kẹp |
| 2D:4D | độ dài ngón trỏ / độ dài ngón áp út | Ước lượng |
| Dài/rộng lòng bàn tay | `d(0,9) / d(5,17)` | `d(5,17)` là bề rộng khớp gốc ngón, hẹp hơn bề rộng lòng bàn tay thật |
| Ngón giữa/lòng bàn tay | độ dài ngón giữa / `d(0,9)` | |
| Ngón út dài | đầu ngón út vượt khớp đầu ngón áp út theo trục `v` | |

**Dáng tay (4 nguyên tố)** được suy ra từ hai chỉ số trên, so với mốc `1.42` (dài/rộng) và `0.92` (ngón/lòng). Đây là **ước lượng ban đầu**, cần hiệu chỉnh lại bằng dữ liệu beta (xem `src/metrics/metrics.ts`). Giao diện luôn hiện vị trí liên tục trên bản đồ dáng tay chứ không chỉ một nhãn.

## 4. Tách đường chỉ tay

1. **Nắn phẳng**: lấy mẫu vùng lòng bàn tay vào một ảnh chuẩn 220 px theo khung `(u, v)`. Mặt nạ đa giác dựng từ các điểm 0, 1, 2, 5, 9, 13, 17 cộng ước lượng mép ngoài phía ngón út, thu vào 3% để tránh mép.
2. **Chuẩn hoá tương phản cục bộ**: trừ nền mờ Gauss (σ = 9 px), chia cho độ lệch chuẩn cục bộ (σ = 12 px).
3. **Đáp ứng "rãnh"**: ma trận Hessian ở 3 tỉ lệ; lấy trị riêng lớn λ₁ > 0 (rãnh tối), phạt cấu trúc dạng đốm bằng |λ₂|/λ₁, chuẩn hoá theo phân vị 98,5%.
4. **Tìm đường bằng quy hoạch động** trong vùng giải phẫu tương ứng:
   - *Tâm đạo* (nếp ngang xa): dải quanh đường nối khớp gốc ngón út → ngón giữa.
   - *Trí đạo* (nếp ngang gần): từ mép phía ngón trỏ dốc xuống phía ngón út; tránh vùng Tâm đạo.
   - *Sinh đạo* (nếp ô mô cái): tìm trong toạ độ cực quanh gốc ngón cái.
   - *Định mệnh*: dải dọc giữa lòng bàn tay; ngưỡng cao hơn vì thường mờ hoặc không có.
5. **Đo độ sâu tuyệt đối của nếp gấp**: `dip = nền mờ (σ×4) − ảnh mờ nhẹ (σ)`, tính bằng đơn vị độ sáng. Ngưỡng nhiễu `N = 1,4826 × MAD(dip)` trên toàn lòng bàn tay (vân da + nhiễu ảnh). Mỗi điểm trên đường có `SNR = dip / N`.
6. **Cắt đoạn và quyết định "thấy"**: giữ đoạn dài nhất có SNR ≥ 2,2 (cho phép hở ngắn). Một đường chỉ được coi là **thấy** khi đủ dài, SNR trung bình ≥ 3,0 (Định mệnh ≥ 3,8) **và** độ sâu trung bình ≥ 0,8% độ sáng. Độ rõ = (SNR − 2) / 6, kẹp trong 0–1. Nhờ vậy ảnh phẳng hoặc nhiễu sẽ cho kết quả "không thấy rõ" thay vì đoán.
7. **Ghép nhiều khung hình** (webcam/camera): chụp liên tiếp ~8 khung, mỗi khung được lấy mẫu vào cùng lưới lòng bàn tay bằng điểm mốc của chính nó, rồi lấy trung bình. Khung có bàn tay xoay lệch quá 12–15% bị bỏ. Trên camera sau của điện thoại, app thử chụp thêm ảnh độ phân giải đầy đủ (ImageCapture) làm ảnh chính.

Báo cáo cho mỗi đường: độ dài (theo bề rộng khớp gốc), độ cong (độ lệch lớn nhất khỏi dây cung / dây cung) và độ rõ.

**Kiểm thử trên tay mẫu có làm xấu** (`makeDemoHand` với `crease`, `noise`, `light`, `blur`): nếp rõ → thấy cả 4 đường; nếp 20% → thấy 3 đường chính, bỏ Định mệnh; không có nếp (kể cả nhiễu hoặc mờ) → không thấy đường nào, độ tin cậy 30%; nếp 30% + nhiễu mạnh → độ rõ ~0,35 với 1 khung, ~1,0 khi ghép 8 khung. Đây là dữ liệu tổng hợp, chưa thay được kiểm thử trên ảnh tay thật.
8. **Nếp ngang đơn**: chỉ gắn cờ khi Tâm đạo chạy hết sang phía ngón trỏ **và** Trí đạo yếu. Đây là phỏng đoán hình ảnh, không phải chẩn đoán.

### Trợ giúp khi quét

- **Đồng hồ "Độ rõ chỉ tay"** chạy trên khung hình thu nhỏ khoảng 2 lần/giây; app chỉ tự chụp khi độ rõ ≥ 0,4, nếu không sẽ gợi ý nghiêng tay về phía nguồn sáng hoặc khum nhẹ.
- **Mặt lòng hay mu bàn tay**: so nhãn tay trái/phải của MediaPipe với chiều quay của các khớp gốc ngón trong ảnh (không lật gương). Khi điểm tin cậy của nhãn < 0,8 thì bỏ qua kiểm tra.
- **Màn hướng dẫn ánh sáng** trước khi bật camera: ánh sáng xiên làm nếp gấp đổ bóng; ánh sáng chiếu thẳng hoặc ngược sáng làm nếp gấp "phẳng".

### Giới hạn đã biết

- Ảnh thiếu sáng, mờ, hoặc bàn tay nhỏ trong khung làm đường chỉ kém chính xác. App hiện cảnh báo chất lượng và "độ tin cậy".
- Các nếp phụ, vết chai, vân tay lòng bàn tay có thể bị nhầm thành đường chính.
- Chưa có tập dữ liệu gán nhãn để đo sai số. Bước tiếp theo trong lộ trình là thu thập ảnh tự nguyện (opt-in) và huấn luyện một U-Net nhỏ.

## 5. Diễn giải

- **Lớp Khoa học**: chỉ các nhận định có nguồn (xem `SOURCES` trong `src/interpret/knowledge.ts`).
- **Lớp Truyền thống**: diễn giải chỉ tay học phương Tây phổ biến, chọn theo ngưỡng số đo. Luôn tích cực, không bao giờ nói về bệnh tật, cái chết, tai nạn hay tài chính.
- **Cặp đôi**: so 8 đặc trưng, chuẩn hoá theo độ lệch điển hình; 3 đặc trưng gần nhau nhất là "giống nhau", 3 xa nhất là "bổ trợ". Không có điểm số tương hợp.

## 6. Nguồn

1. Kimura & Kitagawa (1986). *Embryological development of human palmar, plantar, and digital flexion creases.* The Anatomical Record 216(2). https://doi.org/10.1002/ar.1092160211
2. Wertheim, K. *Embryology and Morphology of Friction Ridge Skin.* The Fingerprint Sourcebook, ch. 3, U.S. NIJ. https://www.ojp.gov/pdffiles1/nij/225323.pdf
3. MedlinePlus. *Single palmar crease.* https://medlineplus.gov/ency/article/003290.htm
4. Manning et al. (1998). Human Reproduction 13(11). https://doi.org/10.1093/humrep/13.11.3000
5. Hönekopp & Watson (2010). *Meta-analysis of digit ratio 2D:4D shows greater sex difference in the right hand.* Am. J. Human Biology 22(5). https://doi.org/10.1002/ajhb.21054
6. Forer (1949). *The fallacy of personal validation.* J. Abnormal and Social Psychology 44(1). https://doi.org/10.1037/h0059240
7. Zhang et al. (2020). *MediaPipe Hands: On-device Real-time Hand Tracking.* https://arxiv.org/abs/2006.10214
