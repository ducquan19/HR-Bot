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
        SMTP[Mail Server]
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

    subgraph Semantic Matching [Xử lý Vector]
        F1["Kỹ năng Ứng viên"] -->|Embedding| V1[("(Vector 1)")]
        F2["Kỹ năng Yêu cầu từ JD"] -->|Embedding| V2[("(Vector 2)")]
        V1 & V2 --> F3["Tính Cosine Similarity"]
        F3 --> F4["Trọng số Kỹ năng"]
    end

    F --> Semantic Matching
    Semantic Matching --> G["Tính toán độ tương thích"]

    D & E & G --> H["Tổng hợp Điểm số (Overall Score)"]

    H --> I{"Phân loại"}
    I -->|> 85%| J["Strong Recommend"]
    I -->|70% - 85%| K["Recommend"]
    I -->|50% - 70%| L["Consider"]
    I -->|< 50%| M["Reject"]
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
