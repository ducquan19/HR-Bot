import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Đang xác thực email của bạn...')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Đường dẫn xác thực không hợp lệ hoặc đã hết hạn.')
      return
    }

    const verify = async () => {
      try {
        await api.auth.verifyEmail(token)
        setStatus('success')
        setMessage('Xác thực email thành công! Đang chuyển hướng...')
        setTimeout(() => navigate('/login'), 3000)
      } catch (err: any) {
        setStatus('error')
        setMessage(err.response?.data?.message || err.message || 'Xác thực thất bại.')
      }
    }

    verify()
  }, [token, navigate])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-8 text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Đang xác thực...</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Thành công!</h2>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
              {message}
            </p>
            <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              <ArrowLeft className="w-4 h-4" /> Đăng nhập ngay
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Lỗi xác thực</h2>
            <p className="text-sm text-red-600 dark:text-red-400 mt-2 font-medium bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl border border-red-100 dark:border-red-800/50">
              {message}
            </p>
            <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:underline">
              <ArrowLeft className="w-4 h-4" /> Quay lại đăng nhập
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
