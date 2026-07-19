import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { api } from '@/lib/api'
import { UserCircle, Key, ShieldCheck, Mail, LogOut, CheckCircle2, AlertCircle } from 'lucide-react'

export function SettingsPage() {
  const { user, isAdmin, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'users'>('profile')
  
  // Form Đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.')
      return
    }
    
    setIsChangingPassword(true)
    try {
      await api.auth.changePassword(currentPassword, newPassword)
      setPasswordSuccess('Đổi mật khẩu thành công!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setPasswordError(err.message || 'Lỗi khi đổi mật khẩu.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const tabs = [
    { id: 'profile', label: 'Hồ sơ cá nhân', icon: UserCircle },
    { id: 'security', label: 'Bảo mật', icon: Key },
    ...(isAdmin ? [{ id: 'users', label: 'Quản lý nhân sự', icon: ShieldCheck }] : []),
  ]

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Cài đặt</h1>
        <p className="text-gray-500 text-sm">Quản lý hồ sơ, mật khẩu và tùy chọn hệ thống của bạn</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm sticky top-8">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isActive 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    {tab.label}
                  </button>
                )
              })}
              
              <div className="pt-4 mt-4 border-t border-gray-100">
                <button 
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-all"
                >
                  <LogOut className="w-5 h-5 text-red-500" />
                  Đăng xuất
                </button>
              </div>
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <UserCircle className="w-6 h-6 text-blue-500" />
                Thông tin cá nhân
              </h2>
              
              <div className="flex items-center gap-6 mb-8 pb-8 border-b border-gray-100">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-md border-4 border-white">
                  {user?.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{user?.name}</h3>
                  <div className="flex items-center gap-2 text-gray-500 mt-1">
                    <Mail className="w-4 h-4" />
                    <span>{user?.email}</span>
                  </div>
                  <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    Vai trò: {user?.role}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-70 cursor-not-allowed">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Họ và tên</label>
                  <input 
                    type="text" 
                    value={user?.name || ''} 
                    disabled 
                    className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-medium text-gray-600" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email đăng nhập</label>
                  <input 
                    type="email" 
                    value={user?.email || ''} 
                    disabled 
                    className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-medium text-gray-600" 
                  />
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs text-gray-500 italic flex items-center gap-1.5 mt-2">
                    <ShieldCheck className="w-4 h-4 text-gray-400" />
                    Tính năng sửa hồ sơ đang được phát triển.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Key className="w-6 h-6 text-amber-500" />
                Đổi mật khẩu
              </h2>
              
              <form onSubmit={handlePasswordChange} className="max-w-md space-y-5">
                {passwordError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {passwordSuccess}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mật khẩu hiện tại</label>
                  <input 
                    type="password" 
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mật khẩu mới</label>
                  <input 
                    type="password" 
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Xác nhận mật khẩu mới</label>
                  <input 
                    type="password" 
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" 
                  />
                </div>
                
                <button 
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md shadow-blue-200 mt-2 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isChangingPassword ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    'Cập nhật mật khẩu'
                  )}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'users' && isAdmin && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-purple-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Quản lý nhân sự</h2>
                <p className="text-gray-500 max-w-sm mx-auto">
                  Tính năng quản lý tài khoản Recruiter sẽ sớm ra mắt trong bản cập nhật tiếp theo. 
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
