# HR Bot - Trợ lý tuyển dụng thông minh

HR Bot là nền tảng quản lý tuyển dụng thông minh được tích hợp trí tuệ nhân tạo (AI), giúp các doanh nghiệp tự động hóa và tối ưu hóa toàn bộ quy trình tuyển dụng. Từ việc tạo chiến dịch, thu thập CV, trích xuất thông tin, đánh giá độ phù hợp cho đến việc thực hiện **phỏng vấn tự động bằng giọng nói**, HR Bot giúp tiết kiệm tối đa thời gian và chi phí cho bộ phận nhân sự.

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
- **Giao tiếp Thời gian thực (Real-time WebRTC):** Thực hiện cuộc gọi phỏng vấn hai chiều độ trễ cực thấp sử dụng **LiveKit**.
- **Agent Thông minh (LLM):** Đóng vai trò là nhà tuyển dụng, đặt câu hỏi thông minh, linh hoạt theo CV ứng viên (sử dụng siêu mô hình **Google Gemini 2.0 Flash**).
- **Nghe & Nói (STT/TTS):** Tích hợp nhận diện giọng nói siêu tốc qua **Groq LPU (Whisper)** và phản hồi giọng nói Tiếng Việt tự nhiên bằng **Microsoft Edge TTS** hoàn toàn miễn phí.
- **Đánh giá sau phỏng vấn:** Tự động lưu trữ đoạn hội thoại (transcript) và chấm điểm tự động.

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
- **GraphQL & REST:** Hỗ trợ song song các kiến trúc API linh hoạt.
- **ORM:** Prisma.
- **Caching & Queue:** Redis & BullMQ (xử lý bất đồng bộ - Asynchronous).
- **Real-time:** Socket.IO / WebSockets (cho các tính năng Notification).
- **Object Storage:** MinIO (Tương thích Amazon S3) để lưu trữ CV.
- **Email Server:** MailHog / Nodemailer.

### AI & Voice Services (Python Worker)
- **Voice Agent Server:** Sử dụng **LiveKit Python SDK** để bám sát phòng họp WebRTC.
- **AI/LLM Integration:** Google Gemini 2.0 Flash (Bộ Não).
- **Speech-to-Text (STT):** Groq Whisper (Miễn phí, Siêu tốc độ).
- **Text-to-Speech (TTS):** Microsoft Edge TTS (Tích hợp thông qua Custom Plugin).

### Infrastructure
- **Containerization:** Docker & Docker Compose.

---

## 🧠 Kiến Trúc Hệ Thống & Luồng AI (Architecture & AI Workflows)

### 1. Sơ Đồ Kiến Trúc Tổng Thể (System Architecture)
Kiến trúc Microservices của HR Bot được chia thành các luồng xử lý độc lập để đảm bảo hiệu năng và khả năng mở rộng:

```mermaid
graph TD
    subgraph Frontend [Client Side]
        UI[React/Vite Web App]
        LKClient[LiveKit WebRTC Client]
    end

    subgraph Backend [Core API - NestJS]
        API[REST API Controllers]
        Auth[Auth & JWT]
        Prisma[Prisma ORM]
        Queue[BullMQ Producer]
    end

    subgraph Infrastructure [Data & Storage]
        PG[(PostgreSQL + pgvector)]
        Redis[(Redis Cache & Queue)]
        MinIO[(MinIO / S3 Storage)]
    end

    subgraph AIServices [AI & Media Server]
        FastAPI[Python Worker / FastAPI]
        LKServer[LiveKit Server]
        Agent[Voice AI Agent]
    end

    subgraph External [External Services]
        LLM[Google Gemini / OpenAI]
        SMTP[MailHog / Mail Server]
    end

    UI <-->|HTTP/REST| API
    UI <-->|WebRTC/WSS| LKServer
    API -->|Read/Write| Prisma
    Prisma <--> PG
    API -->|Publish Jobs| Redis
    API -->|Save CV| MinIO

    Redis <-->|Consume Jobs| FastAPI
    FastAPI <-->|Fetch CV| MinIO
    FastAPI <-->|Query Vectors| PG
    FastAPI <-->|API Calls| LLM

    LKServer <-->|Audio Stream| Agent
    Agent <-->|Prompt/Response| LLM
    API -->|Send Emails| SMTP
```

