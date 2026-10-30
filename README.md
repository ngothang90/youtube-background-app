# NgoThang_video — GitHub Pages Edition (v0.3.0)

Ứng dụng PWA tìm kiếm video YouTube chính thức, có lịch sử tìm kiếm, video đã mở, yêu thích và gợi ý dựa trên lịch sử. Giao diện tự động theo chế độ sáng/tối của thiết bị.

## Chỉ dùng GitHub

- GitHub repository: lưu toàn bộ mã nguồn.
- GitHub Pages: xuất bản website tĩnh miễn phí.
- Không cần Vercel, Supabase, Node.js hay máy chủ riêng.
- Để triển khai: tải toàn bộ nội dung thư mục này lên root của repository `NgoThang_video`, rồi vào Settings → Pages → Deploy from a branch → `main` → `/(root)` → Save.

Đọc `BAT_DAU_NHANH.html` để xem hướng dẫn tiếng Việt.

## Cấu hình YouTube API Key

GitHub Pages chỉ phục vụ file tĩnh, không có backend để giữ bí mật API Key. Vì vậy bản này có nút bánh răng **Cài đặt API** ngay trong ứng dụng. Người dùng dán API Key vào đó; khóa được lưu trong `localStorage` của trình duyệt hiện tại và không nằm trong source code/repository. Khi dùng một thiết bị/trình duyệt khác, cần nhập khóa lại trên thiết bị đó.

**Không commit API Key vào GitHub.** API Key dùng trong trình duyệt có thể bị người dùng thiết bị đó xem; hãy tạo khóa riêng cho ứng dụng, giới hạn API chỉ là **YouTube Data API v3**, đồng thời giới hạn Website restrictions đến domain GitHub Pages của bạn, ví dụ `https://USERNAME.github.io/*`. Nên rotate key trước đó nếu đã gửi trong chat hoặc đưa vào mã nguồn.

Ứng dụng gọi YouTube Data API trực tiếp từ trình duyệt và gửi API Key bằng tham số `key` theo tài liệu riêng của YouTube Data API. Vì đây là ứng dụng tĩnh, khóa có thể nhìn thấy trong Developer Tools/request của trình duyệt; khóa không được ghi vào GitHub. Hãy giới hạn Website referrer và chỉ cho phép YouTube Data API v3.

## Tính năng

- Tìm kiếm video công khai với YouTube Data API v3.
- Phát bằng YouTube Embedded Player chính thức.
- Lưu tối đa 25 từ khóa tìm gần đây.
- Lưu video đã mở và danh sách yêu thích trên thiết bị.
- Lưu kết quả tìm kiếm để khôi phục trang chủ và giảm lượt gọi API.
- Dữ liệu YouTube được lưu cục bộ tối đa 30 ngày rồi tự loại bỏ.
- Xóa lịch sử, video đã xem, yêu thích và cache trong mục Lịch sử.
- Cấu hình/thay/xóa API Key ngay trong app.
- Tự đổi Light/Dark theo `prefers-color-scheme`.
- PWA manifest, service worker và offline fallback.
- URL và service worker hỗ trợ GitHub Project Pages có thư mục con `/NgoThang_video/`.

## Giới hạn

- Lịch sử và API Key lưu trên từng trình duyệt, chưa đồng bộ qua thiết bị.
- YouTube Embedded Player không được ứng dụng tùy biến để tiếp tục phát nền khi bị thu nhỏ/đóng.
- GitHub Pages site là website công khai; source code không nên chứa dữ liệu bí mật.

## Hạn mức YouTube

Mặc định, `search.list` có hạn mức 100 lượt gọi mỗi ngày cho mỗi Google Cloud project. Ứng dụng lưu cache kết quả để hạn chế gọi lại. Hạn mức có thể thay đổi; xem Google Cloud Console và tài liệu YouTube chính thức.

## Cấu trúc

```text
NgoThang_video/
├── assets/
├── BAT_DAU_NHANH.html
├── index.html
├── app.js
├── styles.css
├── manifest.webmanifest
├── sw.js
├── offline.html
└── privacy.html
```
