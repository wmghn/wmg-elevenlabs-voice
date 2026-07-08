# ElevenLabs Voice Generator

Công cụ tạo giọng nói từ văn bản (TTS) qua API ElevenLabs, chạy trên Netlify. Gồm hai chế độ:

- **Text to Speech** — tạo nhiều block nội dung, mỗi block xuất một file MP3.
- **Studio** — tạo Studio project trên tài khoản ElevenLabs rồi tải audio về. Tool **không** truy cập danh sách Studio project có sẵn (proxy chặn endpoint liệt kê để không lộ Studio của các bên khác dùng chung API key). Tên project luôn được tự động thêm prefix **"Outsource"** (vd: nhập `TEST` → project tên `Outsource TEST`).

> **Lưu ý quyền API key cho Studio:** tab Studio **chỉ hiện ra khi API key có quyền Studio** (mục **Projects** khi chỉnh sửa API key trong ElevenLabs). Key thiếu quyền `projects_write` sẽ gặp lỗi `missing_permissions` khi tạo project.

### Dùng lại Studio project (Project ID)

Lần chạy đầu tiên tool tạo project mới và **lưu Project ID vào localStorage**, đồng thời hiển thị ID trong ô "Project ID" trên tab Studio. Các lần sau tool **dùng lại đúng project đó** (cập nhật nội dung rồi convert lại) thay vì tạo project mới — tránh rác tài khoản.

Mở trình duyệt khác? Dán Project ID cũ vào ô "Project ID" là tool dùng lại project đó luôn. Nếu ID không còn hợp lệ (project đã bị xóa), tool tự tạo project mới và cập nhật lại ID.

## Chạy local

```bash
npm run dev   # netlify dev
```

Không có build step, không có dependency — deploy thẳng lên Netlify là chạy.

## Cấu hình

Nhập **API Key** và **Voice ID** trong mục "API & Voice ID" rồi bấm Lưu. Cả hai được lưu trong localStorage của trình duyệt, gửi kèm mỗi request qua proxy — server không lưu key.

### Field API Key tự ẩn

Sau khi đã lưu API Key, field nhập key **tự động ẩn đi** để tránh lộ key khi chia sẻ màn hình. Nếu request bị lỗi xác thực (401 — key sai hoặc thiếu quyền), field sẽ **tự hiện lại** để bạn sửa key ngay.

Muốn hiện lại field này (để đổi key hoặc debug), mở DevTools Console và chạy:

```js
localStorage.setItem("WMG_SHOW_API_KEY", "true")
```

rồi reload trang. Ẩn lại bằng cách xóa cờ:

```js
localStorage.removeItem("WMG_SHOW_API_KEY")
```

## Debug flags (localStorage)

| Key | Giá trị | Tác dụng |
|-----|---------|----------|
| `WMG_SHOW_API_KEY` | `"true"` | Luôn hiện field nhập API Key dù đã lưu key |
