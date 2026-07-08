# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc với project này.

## Tổng quan project

**ElevenLabs Voice Generator** — công cụ tạo giọng nói từ văn bản (TTS) chạy trên Netlify:

- `public/index.html` — toàn bộ ứng dụng (HTML + CSS + JS thuần) nằm trong **một file duy nhất**. Dùng Quill editor qua CDN. Người dùng nhập API Key / Voice ID, tạo nhiều block nội dung, bấm Start để tạo và tải file MP3. Mọi request đi **thẳng từ trình duyệt đến `api.elevenlabs.io`** (hằng `ELEVENLABS_API`).
- `netlify.toml` — chỉ còn cấu hình publish + SPA fallback. Không có Netlify Function nào.

**Chạy local:** `npm run dev` (netlify dev). Không có build step, không có test suite, không có node_modules.

## Kiến trúc & quyết định đã chốt (không tự ý thay đổi)

- **API key nằm ở phía client**, lưu trong localStorage, gửi qua header `xi-api-key` thẳng đến ElevenLabs — không có server trung gian nào thấy key. Đây là thiết kế có chủ đích: mỗi người dùng tự dùng key của mình.
- **Gọi thẳng `api.elevenlabs.io` từ trình duyệt, KHÔNG proxy qua Netlify Function** — ElevenLabs hỗ trợ CORS đầy đủ (`access-control-allow-origin: *`, đã kiểm chứng 07/2026). Netlify Function bị trần 10 giây thực thi + giới hạn dung lượng response, từng gây 504 / Inactivity Timeout với audio dài — đừng quay lại kiến trúc proxy. Mọi URL ElevenLabs phải đi qua hằng `ELEVENLABS_API` trong `index.html`.
- **Luồng Studio tách bước, không dùng `auto_convert`**: tạo/cập nhật content → chờ project hết "creating" → `POST .../convert` → poll snapshot mới — mỗi bước có log tiến độ riêng, dễ khoanh vùng lỗi.
- **Các key localStorage đang dùng:** `elevenlabs_api_key`, `elevenlabs_voice_id`, `elevenlabs_voice_contents`, `elevenlabs_studio_content`, `elevenlabs_studio_project_id`, `voice_<field>`. Đổi tên key = mất dữ liệu của người dùng hiện tại. Nếu buộc phải đổi, phải viết migration đọc key cũ.
- **Debug flag:** `WMG_SHOW_API_KEY = "true"` (localStorage) hiện lại field API Key vốn tự ẩn sau khi đã lưu key. Debug flag mới phải theo prefix `WMG_` và ghi vào bảng Debug flags trong README.md.
- **Không bao giờ gọi `GET /v1/studio/projects` (liệt kê project)** — quyết định bảo mật có chủ đích: nhiều bên có thể dùng chung API key, không được lộ danh sách Studio của nhau. Tool chỉ tạo project mới rồi thao tác trên đúng project đó qua id. Không thêm tính năng duyệt project có sẵn.
- **Tên Studio project luôn có prefix "Outsource"** (tự thêm nếu người dùng chưa gõ) — để phân biệt project do tool tạo với project khác trong cùng tài khoản.
- **Tab Studio chỉ hiện khi API key có quyền Studio** — kiểm tra bằng probe `GET /v1/studio/projects/wmg-permission-probe` (id giả): 401/403 = thiếu quyền → ẩn tab; mã khác = có quyền. Không dùng endpoint liệt kê để probe (bị cấm theo nguyên tắc trên). Tab Studio hiện đang **tạm ẩn** bằng cờ `STUDIO_ENABLED = false` trong `index.html`.
- **Studio dùng lại project qua Project ID** (lưu `elevenlabs_studio_project_id`, hiện trong ô Project ID để copy sang trình duyệt khác): có ID → cập nhật nội dung qua `POST .../content` + `auto_convert` thay vì tạo mới; ID hỏng → tạo mới và ghi đè ID. Khi chờ convert phải so **mốc `created_at_unix` của snapshot** (chỉ nhận snapshot mới hơn mốc trước khi convert), không dùng `can_be_downloaded` — cờ này vẫn true từ lần convert trước, sẽ tải nhầm audio cũ.
- **Field API Key tự ẩn khi đã lưu key, tự hiện lại khi request trả 401** (key sai / thiếu quyền) hoặc khi bật debug flag `WMG_SHOW_API_KEY`.
- **Xử lý các block audio tuần tự** (vòng `for` + `await`), không chạy song song — tránh đụng rate limit của ElevenLabs.
- **Ngôn ngữ UI và thông báo là tiếng Việt**; tên biến, hàm, comment kỹ thuật là tiếng Anh (comment giải thích có thể tiếng Việt như code hiện tại).

