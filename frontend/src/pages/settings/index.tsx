import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import { UserCircle, ShieldCheck, Mail, LogOut, CheckCircle2, AlertCircle, Key, Lock, Unlock } from 'lucide-react'
import { User } from '@/types'

export function SettingsPage() {
  const { user, isAdmin, logout } = useAuth()
  const { updateProfile: updateStoreProfile } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'profile' | 'users'>('profile')
  
  // Profile Form
  const [profileName, setProfileName] = useState(user?.name || '')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    if (user?.name) setProfileName(user.name)
  }, [user?.name])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess('')
    if (!profileName.trim()) return

    setIsUpdatingProfile(true)
    try {
      await updateStoreProfile(profileName)
      setProfileSuccess('Cập nhật hồ sơ thành công!')
    } catch (err: any) {
      setProfileError(err.message || 'Lỗi khi cập nhật hồ sơ.')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  // Password Form
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

  // Users Management
  const [users, setUsers] = useState<User[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const fetchUsers = async () => {
    setIsLoadingUsers(true)
    try {
      const data = await api.users.list()
      setUsers(data)
    } catch (err) {
      console.error('Failed to load users', err)
    } finally {
      setIsLoadingUsers(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'users' && isAdmin) {
      fetchUsers()
    }
  }, [activeTab, isAdmin])

  const handleToggleUserStatus = async (targetUser: User) => {
    if (targetUser.role === 'admin') {
      alert('Không thể thay đổi trạng thái của Admin.')
      return
    }
    
    setUpdatingUserId(targetUser.id)
    try {
      const newStatus = !targetUser.isActive
      await api.users.updateStatus(targetUser.id, newStatus)
      setUsers(users.map(u => u.id === targetUser.id ? { ...u, isActive: newStatus } : u))
    } catch (err) {
      alert('Lỗi khi cập nhật trạng thái user.')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const tabs = [
    { id: 'profile', label: 'Hồ sơ cá nhân', icon: UserCircle },
    ...(isAdmin ? [{ id: 'users', label: 'Quản lý nhân sự', icon: ShieldCheck }] : []),
  ]

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-2">Cài đặt</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Quản lý hồ sơ, mật khẩu và tùy chọn hệ thống của bạn</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="glass-panel rounded-2xl border-gray-100 dark:border-gray-800 p-3 shadow-sm sticky top-8">
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
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
                    {tab.label}
                  </button>
                )
              })}
              
              <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
                <button 
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                >
                  <LogOut className="w-5 h-5 text-red-500 dark:text-red-400" />
                  Đăng xuất
                </button>
              </div>
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          {activeTab === 'profile' && (
            <>
              {/* Thông tin hồ sơ */}
              <div className="glass-panel rounded-2xl border-gray-100 dark:border-gray-800 p-8 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <UserCircle className="w-6 h-6 text-blue-500" />
                  Thông tin cá nhân
                </h2>
                
                <div className="flex items-center gap-6 mb-8 pb-8 border-b border-gray-100 dark:border-gray-800">
                  <div className="relative group">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-md border-4 border-white dark:border-slate-800 transition-all">
                      {user?.name.charAt(0)}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{user?.name}</h3>
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mt-1">
                      <Mail className="w-4 h-4" />
                      <span>{user?.email}</span>
                    </div>
                    <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      isAdmin ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      Vai trò: {user?.role}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {profileError && (
                    <div className="md:col-span-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {profileError}
                    </div>
                  )}
                  {profileSuccess && (
                    <div className="md:col-span-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      {profileSuccess}
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Họ và tên</label>
                    <input 
                      type="text" 
                      value={profileName} 
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                      className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900/50 px-4 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email đăng nhập</label>
                    <input 
                      type="email" 
                      value={user?.email || ''} 
                      disabled 
                      className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/30 px-4 text-sm font-medium text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-70" 
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <button 
                      type="submit"
                      disabled={isUpdatingProfile || profileName === user?.name}
                      className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isUpdatingProfile ? (
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      ) : (
                        'Lưu thay đổi'
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Đổi mật khẩu */}
              <div className="glass-panel rounded-2xl border-gray-100 dark:border-gray-800 p-8 shadow-sm mt-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <Key className="w-6 h-6 text-amber-500" />
                  Đổi mật khẩu
                </h2>
                
                <form onSubmit={handlePasswordChange} className="max-w-md space-y-5">
                  {passwordError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      {passwordSuccess}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Mật khẩu hiện tại</label>
                    <input 
                      type="password" 
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900/50 px-4 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Mật khẩu mới</label>
                    <input 
                      type="password" 
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900/50 px-4 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Xác nhận mật khẩu mới</label>
                    <input 
                      type="password" 
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900/50 px-4 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" 
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
            </>
          )}

          {activeTab === 'users' && isAdmin && (
            <div className="glass-panel rounded-2xl border-gray-100 dark:border-gray-800 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-purple-500" />
                    Quản lý nhân sự
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Khóa hoặc mở khóa tài khoản của các Recruiter</p>
                </div>
              </div>

              {isLoadingUsers ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400">Đang tải danh sách...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <th className="pb-3 font-semibold text-gray-500 dark:text-gray-400">Nhân sự</th>
                        <th className="pb-3 font-semibold text-gray-500 dark:text-gray-400">Vai trò</th>
                        <th className="pb-3 font-semibold text-gray-500 dark:text-gray-400">Trạng thái</th>
                        <th className="pb-3 font-semibold text-gray-500 dark:text-gray-400 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {users.map(u => (
                        <tr key={u.id} className="group hover:bg-gray-50 dark:hover:bg-slate-900/50 transition-colors">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                                {u.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white">{u.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className="capitalize text-gray-700 dark:text-gray-300">{u.role}</span>
                          </td>
                          <td className="py-4">
                            {u.isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-transparent">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                Hoạt động
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-transparent">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                Bị khóa
                              </span>
                            )}
                          </td>
                          <td className="py-4 text-right">
                            {u.role !== 'admin' && (
                              <button
                                onClick={() => handleToggleUserStatus(u)}
                                disabled={updatingUserId === u.id}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                  u.isActive 
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400' 
                                    : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 dark:text-green-400'
                                }`}
                              >
                                {updatingUserId === u.id ? (
                                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                ) : u.isActive ? (
                                  <><Lock className="w-3.5 h-3.5" /> Khóa tài khoản</>
                                ) : (
                                  <><Unlock className="w-3.5 h-3.5" /> Mở khóa</>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && !isLoadingUsers && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-gray-500 dark:text-gray-400">
                            Không có nhân sự nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
