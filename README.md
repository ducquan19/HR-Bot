# HR Bot - Trợ Lý Tuyển Dụng Trí Tuệ Nhân Tạo (AI)

HR Bot là nền tảng quản lý tuyển dụng thông minh được tích hợp trí tuệ nhân tạo (AI), giúp các doanh nghiệp tự động hóa và tối ưu hóa toàn bộ quy trình tuyển dụng. Từ việc tạo chiến dịch, thu thập CV, trích xuất thông tin, đánh giá độ phù hợp cho đến việc thực hiện **phỏng vấn tự động bằng giọng nói (Voice AI)**, HR Bot giúp tiết kiệm tối đa thời gian và chi phí cho bộ phận nhân sự.

---

## 🌟 Các Tính Năng Nổi Bật (Key Features)

### 1. Quản Lý Tuyển Dụng Toàn Diện
- **Quản lý Chiến dịch & Vị trí:** Tạo, chỉnh sửa và theo dõi các chiến dịch tuyển dụng. Quản lý yêu cầu công việc (Job Description) và bộ kỹ năng (Skills).
- **Trang ứng tuyển (Public Application Page):** Cung cấp đường dẫn công khai cho ứng viên nộp hồ sơ và tải lên CV trực tiếp.

### 2. Xử Lý và Đánh Giá CV Bằng AI
- **Trích xuất dữ liệu (CV Parsing):** Tự động đọc và trích xuất thông tin ứng viên từ file PDF bằng AI (hỗ trợ Google Gemini / OpenAI).
- **Chấm điểm & Xếp hạng (CV Screening):** Đánh giá mức độ phù hợp của ứng viên với yêu cầu công việc thông qua thuật toán Semantic Search.
- **Tìm kiếm Ngữ nghĩa (Semantic Search):** Tìm kiếm ứng viên dựa trên ý nghĩa của kỹ năng và kinh nghiệm thay vì chỉ dùng từ khóa (sử dụng cơ sở dữ liệu vector).

### 3. Phỏng Vấn AI Qua Giọng Nói (Voice AI Interviewer)
- **Giao tiếp Thời gian thực (Real-time WebRTC):** Thực hiện cuộc gọi phỏng vấn hai chiều với AI qua đường truyền độ trễ thấp sử dụng **LiveKit**.
- **Agent Thông minh:** AI đóng vai trò là nhà tuyển dụng, đặt câu hỏi dựa trên CV của ứng viên và phản hồi tự nhiên theo thời gian thực.
- **Đánh giá sau phỏng vấn:** Tự động lưu trữ đoạn hội thoại (transcript) và chạy luồng đánh giá chấm điểm kỹ năng của ứng viên sau khi kết thúc.

### 4. Tự Động Hóa & Thông Báo
- **Email Thông báo:** Tự động gửi email mời phỏng vấn hoặc cập nhật trạng thái ứng viên.
- **Quản lý Hàng đợi (Queue):** Xử lý nền các tác vụ nặng như phân tích CV và đánh giá phỏng vấn bằng BullMQ.

---

## 🛠 Các Công Nghệ Nâng Cao Sử Dụng (Tech Stack)

Dự án sử dụng kiến trúc Microservices kết hợp với các công nghệ tiên tiến nhất hiện nay:

### Frontend
- **Framework:** React 18, Vite, TypeScript.
- **State Management:** Zustand.
- **Styling:** Tailwind CSS, Lucide Icons.
- **Real-time Media:** LiveKit Client SDK (WebRTC).

### Backend (Core API)
- **Framework:** NestJS (Node.js).
- **Cơ sở dữ liệu:** PostgreSQL kết hợp **pgvector** (lưu trữ vector embeddings cho Semantic Search).
- **ORM:** Prisma.
- **Caching & Queue:** Redis & BullMQ.
- **Object Storage:** MinIO (Tương thích Amazon S3) để lưu trữ CV.
- **Email Server:** MailHog / Nodemailer.

### AI & Voice Services (Python Worker)
- **Framework:** FastAPI.
- **AI/LLM Integration:** Langchain, Google Gemini / OpenAI API.
- **Voice Agent:** LiveKit Python SDK để xử lý luồng WebRTC audio streaming và STT/TTS (Speech-to-Text / Text-to-Speech).

### Infrastructure
- **Containerization:** Docker & Docker Compose.

---

## 📂 Cấu Trúc Thư Mục (Project Structure)

```text
HR-Bot/
├── backend/                 # NestJS Core API, Prisma schema, Queue Workers
├── frontend/                # React Vite Web App (Giao diện Quản trị & Ứng viên)
├── ai-services/             # Python FastAPI & LiveKit Voice AI Agents
├── docs/                    # Tài liệu dự án
├── docker-compose.yml       # Cấu hình tự động triển khai DB, Redis, MinIO, LiveKit...
└── LIVEKIT_README.md        # Hướng dẫn chi tiết cho dịch vụ Voice AI
```

---

## 🚀 Hướng Dẫn Cài Đặt (Getting Started)

### Yêu Cầu Hệ Thống (Prerequisites)
- **Node.js** 20+
- **Docker** và **Docker Compose**
- **Git**

### 1. Khởi động các dịch vụ hạ tầng bằng Docker
Lệnh này sẽ khởi động PostgreSQL, Redis, MinIO, MailHog, LiveKit Server và AI Services.
```bash
docker-compose up -d
```

### 2. Cài đặt và Chạy Backend
Mở Terminal mới và thực hiện:
```bash
cd backend
npm install
cp .env.example .env      # (Thiết lập biến môi trường)
npx prisma generate       # (Tạo Prisma Client)
npx prisma migrate dev    # (Khởi tạo Database)
npm run start:dev         # (Chạy Backend tại cổng 3000)
```

### 3. Cài đặt và Chạy Frontend
Mở Terminal mới và thực hiện:
```bash
cd frontend
npm install
cp .env.example .env      # (Thiết lập biến môi trường)
npm run dev               # (Chạy Frontend tại cổng 5173)
```

---

## ⚙ Biến Môi Trường Cơ Bản (Environment Variables)

### Backend (`backend/.env`)
```env
DATABASE_URL=postgresql://hrbot:hrbot@localhost:5433/hrbot?schema=public
REDIS_HOST=localhost
REDIS_PORT=6380
S3_ENDPOINT=http://localhost:9000
MAIL_HOST=localhost
MAIL_PORT=1025
LIVEKIT_URL=http://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3000/api
```

---

## 🔑 Tài Khoản Mặc Định (Default Credentials)

- **HR Admin Login:** `admin@hrbot.com` / `password`
- **MinIO Console:** `http://localhost:9001` (User: `minioadmin` / Pass: `minioadmin`)
- **MailHog UI:** `http://localhost:8025` (Xem email tự động được gửi từ hệ thống)

---

## 📄 Tài Liệu Tham Khảo (Documentation)
- Xem chi tiết về thiết lập LiveKit trong [LIVEKIT.md](./LIVEKIT.md).
- Kiến trúc API và Swagger có thể truy cập tại `http://localhost:3000/api/docs` khi backend đang chạy.
