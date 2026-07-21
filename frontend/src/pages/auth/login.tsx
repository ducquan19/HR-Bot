import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useTheme } from '@/contexts/theme-context'
import { Mail, Lock, Eye, EyeOff, Brain, Zap, Shield, Clock, Sun, Moon } from 'lucide-react'

// ─── Animated AI CV Widget ────────────────────────────────────────────────────
function AiCvWidget() {
  const [progress, setProgress] = useState(0)
  const [scores, setScores] = useState({ overall: 0, fit: 0, skill: 0, exp: 0, edu: 0 })
  const [queueVisible, setQueueVisible] = useState(false)

  useEffect(() => {
    let progressTimer: ReturnType<typeof setTimeout>
    let scoreTimer: ReturnType<typeof setTimeout>
    let queueTimer: ReturnType<typeof setTimeout>
    let restartTimer: ReturnType<typeof setTimeout>

    const startAnimation = () => {
      setProgress(0)
      setScores({ overall: 0, fit: 0, skill: 0, exp: 0, edu: 0 })
      setQueueVisible(false)

      progressTimer = setTimeout(() => {
        let p = 0
        const interval = setInterval(() => {
          p += 1
          setProgress(p)
          if (p >= 100) clearInterval(interval)
        }, 15)
      }, 300)

      scoreTimer = setTimeout(() => {
        let tick = 0
        const interval = setInterval(() => {
          tick += 1
          setScores({
            overall: Math.min(Math.round(tick * 1.48), 74),
            fit: Math.min(Math.round(tick * 1.48), 74),
            skill: Math.min(Math.round(tick * 1.76), 88),
            exp: Math.min(Math.round(tick * 1.8), 90),
            edu: Math.min(Math.round(tick * 1.4), 70),
          })
          if (tick >= 50) clearInterval(interval)
        }, 25)
      }, 800)

      queueTimer = setTimeout(() => setQueueVisible(true), 2000)

      restartTimer = setTimeout(startAnimation, 6000)
    }

    startAnimation()

    return () => {
      clearTimeout(progressTimer)
      clearTimeout(scoreTimer)
      clearTimeout(queueTimer)
      clearTimeout(restartTimer)
    }
  }, [])

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-blue-900/5 dark:shadow-blue-900/30 p-6 w-full max-w-[420px] text-sm border border-gray-100 dark:border-slate-700 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200 dark:shadow-blue-900/50">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">AI Phân tích CV</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Senior Backend Engineer · 12 ứng viên</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Đang xử lý
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
          <span>Tiến trình phân tích</span>
          <span className="text-blue-600 dark:text-blue-400">{progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Candidate card */}
      <div className="bg-gray-50/80 dark:bg-slate-700/50 rounded-2xl p-4 mb-5 border border-gray-100/50 dark:border-slate-600/50">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-md shadow-emerald-200 dark:shadow-emerald-900/50">
            TH
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100 text-base">Trần Thị Hương</p>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2.5">Backend Engineer</p>
              </div>
              <div className="text-center bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-blue-100 dark:border-blue-900 shadow-sm">
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Điểm tổng</p>
                <div className="text-xl font-black text-blue-600 dark:text-blue-400 leading-none">{scores.overall}<span className="text-xs ml-0.5">%</span></div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3 font-medium">
              <span className="flex items-center gap-1">💼 5 năm kinh nghiệm</span>
              <span className="flex items-center gap-1">🎓 ĐH KHTN TP.HCM</span>
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              {['Python', 'Django', 'PostgreSQL', 'Docker'].map((s) => (
                <span key={s} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 rounded-md text-[10px] font-bold tracking-wide">{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="mt-5 space-y-3">
          {[
            { label: 'Độ phù hợp', value: scores.fit, color: 'bg-blue-600 dark:bg-blue-500' },
            { label: 'Kỹ năng kỹ thuật', value: scores.skill, color: 'bg-emerald-500' },
            { label: 'Kinh nghiệm', value: scores.exp, color: 'bg-purple-500' },
            { label: 'Học vấn', value: scores.edu, color: 'bg-orange-500' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-28 flex-shrink-0">{item.label}</span>
              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${item.color}`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-8 text-right">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-purple-50/50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50 rounded-xl p-3 mb-5">
        <p className="text-xs text-purple-700 dark:text-purple-300 font-medium flex items-center gap-1.5">
          <span>✨</span> Nhận xét của AI
        </p>
        <p className="text-xs text-purple-600/80 dark:text-purple-400/90 mt-1 leading-relaxed">
          {scores.overall > 20 ? "Kinh nghiệm thực tế tốt. Cần đánh giá thêm về mức độ phù hợp văn hóa công ty." : "Đang tạo nhận xét..."}
        </p>
      </div>

      {/* Queue */}
      <div
        className={`transition-all duration-500 ${queueVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Hàng đợi phân tích
          </p>
          <span className="text-[10px] font-bold bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">3 CV</span>
        </div>
        <div className="flex gap-2">
          {[
            { initials: 'PD', name: 'Phạm Thị Dung', role: 'Marketing Mgr', color: 'bg-pink-500' },
            { initials: 'NB', name: 'Nguyễn Bảo', role: 'Sales Lead', color: 'bg-orange-500' },
            { initials: 'VT', name: 'Võ Thành', role: 'Data Analyst', color: 'bg-teal-500' },
          ].map((p) => (
            <div key={p.initials} className="flex-1 flex flex-col items-center gap-1.5 bg-gray-50 dark:bg-slate-700/60 border border-gray-100 dark:border-slate-600 rounded-xl py-2 px-1">
              <div className={`w-7 h-7 rounded-full ${p.color} flex items-center justify-center text-white text-[10px] font-bold shadow-sm`}>
                {p.initials}
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-800 dark:text-gray-200 font-bold leading-tight truncate w-[80px]">{p.name}</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 truncate w-[80px]">{p.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Login Modal ──────────────────────────────────────────────────────────────
function LoginModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const navigate = useNavigate()
  const { login, register, isLoading } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const getPasswordStrength = (pass: string) => {
    let score = 0
    if (pass.length >= 8) score += 25
    if (/[A-Z]/.test(pass)) score += 25
    if (/[a-z]/.test(pass)) score += 25
    if (/[0-9!@#$%^&*]/.test(pass)) score += 25
    return score
  }
  const strength = getPasswordStrength(password)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    try {
      if (mode === 'login') {
        await login(email, password)
        navigate('/dashboard')
      } else {
        if (password !== confirmPassword) {
          setError('Mật khẩu xác nhận không khớp')
          return
        }
        if (strength < 100) {
          setError('Mật khẩu chưa đủ mạnh. Yêu cầu ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số/ký tự đặc biệt.')
          return
        }
        const res = await register(email, password, name)
        setSuccessMessage(res.message || 'Đăng ký thành công.')
        setMode('login')
        setPassword('')
        setConfirmPassword('')
      }
    } catch (err: any) {
      if (err.message === 'EMAIL_NOT_VERIFIED') {
        setError('Tài khoản chưa được xác thực email. Vui lòng kiểm tra hộp thư của bạn.')
      } else {
        setError(err.message || 'Có lỗi xảy ra')
      }
    }
  }

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
    setSuccessMessage('')
    if (mode === 'login') {
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative glass-panel rounded-3xl w-full max-w-md p-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-2 transition-colors">
          ✕
        </button>
        
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200 dark:shadow-blue-900/50">
            <span className="text-white font-black text-xl">H</span>
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100">
            {mode === 'login' ? 'Chào mừng trở lại!' : 'Tạo tài khoản mới'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            {mode === 'login' ? 'Chào mừng bạn trở lại! Vui lòng đăng nhập vào tài khoản của bạn.' : 'Tạo một tài khoản mới để bắt đầu sử dụng HR Bot.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm font-medium">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
              {successMessage}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Họ và tên</label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 h-11 rounded-xl border border-gray-200/50 dark:border-slate-600 bg-white/50 dark:bg-slate-800/80 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:bg-white dark:focus:bg-slate-800 transition-all dark:placeholder-gray-500"
                  required
                  placeholder="Nhập họ và tên"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 h-11 rounded-xl border border-gray-200/50 dark:border-slate-600 bg-white/50 dark:bg-slate-800/80 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:bg-white dark:focus:bg-slate-800 transition-all dark:placeholder-gray-500"
                required
                placeholder="Nhập email làm việc"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 h-11 rounded-xl border border-gray-200/50 dark:border-slate-600 bg-white/50 dark:bg-slate-800/80 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:bg-white dark:focus:bg-slate-800 transition-all dark:placeholder-gray-500"
                required
                placeholder="Nhập mật khẩu"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mode === 'register' && (
              <div className="mt-3 space-y-3">
                {password.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5 h-1.5 w-full">
                      <div className={`h-full flex-1 rounded-full ${strength >= 25 ? (strength >= 100 ? 'bg-emerald-500' : strength >= 75 ? 'bg-blue-500' : strength >= 50 ? 'bg-yellow-500' : 'bg-red-500') : 'bg-gray-200 dark:bg-slate-600'}`} />
                      <div className={`h-full flex-1 rounded-full ${strength >= 50 ? (strength >= 100 ? 'bg-emerald-500' : strength >= 75 ? 'bg-blue-500' : 'bg-yellow-500') : 'bg-gray-200 dark:bg-slate-600'}`} />
                      <div className={`h-full flex-1 rounded-full ${strength >= 75 ? (strength >= 100 ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-gray-200 dark:bg-slate-600'}`} />
                      <div className={`h-full flex-1 rounded-full ${strength >= 100 ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-600'}`} />
                    </div>
                    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 text-right">
                      {strength < 50 ? 'Yếu' : strength < 100 ? 'Trung bình' : 'Mạnh'}
                    </p>
                  </div>
                )}
                
                <div className="bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700 rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-2.5">Yêu cầu mật khẩu:</p>
                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-2">
                    {[
                      { label: 'Tối thiểu 8 ký tự', met: password.length >= 8 },
                      { label: 'Có chữ hoa', met: /[A-Z]/.test(password) },
                      { label: 'Có chữ thường', met: /[a-z]/.test(password) },
                      { label: 'Số/Ký tự đặc biệt', met: /[0-9!@#$%^&*]/.test(password) },
                    ].map((c) => (
                      <div key={c.label} className={`flex items-center gap-1.5 text-[10px] transition-colors ${c.met ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-500 dark:text-gray-500 font-medium'}`}>
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-colors ${c.met ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700'}`}>
                          {c.met && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        {c.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Xác nhận mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 h-11 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/80 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:bg-white dark:focus:bg-slate-800 transition-all dark:placeholder-gray-500"
                  required
                  placeholder="Nhập lại mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div className="mt-2 text-right">
              <a href="/forgot-password" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                Quên mật khẩu?
              </a>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-blue-200 dark:shadow-blue-900/50 mt-4"
          >
            {isLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 font-medium">
          {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
          <button type="button" onClick={toggleMode} className="ml-1 text-blue-600 dark:text-blue-400 font-bold hover:underline">
            {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Landing Page ─────────────────────────────────────────────────────────────
export function LoginPage() {
  const [showLoginModal, setShowLoginModal] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-mesh-gradient font-sans overflow-hidden">
      {/* Navbar */}
      <nav className="flex items-center justify-between py-5 px-6 md:px-10 max-w-7xl mx-auto relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-black text-sm">
            H
          </div>
          <span className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
            HR <span className="text-blue-600 dark:text-blue-400">Bot</span>
          </span>
        </div>
        

        <div className="flex items-center gap-3">
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all shadow-sm"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button 
            onClick={() => setShowLoginModal(true)} 
            className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-5 py-2 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors hidden sm:block"
          >
            Đăng nhập
          </button>
          <button 
            onClick={() => setShowLoginModal(true)}
            className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-xl shadow-md shadow-blue-200 dark:shadow-blue-900/50 transition-all"
          >
            Dùng thử miễn phí
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 md:px-10 pt-6 md:pt-8 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center relative z-10">
        
        {/* Left side */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-bold tracking-wide mb-6">
            ✨ AI hỗ trợ tuyển dụng thông minh
          </div>
          
          <h1 className="text-5xl lg:text-[64px] font-black text-gray-900 dark:text-gray-100 leading-[1.1] mb-6 tracking-tight">
            Tuyển <span className="text-blue-600 dark:text-blue-400">đúng người</span><br />
            hiệu quả <span className="text-red-500">vượt trội</span>
          </h1>
          
          <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed mb-8 font-medium">
            HR Bot là nền tảng ứng dụng trí tuệ nhân tạo giúp doanh nghiệp tự động hóa quy trình tuyển dụng, tìm kiếm và đánh giá ứng viên nhanh chóng, chính xác.
          </p>
          
          <div className="flex flex-wrap items-center gap-4 mb-16">
            <button 
              onClick={() => setShowLoginModal(true)}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 dark:shadow-blue-900/50 transition-all flex items-center gap-2"
            >
              Dùng thử miễn phí →
            </button>

          </div>

          {/* Feature cards row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3 group hover:border-green-200 dark:hover:border-green-800 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-[13px] whitespace-nowrap">Đảm bảo chất lượng</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">AI kiểm tra và đánh giá ứng viên một cách khách quan và chính xác.</p>
              <div className="w-8 h-1 bg-green-500 rounded-full mt-auto opacity-50 group-hover:opacity-100 transition-opacity"></div>
            </div>
            
            <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3 group hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-[13px] whitespace-nowrap">Độ chính xác cao</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">Thuật toán AI tiên tiến giúp lọc và xếp hạng ứng viên phù hợp nhất.</p>
              <div className="w-8 h-1 bg-blue-500 rounded-full mt-auto opacity-50 group-hover:opacity-100 transition-opacity"></div>
            </div>
            
            <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3 group hover:border-orange-200 dark:hover:border-orange-800 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-500 dark:text-orange-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-[13px] whitespace-nowrap">Tiết kiệm thời gian</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">Tự động hóa quy trình tuyển dụng, giảm thiểu thời gian và chi phí.</p>
              <div className="w-8 h-1 bg-orange-500 rounded-full mt-auto opacity-50 group-hover:opacity-100 transition-opacity"></div>
            </div>
          </div>
        </div>

        {/* Right side - AI Widget */}
        <div className="relative flex justify-center items-center lg:justify-end">
          <div className="absolute inset-0 bg-blue-50/50 dark:bg-blue-900/10 rounded-full blur-[100px] -z-10 w-[120%] h-[120%] -translate-x-[10%] -translate-y-[10%]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-indigo-50/50 dark:bg-indigo-900/10 rounded-full blur-[80px] -z-10"></div>
          
          <AiCvWidget />
        </div>
      </main>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  )
}
