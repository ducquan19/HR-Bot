import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Đường dẫn không hợp lệ hoặc đã hết hạn.')
    }
  }, [token])

  const getPasswordStrength = (pass: string) => {
    let score = 0
    if (pass.length >= 8) score += 25
    if (/[A-Z]/.test(pass)) score += 25
    if (/[a-z]/.test(pass)) score += 25
    if (/[0-9!@#$%^&*]/.test(pass)) score += 25
    return score
  }
  const strength = getPasswordStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    if (strength < 100) {
      setError('Mật khẩu chưa đủ mạnh. Vui lòng kiểm tra lại.')
      return
    }

    setIsLoading(true)
    setError('')
    try {
      await api.auth.resetPassword(token, password)
      setIsSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Có lỗi xảy ra')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Đặt lại mật khẩu</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Vui lòng nhập mật khẩu mới cho tài khoản của bạn.
          </p>
        </div>

        {isSuccess ? (
          <div className="text-center">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl flex items-center gap-3 mb-6 text-sm font-medium border border-emerald-100 dark:border-emerald-800/50">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p className="text-left">Mật khẩu đã được đặt lại thành công! Đang chuyển hướng đến trang đăng nhập...</p>
            </div>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              <ArrowLeft className="w-4 h-4" /> Đăng nhập ngay
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm font-medium">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Mật khẩu mới</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 h-11 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/80 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  placeholder="Nhập mật khẩu mới"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              {password && (
                <div className="mt-3">
                  <div className="flex gap-1 h-1.5 mb-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className={`flex-1 rounded-full ${strength >= i * 25 ? (strength === 100 ? 'bg-emerald-500' : strength >= 50 ? 'bg-yellow-500' : 'bg-red-500') : 'bg-gray-200 dark:bg-slate-700'}`} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Tối thiểu 8 ký tự', met: password.length >= 8 },
                      { label: 'Có chữ hoa', met: /[A-Z]/.test(password) },
                      { label: 'Có chữ thường', met: /[a-z]/.test(password) },
                      { label: 'Số/Ký tự đặc biệt', met: /[0-9!@#$%^&*]/.test(password) },
                    ].map((c) => (
                      <div key={c.label} className={`flex items-center gap-1.5 text-[10px] ${c.met ? 'text-emerald-600' : 'text-gray-500'}`}>
                        <div className={`w-3 h-3 rounded-full flex items-center justify-center border ${c.met ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'}`}>
                          {c.met && <CheckCircle2 className="w-2 h-2" />}
                        </div>
                        {c.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Xác nhận mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 h-11 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/80 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  placeholder="Nhập lại mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !token}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all flex items-center justify-center disabled:opacity-60"
            >
              {isLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Lưu mật khẩu mới'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