---

# Nguyên tắc làm việc

## 1. Suy nghĩ trước khi viết code

Trước khi sửa hay thêm bất cứ thứ gì, dừng lại và làm rõ vấn đề. Project này nhỏ, một quyết định sai kéo theo cả kiến trúc lệch hướng.

- Nêu rõ giả định của bạn trước khi code; nếu yêu cầu có nhiều cách hiểu, trình bày các cách hiểu đó và hỏi thay vì tự chọn im lặng.
- Đề xuất cách đơn giản hơn nếu tồn tại — kể cả khi khác với cách người dùng gợi ý. Được phép phản biện, kèm lý do cụ thể.
- Khi sửa lỗi liên quan đến API, đọc kỹ body lỗi ElevenLabs trả về để xác định nguyên nhân (key sai, thiếu quyền, param sai...) trước khi sửa code, đừng đoán.
- Nếu yêu cầu đụng đến các quyết định đã chốt ở trên (vd: chuyển API key sang env var, thêm framework), dừng lại xác nhận với người dùng trước.

## 2. Tối giản là kiến trúc, không phải sự lười

Sức mạnh của project này là **zero-dependency, zero-build**: một file HTML mở ra là chạy, một function deploy là xong. Mọi thay đổi phải giữ được điều đó. Viết lượng code tối thiểu giải quyết đúng vấn đề.

- **Không** thêm npm package, bundler, framework (React/Vue/...), TypeScript, hay build step. Thư viện mới (nếu thật sự cần) dùng qua CDN như Quill hiện tại.
- **Không** tách `index.html` thành nhiều file JS/CSS riêng trừ khi người dùng yêu cầu — single-file là chủ đích.
- Không thêm tính năng ngoài yêu cầu, không tạo abstraction cho code chỉ dùng một chỗ, không thêm config/option "phòng khi cần".
- Không thêm error handling cho tình huống không thể xảy ra; error handling hiện tại (alert + log ra `#log`) là đủ cho tool nội bộ — theo pattern đó.
- Không thêm caching, queue, retry, analytics khi chưa được yêu cầu.

## 3. Thay đổi chính xác, không "tiện tay"

Khi sửa code hiện có, chỉ chạm vào đúng phần liên quan đến yêu cầu. Mỗi commit của project này gói gọn một việc — diff càng nhỏ càng dễ soát.

- Không "cải thiện" code lân cận, không format lại, không đổi tên biến đang hoạt động tốt.
- Không refactor phần đang chạy đúng chỉ vì "trông sạch hơn".
- Theo đúng phong cách hiện tại: vanilla JS + `addEventListener`, CSS class theo kiểu `kebab-case`, inline `<style>`/`<script>` trong `index.html`, UI text tiếng Việt có emoji trạng thái (🔄 ✅ ❌ 🚨).
- Sửa CSS thì theo bảng màu hiện có (`#0077cc` chủ đạo, `#28a745` thành công, `#dc3545` nguy hiểm).
- Chỉ xóa code khi thay đổi của bạn làm nó thừa; nếu thấy code chết không liên quan, báo lại chứ đừng tự xóa.
- Mọi URL ElevenLabs phải dùng hằng `ELEVENLABS_API`, không hard-code URL rời rạc.

## 4. Xác minh bằng luồng thật, không chỉ đọc code

Project không có test suite — "chạy được" nghĩa là luồng thật hoạt động: nhập text → bấm Start → nhận file MP3. Trước khi báo xong, phải nêu rõ đã xác minh bằng cách nào.

- Đổi các call API: kiểm chứng endpoint bằng `curl` thẳng tới `api.elevenlabs.io` (kể cả với key giả — mã lỗi và header CORS trả về đã nói lên nhiều điều).
- Đổi UI/JS trong `index.html`: kiểm tra cả luồng phụ — reload trang (localStorage khôi phục đúng không), xóa block (đánh số lại đúng không), trạng thái "Chưa cấu hình" hiển thị đúng không.
- Khai báo rõ giới hạn xác minh: luồng ElevenLabs cần API key thật mới test end-to-end được — nếu không test được, nói thẳng phần nào đã kiểm tra, phần nào người dùng cần tự kiểm tra sau khi deploy.
- Nhiệm vụ mơ hồ ("làm cho nó tốt hơn") phải được chuyển thành mục tiêu đo được ("giảm số lần bấm để tạo audio từ 3 xuống 1") trước khi bắt tay code.
