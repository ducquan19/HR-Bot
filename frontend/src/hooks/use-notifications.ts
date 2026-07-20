import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

export function useNotifications() {
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user) return

    // Connect to the RealtimeGateway in the backend
    const socket = io('ws://localhost:3000/realtime', {
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      console.log('Connected to realtime notifications')
    })

    socket.on('cv.processing', (data: { cvId: string, status: string, payload?: any }) => {
      if (data.status === 'COMPLETED') {
        toast.success('Xử lý CV hoàn tất!', {
          description: `Đã trích xuất và lưu trữ CV thành công.`,
          duration: 5000,
        })
      } else if (data.status === 'FAILED') {
        toast.error('Lỗi khi xử lý CV', {
          description: data.payload?.error || 'Không thể trích xuất dữ liệu từ CV.',
          duration: 5000,
        })
      }
    })

    socket.on('candidate.updated', (data: { candidateId: string, payload: any }) => {
      if (data.payload?.reason === 'CV_SCREENING_COMPLETED') {
        toast.info('Đánh giá hoàn tất', {
          description: `AI đã chấm điểm một ứng viên với điểm số ${data.payload.score}%.`,
          duration: 5000,
        })
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [user])
}