### 2. Luồng Hoạt Động Của AI Voice Agent (Voice Interview Flow)
Trong quá trình phỏng vấn ảo, AI Agent hoạt động theo cơ chế luân phiên (turn-taking) theo thời gian thực:

```mermaid
sequenceDiagram
    participant User as Ứng Viên (Mic/Loa)
    participant LK as LiveKit Server
    participant STT as Speech-to-Text
    participant LLM as Trí Tuệ Nhân Tạo
    participant TTS as Text-to-Speech

    User->>LK: Nói (Audio Stream)
    LK->>STT: Chuyển tiếp Audio
    STT-->>LLM: Văn bản (Transcript)

    Note over LLM: Tổng hợp ngữ cảnh:<br/>1. Lịch sử chat<br/>2. CV ứng viên<br/>3. Mô tả công việc (JD)

    LLM-->>TTS: Phản hồi dạng Text (Streaming)
    TTS-->>LK: Tổng hợp Giọng nói (Audio Stream)
    LK->>User: Phát âm thanh (Loa)
```

### 3. Thuật Toán Chấm Điểm & Đánh Giá (Scoring Logic)
Quy trình AI đánh giá và tính điểm CV của ứng viên so với Mô tả công việc (JD):

```mermaid
flowchart TD
    A["Upload CV PDF"] --> B("Trích xuất bằng LLM")
    B --> C{"Dữ liệu ứng viên JSON"}

    C -->|Kinh nghiệm| D["Tính điểm Kinh nghiệm (Years)"]
    C -->|Học vấn| E["Tính điểm Học vấn (Degree/GPA)"]
    C -->|Kỹ năng| F["So khớp Kỹ năng (Semantic Matching)"]

    subgraph SemanticMatching [Xử lý Vector]
        F1["Kỹ năng Ứng viên"] -->|Embedding| V1[("(Vector 1)")]
        F2["Kỹ năng Yêu cầu từ JD"] -->|Embedding| V2[("(Vector 2)")]
        V1 & V2 --> F3["Tính Cosine Similarity"]
        F3 --> F4["Trọng số Kỹ năng"]
    end

    F --> SemanticMatching
    SemanticMatching --> G["Tính toán độ tương thích"]

    D & E & G --> H["Tổng hợp Điểm số (Overall Score)"]

    H --> I{"Phân loại"}
    I -->|> 85%| J["Strong Recommend"]
    I -->|70% - 85%| K["Recommend"]
    I -->|50% - 70%| L["Consider"]
    I -->|< 50%| M["Reject"]
```

---

## 🖥 Kiến Trúc Giao Diện (UI Flow & Screen Map)

Sơ đồ dưới đây mô tả cấu trúc luồng màn hình (Screen Flow) dành cho 3 đối tượng người dùng chính: **Recruiter (Nhà tuyển dụng)**, **Admin (Quản trị viên)**, và **Candidate (Ứng viên)**.

```mermaid
mindmap
  root((HR Bot Web App))
    Admin["Quản trị viên (Admin)"]
      DashboardAdmin["Dashboard (Tổng quan toàn bộ hệ thống)"]
      ManageUsers["Quản lý Người dùng (CRUD Recruiters)"]
      ManageCampaignsGlobal["Quản lý Chiến dịch toàn cục"]
      SystemSettings["Cài đặt hệ thống (Cấu hình AI, SMTP)"]
    Recruiter["Nhà tuyển dụng (Recruiter)"]
      AuthRecruiter["Đăng nhập / Đăng ký / Xác thực Email / Quên mật khẩu"]
      DashboardRecruiter["Dashboard (Thống kê cá nhân, Chiến dịch sắp hạn)"]
      Campaigns["Quản lý Chiến dịch"]
        CreateCampaign["Tạo mới / Chỉnh sửa chiến dịch"]
        Positions["Quản lý vị trí, cấu hình AI Scoring"]
        Members["Thêm thành viên (Phân quyền Owner, Editor, Viewer)"]
      Candidates["Quản lý Ứng viên (CV Parsing)"]
        SemanticSearch["Tìm kiếm ngữ nghĩa AI (Semantic Search)"]
        FilterCandidates["Lọc ứng viên (Score, Trạng thái)"]
        CandidateDetail["Xem chi tiết (Điểm, Thiếu sót, AI Extract)"]
      Interviews["Phỏng vấn ảo"]
        Schedule["Lên lịch phỏng vấn AI"]
        History["Lịch sử phỏng vấn (Xem Transcript, Audio, AI Đánh giá)"]
    Candidate["Ứng viên (Candidate)"]
      PublicLanding["Trang chủ Giới thiệu Công ty"]
      PublicJobBoard["Danh sách các chiến dịch & vị trí đang mở"]
      ApplicationPage["Trang Nộp Hồ Sơ"]
        UploadCV["Tải CV (PDF, DOCX)"]
        FillForm["Điền form ứng tuyển tùy chỉnh"]
      InterviewRoom["Phòng Phỏng vấn Ảo (Voice AI)"]
        AudioCheck["Kiểm tra Microphone & Trình duyệt"]
        LiveInterview["Tham gia phỏng vấn thời gian thực với AI Agent"]
```

