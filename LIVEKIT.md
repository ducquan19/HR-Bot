# Hướng dẫn chạy LiveKit Voice AI cho HR-Bot

Hệ thống đã được tích hợp LiveKit WebRTC để hỗ trợ Voice AI (Phỏng vấn bằng giọng nói).

## Kiến trúc mới
- **Backend**: Cung cấp Token (livekit-server-sdk) cho Frontend truy cập vào phòng.
- **AI Services (Python)**: Chạy dưới dạng Worker, luôn kết nối vào LiveKit. Khi ứng viên join phòng, AI sẽ bắt đầu hội thoại.
- **LiveKit Server**: Máy chủ điều phối WebRTC (audio/video/data).

## Cách chạy
Bạn chỉ cần chạy lệnh sau tại thư mục gốc:
```bash
docker-compose up -d
```
Lệnh này sẽ tự động khởi động DB, Redis, MinIO, MailHog, LiveKit Server, và AI Services.

Sau đó, khởi động Backend và Frontend như bình thường.

## Biến môi trường
**Backend (`.env`)**:
```env
LIVEKIT_URL=http://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret
```

**AI Services (`ai-services/.env`)**:
```env
LIVEKIT_URL=ws://livekit:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret
BACKEND_URL=http://backend:3000
```
*(Trong production, bạn cần thay API Key/Secret thật và URL thật).*
