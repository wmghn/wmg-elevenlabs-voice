# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc với project này.

## Tổng quan project

**ElevenLabs Voice Generator** — công cụ tạo giọng nói từ văn bản (TTS) chạy trên Netlify:

- `public/index.html` — toàn bộ ứng dụng (HTML + CSS + JS thuần) nằm trong **một file duy nhất**. Dùng Quill editor qua CDN. Người dùng nhập API Key / Voice ID, tạo nhiều block nội dung, bấm Start để tạo và tải file MP3.
- `netlify/functions/tts.js` — Netlify Function làm **proxy stateless** đến `api.elevenlabs.io`, giải quyết vấn đề CORS. Không giữ secret, không lưu state.
- `netlify/functions/studio.js` — proxy stateless cho ElevenLabs Studio API (`/v1/studio/*`): tạo project, poll trạng thái convert, lấy snapshot, tải audio.
- `netlify.toml` — redirect `/v1/text-to-speech/*` và `/v1/studio/*` → function tương ứng (giữ path giống hệt API ElevenLabs), kèm SPA fallback.

**Chạy local:** `npm run dev` (netlify dev). Không có build step, không có test suite, không có node_modules.

## Kiến trúc & quyết định đã chốt (không tự ý thay đổi)

- **API key nằm ở phía client**, lưu trong localStorage, gửi lên qua header `xi-api-key` mỗi request. Proxy chỉ chuyển tiếp — server không bao giờ lưu hay log key. Đây là thiết kế có chủ đích: mỗi người dùng tự dùng key của mình.
- **Path proxy giữ nguyên format của ElevenLabs** (`/v1/text-to-speech/:voiceId`) để code client trông như gọi thẳng API gốc.
- **Audio trả về từ function phải là base64 + `isBase64Encoded: true`** — đây là ràng buộc của Netlify Functions với binary response, bỏ đi là hỏng.
- **Các key localStorage đang dùng:** `elevenlabs_api_key`, `elevenlabs_voice_id`, `elevenlabs_voice_contents`, `elevenlabs_studio_content`, `voice_<field>`. Đổi tên key = mất dữ liệu của người dùng hiện tại. Nếu buộc phải đổi, phải viết migration đọc key cũ.
- **Proxy Studio chặn `GET /v1/studio/projects` (liệt kê project)** — quyết định bảo mật có chủ đích: nhiều bên có thể dùng chung API key, không được lộ danh sách Studio của nhau. Tab Studio chỉ tạo project mới rồi thao tác trên đúng project đó qua id. Không bỏ chặn, không thêm tính năng duyệt project có sẵn.
- **Xử lý các block audio tuần tự** (vòng `for` + `await`), không chạy song song — tránh đụng rate limit của ElevenLabs.
- **Ngôn ngữ UI và thông báo là tiếng Việt**; tên biến, hàm, comment kỹ thuật là tiếng Anh (comment giải thích có thể tiếng Việt như code hiện tại).

---

# Nguyên tắc làm việc

## 1. Suy nghĩ trước khi viết code

Trước khi sửa hay thêm bất cứ thứ gì, dừng lại và làm rõ vấn đề. Project này nhỏ, một quyết định sai kéo theo cả kiến trúc lệch hướng.

- Nêu rõ giả định của bạn trước khi code; nếu yêu cầu có nhiều cách hiểu, trình bày các cách hiểu đó và hỏi thay vì tự chọn im lặng.
- Đề xuất cách đơn giản hơn nếu tồn tại — kể cả khi khác với cách người dùng gợi ý. Được phép phản biện, kèm lý do cụ thể.
- Khi sửa lỗi liên quan đến proxy, xác định rõ lỗi nằm ở tầng nào (client fetch → Netlify redirect → function → ElevenLabs API) trước khi sửa, đừng đoán.
- Nếu yêu cầu đụng đến các quyết định đã chốt ở trên (vd: chuyển API key sang env var, thêm framework), dừng lại xác nhận với người dùng trước.

## 2. Tối giản là kiến trúc, không phải sự lười

Sức mạnh của project này là **zero-dependency, zero-build**: một file HTML mở ra là chạy, một function deploy là xong. Mọi thay đổi phải giữ được điều đó. Viết lượng code tối thiểu giải quyết đúng vấn đề.

- **Không** thêm npm package, bundler, framework (React/Vue/...), TypeScript, hay build step. Thư viện mới (nếu thật sự cần) dùng qua CDN như Quill hiện tại.
- **Không** tách `index.html` thành nhiều file JS/CSS riêng trừ khi người dùng yêu cầu — single-file là chủ đích.
- Không thêm tính năng ngoài yêu cầu, không tạo abstraction cho code chỉ dùng một chỗ, không thêm config/option "phòng khi cần".
- Không thêm error handling cho tình huống không thể xảy ra; error handling hiện tại (alert + log ra `#log`) là đủ cho tool nội bộ — theo pattern đó.
- Function proxy giữ đúng một nhiệm vụ: chuyển tiếp request. Không thêm caching, queue, retry, analytics vào đó khi chưa được yêu cầu.

## 3. Thay đổi chính xác, không "tiện tay"

Khi sửa code hiện có, chỉ chạm vào đúng phần liên quan đến yêu cầu. Mỗi commit của project này gói gọn một việc — diff càng nhỏ càng dễ soát.

- Không "cải thiện" code lân cận, không format lại, không đổi tên biến đang hoạt động tốt.
- Không refactor phần đang chạy đúng chỉ vì "trông sạch hơn".
- Theo đúng phong cách hiện tại: vanilla JS + `addEventListener`, CSS class theo kiểu `kebab-case`, inline `<style>`/`<script>` trong `index.html`, UI text tiếng Việt có emoji trạng thái (🔄 ✅ ❌ 🚨).
- Sửa CSS thì theo bảng màu hiện có (`#0077cc` chủ đạo, `#28a745` thành công, `#dc3545` nguy hiểm).
- Chỉ xóa code khi thay đổi của bạn làm nó thừa; nếu thấy code chết không liên quan, báo lại chứ đừng tự xóa.
- Nhớ tính đồng bộ giữa các tầng: thêm header mới ở client thì phải thêm vào `access-control-allow-headers` trong `corsHeaders()`; đổi path thì phải sửa cả `netlify.toml` lẫn regex trong `tts.js`.

## 4. Xác minh bằng luồng thật, không chỉ đọc code

Project không có test suite — "chạy được" nghĩa là luồng thật hoạt động: nhập text → bấm Start → nhận file MP3. Trước khi báo xong, phải nêu rõ đã xác minh bằng cách nào.

- Đổi bất cứ gì trong `tts.js` hoặc `netlify.toml`: chạy `npm run dev` và gọi thử endpoint (hoặc hướng dẫn người dùng test nếu không có API key).
- Đổi UI/JS trong `index.html`: kiểm tra cả luồng phụ — reload trang (localStorage khôi phục đúng không), xóa block (đánh số lại đúng không), trạng thái "Chưa cấu hình" hiển thị đúng không.
- Khai báo rõ giới hạn xác minh: proxy cần API key thật của ElevenLabs mới test end-to-end được — nếu không test được, nói thẳng phần nào đã kiểm tra, phần nào người dùng cần tự kiểm tra sau khi deploy.
- Nhiệm vụ mơ hồ ("làm cho nó tốt hơn") phải được chuyển thành mục tiêu đo được ("giảm số lần bấm để tạo audio từ 3 xuống 1") trước khi bắt tay code.
