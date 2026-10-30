# NgoThang_video — GitHub Pages Edition (v0.5.0)

Bản cập nhật giao diện trực quan và chẩn đoán lỗi tìm kiếm YouTube API.

## Điểm mới v0.5.0

- Trang chủ có banner đồ họa và 6 thẻ chủ đề lớn: Âm nhạc, Công nghệ, Phim & giải trí, Thể thao, Kiến thức, Du lịch.
- Video dùng thumbnail lớn, nút phát và nút yêu thích nằm ngay trên ảnh; giảm các nút chữ dài.
- Bố cục 4 cột trên desktop, 2 cột trên điện thoại.
- Khi YouTube API lỗi, hiển thị HTTP status, API reason và cách xử lý phù hợp.
- Sửa hướng dẫn Website restrictions: ứng dụng dùng `strict-origin-when-cross-origin`, nên Google nhận referrer ở cấp domain chứ không nhận đường dẫn `/NgoThang_video/`.
- Đổi URL phiên bản `config.js` và tên cache Service Worker để buộc trình duyệt nhận bản cập nhật mới.

## Cập nhật từ v0.4.0 — giữ nguyên API Key

**Gói `NgoThang_video_v0.5.0_UPDATE.zip` không chứa `config.js` có chủ đích.** Khi tải các file trong gói lên repository hiện có, hãy ghi đè `index.html`, `app.js`, `styles.css`, `sw.js`, README và hướng dẫn; không xóa hoặc tạo lại file `config.js` đang chứa API Key dùng chung.

Nếu cài mới hoàn toàn, tạo `config.js` ở thư mục gốc theo mẫu:

```js
window.NGOTHANG_CONFIG = Object.freeze({
  YOUTUBE_API_KEY: "DAN_API_KEY_CUA_BAN_VAO_DAY"
});
```

Không đưa API Key thật vào chat. Vì GitHub Pages là hosting tĩnh, key được trình duyệt tải xuống và không thể giữ bí mật tuyệt đối. Chỉ sử dụng key riêng cho ứng dụng này.

## Cấu hình Google Cloud cho GitHub Pages

1. Bật **YouTube Data API v3** trong đúng Google Cloud Project.
2. API restrictions: chỉ cho phép **YouTube Data API v3**.
3. Application restrictions: chọn **Websites**.
4. Thêm cả hai referrer (thay username GitHub thật):
   - `https://TEN_GITHUB_CUA_BAN.github.io`
   - `https://TEN_GITHUB_CUA_BAN.github.io/*`

Không chỉ giới hạn theo `https://TEN_GITHUB_CUA_BAN.github.io/NgoThang_video/*`. Với chính sách `strict-origin-when-cross-origin`, request cross-origin gửi referrer ở cấp origin/domain, không gửi đường dẫn repository. Tài liệu Google giải thích website restrictions theo HTTP referrer và lưu ý trường hợp trình duyệt chỉ gửi origin: https://docs.cloud.google.com/docs/authentication/api-keys

## Triệu chứng API thường gặp

- `API_KEY_HTTP_REFERRER_BLOCKED` hoặc lỗi `forbidden`: kiểm tra Website restrictions.
- `accessNotConfigured`: bật YouTube Data API v3 trong đúng project.
- `keyInvalid` / `API_KEY_INVALID`: kiểm tra key trong `config.js`.
- `quotaExceeded` / `dailyLimitExceeded`: kiểm tra quota của project.
- `NETWORK_OR_CORS_ERROR`: kiểm tra kết nối mạng, phần mềm chặn request hoặc trình duyệt.

## Dùng ứng dụng

- GitHub repository lưu mã nguồn.
- GitHub Pages xuất bản website.
- Người mở cùng đường link dùng chung API Key, không cần nhập riêng.
- Tìm kiếm, lịch sử, video đã xem và yêu thích lưu cục bộ trên từng trình duyệt. Chúng chưa đồng bộ giữa các thiết bị.
- Video được phát bằng YouTube Embedded Player chính thức; không được cung cấp phát nền khi ứng dụng bị thu nhỏ/đóng.

## Cấu trúc chính

```text
NgoThang_video/
├── assets/
├── config.js              # API Key dùng chung (giữ nguyên khi cập nhật)
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── offline.html
├── privacy.html
└── BAT_DAU_NHANH.html
```