---

## 📂 Cấu Trúc Thư Mục (Project Structure)

```text
HR-Bot/
├── backend/                 # NestJS Core API, Prisma schema, Queue Workers
├── frontend/                # React Vite Web App (Giao diện Quản trị & Ứng viên)
├── ai-services/             # Python FastAPI & LiveKit Voice AI Agents
├── docs/                    # Tài liệu dự án
└── docker-compose.yml       # Cấu hình tự động triển khai DB, Redis, MinIO, LiveKit...
```

---

## 🚀 Hướng Dẫn Cài Đặt (Getting Started)

### Yêu Cầu Hệ Thống (Prerequisites)
- **Node.js** 20+
- **Docker** và **Docker Compose**
- **Git**

### 1. Cấu hình biến môi trường
Mở thư mục `backend`, `frontend`, và `ai-services` và tạo các file `.env` từ `.env.example`:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ai-services/.env.example ai-services/.env
```
*(Hãy điền `GEMINI_API_KEY` và `GROQ_API_KEY` vào `ai-services/.env` để Voice AI có thể hoạt động).*

### 2. Khởi động toàn bộ Hệ thống (Backend & AI) bằng Docker
Hệ thống AI Voice rất phức tạp, do đó cách tốt nhất là chạy toàn bộ Backend, AI Services và các DB thông qua Docker Compose.
Từ thư mục gốc dự án:
```bash
docker-compose up -d --build
```
*Lệnh này sẽ bật: PostgreSQL, Redis, MinIO, LiveKit, Node.js Backend (cổng 3000), và Python AI Worker.*

### 3. Khởi tạo Database (Migration)
Dù Backend đã chạy trong Docker, bạn vẫn cần tạo cấu trúc bảng cho Database ở lần chạy đầu tiên. Mở một Terminal ở máy của bạn:
```bash
cd backend
npm install
npx prisma db push        # Đẩy cấu trúc bảng vào Postgres đang chạy trong Docker
```

### 4. Chạy Giao diện người dùng (Frontend)
Frontend được chạy trên máy thật để bạn dễ dàng chỉnh sửa giao diện:
```bash
cd frontend
npm install
npm run dev               # Chạy tại http://localhost:5173
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

### AI Services (`ai-services/.env`)
```env
LIVEKIT_URL=ws://livekit:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret
BACKEND_URL=http://backend:3000
GEMINI_API_KEY=AIzaSy... (API Key của Google)
GROQ_API_KEY=gsk_... (API Key của Groq)
```

---

## 🔑 Tài Khoản Mặc Định (Default Credentials)

- **HR Admin Login:** `admin@hrbot.com` / `password`
- **MinIO Console:** `http://localhost:9001` (User: `minioadmin` / Pass: `minioadmin`)
- **MailHog UI:** `http://localhost:8025` (Xem email tự động được gửi từ hệ thống)

---

## 📄 Tài Liệu Tham Khảo (Documentation)
- Xem chi tiết về thiết lập LiveKit trong [LIVEKIT.md](./docs/LIVEKIT.md).
- Kiến trúc API và Swagger có thể truy cập tại `http://localhost:3000/api/docs` khi backend đang chạy.
