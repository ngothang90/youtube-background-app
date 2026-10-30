# NgoThang_video — v0.2.0

Ứng dụng web/PWA tìm kiếm video YouTube chính thức, lưu từ khóa, video đã mở và danh sách yêu thích. Giao diện tự theo chế độ sáng/tối của thiết bị.

> **Bảo mật:** Không đặt API Key thật trong mã nguồn, `app.js`, `index.html`, `.env.example` hoặc GitHub. API Key chỉ được cấu hình ở máy chủ Vercel bằng biến môi trường `YOUTUBE_API_KEY`.

## Bắt đầu nhanh — không cần cài phần mềm lập trình

Đọc tệp **`BAT_DAU_NHANH.html`** trong thư mục này. Tệp đó hướng dẫn theo từng màn hình:

1. Tạo repository GitHub và tải mã nguồn lên.
2. Import repository vào Vercel.
3. Thêm `YOUTUBE_API_KEY` trong Vercel.
4. Deploy và kiểm tra ứng dụng.

Các trang cần dùng:

- GitHub: https://github.com/new
- Vercel: https://vercel.com/new
- Google Cloud Credentials: https://console.cloud.google.com/apis/credentials
- YouTube Data API v3: https://console.cloud.google.com/apis/library/youtube.googleapis.com

## Công nghệ

- HTML, CSS và JavaScript thuần; không cần bước build.
- Vercel Static + Serverless Functions (`/api`).
- YouTube Data API v3 để tìm kiếm video công khai.
- YouTube Embedded Player chính thức để phát video.
- PWA manifest + service worker để cài trên màn hình chính.
- LocalStorage lưu lịch sử trên từng trình duyệt/thiết bị.

## Cấu hình API Key

Trong Vercel, mở Project → Settings → Environment Variables và thêm:

- **Name:** `YOUTUBE_API_KEY`
- **Value:** API Key mới của bạn (không có dấu ngoặc kép, không có khoảng trắng thừa).
- **Environment:** ít nhất chọn `Production`; chọn thêm `Preview` nếu cần thử bản preview.

Nhấn Save, sau đó vào Deployments và Redeploy deployment mới nhất. Vercel chỉ áp dụng thay đổi biến môi trường cho deployment mới, không tự thay đổi deployment cũ.

Google Cloud khuyến nghị giới hạn API Key theo API. Với ứng dụng này, trong Google Cloud → APIs & Services → Credentials → chọn API Key → API restrictions, chọn **Restrict key** và chỉ cho phép **YouTube Data API v3**. Do backend chạy trên Vercel serverless, không đặt HTTP referrer restriction như đối với khóa dùng trực tiếp trong trình duyệt. Chỉ đặt IP restriction khi bạn có egress IP tĩnh phù hợp.

Backend gửi API Key qua HTTP header `X-Goog-Api-Key`, không gắn key vào URL. Không bật `NEXT_PUBLIC_` hoặc biến môi trường public cho API Key.

## Kiểm tra sau khi Deploy

Giả sử domain Vercel của bạn là `https://ten-du-an.vercel.app`:

1. Mở `https://ten-du-an.vercel.app/api/health`.
2. Kết quả mong đợi khi đã thêm biến môi trường:

```json
{
  "ok": true,
  "app": "NgoThang_video",
  "youtubeApiKeyConfigured": true
}
```

Endpoint này chỉ xác nhận biến môi trường đã được máy chủ nhận, không tiết lộ API Key và không khẳng định key chắc chắn hợp lệ.

3. Mở trang chủ và thử tìm một từ khóa, ví dụ `nhạc thư giãn`.
4. Nếu vẫn chưa có kết quả, xem phần “Xử lý lỗi thường gặp” ở cuối `BAT_DAU_NHANH.html`.

## Chạy thử trên máy tính (tùy chọn)

Cần Node.js 20 trở lên và Vercel CLI:

```bash
npm install -g vercel
vercel dev
```

Tạo `.env.local` trong thư mục gốc, chỉ trên máy của bạn:

```text
YOUTUBE_API_KEY=YOUR_NEW_KEY
```

`.env.local` đã được `.gitignore` loại trừ. Không tải file này lên GitHub. Sau đó mở địa chỉ local mà Vercel CLI cung cấp.

## Tính năng bản 0.2.0

- Tìm kiếm video YouTube công khai, ưu tiên video có thể nhúng.
- Phát bằng YouTube Embedded Player chính thức.
- Lưu tối đa 25 từ khóa tìm gần đây.
- Lưu video đã mở và danh sách yêu thích trên thiết bị.
- Khôi phục kết quả mới nhất ở trang chủ từ cache cục bộ, không tự gọi search API mỗi lần khởi động.
- Chọn lại từ khóa cũ có thể dùng cache trong 6 giờ; tìm từ ô tìm kiếm sẽ gọi YouTube để lấy kết quả mới.
- Dữ liệu YouTube được lưu cục bộ tối đa 30 ngày rồi tự loại bỏ.
- Xóa lịch sử, video đã xem, yêu thích và cache trong mục Lịch sử.
- Có trang kiểm tra cấu hình API `/api/health`.
- Giao diện tự theo `prefers-color-scheme` và responsive cho desktop/mobile.
- PWA có manifest, service worker, offline fallback và hướng dẫn cài đặt iPhone/Android.

## Quota YouTube

YouTube Data API v3 có hạn mức mặc định 100 lượt gọi `search.list` mỗi ngày cho mỗi project; mỗi lần gọi `search.list` tốn 1 đơn vị trong nhóm quota tìm kiếm. Hạn mức có thể thay đổi và có thể kiểm tra trong Google Cloud Console. Ứng dụng đã tránh tự gọi tìm kiếm mới ở mỗi lần mở để tiết kiệm quota.

## Giới hạn phát nền

Ứng dụng dùng YouTube Embedded Player chính thức. Không cung cấp chế độ audio-only, tải video hay phát YouTube khi ứng dụng bị thu nhỏ/đóng. Đây là giới hạn cần giữ để tuân thủ chính sách YouTube API.

## Dữ liệu và quyền riêng tư

- Lịch sử từ khóa do app tạo được lưu trên thiết bị cho đến khi người dùng xóa.
- Metadata video và kết quả API được lưu tạm không quá 30 ngày, sau đó tự xóa.
- Bản này chưa có đăng nhập và chưa đồng bộ lịch sử giữa các thiết bị.
- Trang `/privacy.html` giải thích dữ liệu được lưu và có nút xóa dữ liệu.

Trước khi phát hành công khai, chủ sở hữu ứng dụng cần bổ sung thông tin liên hệ thực tế trong chính sách quyền riêng tư và rà soát điều khoản hiện hành của YouTube.

## Cấu trúc

```text
NgoThang_video/
├── api/
│   ├── health.js              # Kiểm tra máy chủ đã nhận biến môi trường chưa
│   └── youtube-search.js      # Tìm kiếm YouTube; API Key chỉ ở server
├── assets/                    # Biểu tượng PWA
├── .github/workflows/         # Kiểm tra cú pháp tự động
├── .env.example               # Mẫu tên biến, không chứa key thật
├── .gitignore                 # Chặn file .env và .vercel khỏi Git
├── BAT_DAU_NHANH.html         # Hướng dẫn triển khai từng bước
├── app.js
├── index.html
├── manifest.webmanifest
├── offline.html
├── package.json
├── privacy.html
├── styles.css
├── sw.js
└── vercel.json
```
