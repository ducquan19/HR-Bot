# Thiết Kế Giao Diện và Trải Nghiệm Người Dùng (UI/UX Design)

Tài liệu này đặc tả chi tiết thiết kế UI/UX của hệ thống **HR Bot**. Thiết kế tập trung vào sự tối giản, hiện đại (glassmorphism, clean UI) và tiện dụng cho cả Nhà tuyển dụng (Recruiter) lẫn Ứng viên (Candidate).

---

## 1. Nguyên Tắc Thiết Kế Chung (Design Principles)
- **Màu sắc chủ đạo (Color Palette):** Xanh dương (Blue - đại diện cho sự chuyên nghiệp, công nghệ) kết hợp với các tông màu xám/trắng tạo sự tinh tế. Chế độ Dark Mode sử dụng nền Slate/Gray đậm giúp dịu mắt.
- **Thành phần giao diện (UI Components):** Sử dụng các Card có bo góc bo tròn (border-radius lớn), hiệu ứng đổ bóng mờ (soft shadow) và nền kính (glassmorphism) cho các modal/panel.
- **Trạng thái (Feedback):** Tất cả các thao tác đều có Loading Spinners, Toast Notifications (Thông báo nổi) và các Alert báo lỗi rõ ràng.

---

## 2. Đặc Tả Chi Tiết Các Màn Hình (Screen Specifications)

### 2.1. Phân hệ Xác Thực (Authentication)
*Đường dẫn: `/auth/*`*
- **Màn hình Đăng nhập & Đăng ký (`/login`, `/register`):**
  - **Giao diện:** Form trung tâm trên nền gradient nhẹ nhàng. 
  - **Thành phần:** Input Email, Password, Nút Submit lớn, Link chuyển hướng "Quên mật khẩu" hoặc "Tạo tài khoản".
  - **UX Flow:** Validate form trực tiếp ngay khi nhập. Hiển thị thông báo lỗi rõ ràng nếu sai mật khẩu hoặc tài khoản chưa tồn tại.
- **Màn hình Xác nhận Email / Quên mật khẩu:**
  - **Giao diện:** Form tối giản yêu cầu nhập email để nhận mã OTP/Link xác nhận.

### 2.2. Phân hệ Bảng Điều Khiển (Dashboard)
*Đường dẫn: `/` hoặc `/dashboard`*
- **Màn hình Tổng quan (Overview):**
  - **Giao diện:** Chứa các thẻ thống kê lớn (Summary Cards) hiển thị số lượng: Ứng viên, Chiến dịch đang chạy, Lượt phỏng vấn AI, Số lượng CV mới.
  - **Thành phần:** Biểu đồ (Charts) thể hiện xu hướng nộp hồ sơ theo thời gian. Bảng danh sách các "Ứng viên cần chú ý" hoặc "Lịch phỏng vấn sắp tới".
  - **UX Flow:** Recruiter mở app sẽ có ngay cái nhìn toàn cảnh về hiệu suất tuyển dụng.

### 2.3. Phân hệ Quản Lý Chiến Dịch (Campaigns)
*Đường dẫn: `/campaigns/*`*
- **Màn hình Danh sách Chiến dịch:**
  - **Giao diện:** Hiển thị dạng thẻ (Grid Cards) hoặc dạng bảng (Table) các đợt tuyển dụng.
  - **Thành phần:** Thanh tìm kiếm, Bộ lọc trạng thái (Active, Draft, Closed). Mỗi thẻ chiến dịch hiển thị Tên, Phòng ban, Deadline, và số lượng ứng viên hiện tại.
- **Màn hình Chi tiết / Tạo mới Chiến dịch:**
  - **Giao diện:** Chia làm các tab (Tabs) như: Thông tin chung, Vị trí tuyển dụng (Positions), Thành viên (Members), Cấu hình Form.
  - **UX Flow:** Khi thêm một Vị trí, Recruiter sẽ cấu hình Tiêu chí chấm điểm cho AI (thêm các Skill, Trọng số) trực tiếp thông qua một Modal dạng form linh hoạt.

### 2.4. Phân hệ Quản Lý Ứng Viên & Trí Tuệ Nhân Tạo (Candidates)
*Đường dẫn: `/candidates/*`*
- **Màn hình Danh sách Ứng viên (Bảng trung tâm):**
  - **Giao diện:** Danh sách List-view chi tiết.
  - **Thành phần Đặc biệt - Thanh Tìm Kiếm AI (Semantic Search):** Một thanh tìm kiếm nổi bật với icon AI, cho phép nhập prompt ngôn ngữ tự nhiên (VD: "Tìm lập trình viên React có kinh nghiệm PostgreSQL").
  - **Thành phần:** Hệ thống phân trang (Pagination), Bộ lọc động (Lọc theo chiến dịch, Vòng ứng tuyển, Sắp xếp theo độ phù hợp - Matching Score).
- **Màn hình Chi tiết Ứng viên & Điểm số AI (Candidate Detail Modal):**
  - **Giao diện:** Modal rộng (Large Modal) hoặc Slide-over Panel chia làm 2 cột:
    - *Cột trái:* Thông tin tóm tắt cá nhân (Email, SDT), Nút chuyển vòng (Move Stage), File PDF CV gốc để xem trực tiếp (PDF Viewer).
    - *Cột phải:* Kết quả AI Screening: Điểm tổng quan (vòng tròn Progress bar), Danh sách Kỹ năng mạnh, Kỹ năng còn thiếu (bôi đỏ), Giải thích (Explanation) từ AI tại sao lại cho mức điểm này.

### 2.5. Phân hệ Phỏng Vấn AI (Interviews)
*Đường dẫn: `/interviews/*`*
- **Màn hình Quản lý Phỏng vấn:**
  - **Giao diện:** Bảng danh sách các phiên phỏng vấn.
  - **Thành phần:** Trạng thái (Chờ phỏng vấn, Đã xong). Nút copy link phòng phỏng vấn để gửi ứng viên.
- **Màn hình Xem lại Phỏng vấn (Interview Review):**
  - **Giao diện:** Giao diện dạng nhật ký (Chat log) kết hợp kết quả.
  - **Thành phần:** 
    - **Transcript:** Lịch sử trò chuyện giữa AI và ứng viên dạng tin nhắn (như giao diện Messenger).
    - **Đánh giá của AI:** Đoạn văn bản phân tích thái độ, kỹ năng giao tiếp và mức độ am hiểu công việc của ứng viên do AI tự động tổng hợp.

### 2.6. Phân hệ Dành Cho Ứng Viên (Public Job Board & Interview Room)
*Đường dẫn: `/public/*` hoặc các link share public*
- **Màn hình Job Board & Nộp CV (Public Form):**
  - **Giao diện:** Giao diện tối giản, tập trung vào Branding của công ty. Không yêu cầu đăng nhập.
  - **Thành phần:** Nút "Upload CV" to rõ ràng (hỗ trợ kéo thả - Drag & Drop). Sau khi tải lên, hiển thị hiệu ứng Loading mượt mà.
- **Màn hình Phòng Phỏng Vấn AI (LiveKit Room):**
  - **Giao diện:** Thiết kế giao diện như một phòng gọi video/audio (giống Google Meet/Zoom nhưng tối giản chỉ có Audio).
  - **UX Flow:** 
    1. Màn hình chờ: Yêu cầu cấp quyền Microphone, kiểm tra âm thanh.
    2. Trong phòng: Hiển thị Visualizer (Sóng âm thanh) chuyển động khi AI đang nói hoặc ứng viên đang nói. Nút Mute/Unmute và nút Kết thúc lớn.

---

## 3. Bản Đồ Di Chuyển Của Người Dùng (User Journey Flow)

### Kịch bản 1: Nhà tuyển dụng tạo chiến dịch và lọc CV
`Dashboard` -> `Campaigns` -> Bấm `Tạo chiến dịch` -> Thêm `Vị trí (JD, Skills)` -> Lấy `Link Public` gửi cho ứng viên -> Quay lại `Candidates` -> Dùng `Semantic Search` tìm ứng viên phù hợp -> Bấm xem `Chi tiết ứng viên` -> Xem điểm AI đánh giá.

### Kịch bản 2: Ứng viên nộp hồ sơ và Phỏng vấn ảo
Nhận `Link Public` -> `Upload CV` -> Đợi nhận Email mời phỏng vấn -> Bấm `Link Phỏng vấn` -> Cấp quyền Mic -> Bắt đầu trò chuyện với `Voice AI` -> Kết thúc.
