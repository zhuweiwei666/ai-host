import React, { useEffect, useState } from 'react';
import { User, getUsers, rechargeUser, initAdminUser, createUser } from '../api';

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState(100);
  
  // Filters
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'operator' | 'channel'>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'web' | 'android' | 'ios'>('all');
  
  // Create user form
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    userType: 'channel' as 'operator' | 'channel',
    platform: 'web' as 'web' | 'android' | 'ios',
    role: 'user' as 'admin' | 'user'
  });

  const fetchUsers = async () => {
    try {
      const params: any = {};
      if (userTypeFilter !== 'all') {
        params.userType = userTypeFilter;
      }
      if (platformFilter !== 'all') {
        params.platform = platformFilter;
      }
      const res = await getUsers(params);
      setUsers(res.data);
    } catch (error) {
      console.error('Failed to fetch users', error);
    }
  };

  useEffect(() => {
    initAdminUser().then(() => fetchUsers()).catch(console.error);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [userTypeFilter, platformFilter]);

  const handleRechargeClick = (user: User) => {
    setSelectedUser(user);
    setRechargeAmount(100);
    setShowRechargeModal(true);
  };

  const confirmRecharge = async () => {
    if (!selectedUser) return;
    try {
      await rechargeUser(selectedUser._id, rechargeAmount);
      alert(`Successfully recharged ${rechargeAmount} coins for ${selectedUser.username}`);
      setShowRechargeModal(false);
      fetchUsers();
    } catch (error) {
      alert('Recharge failed');
      console.error(error);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!newUser.username) {
        alert('Username is required');
        return;
      }
      if (newUser.userType === 'channel' && !newUser.password) {
        alert('Password is required for channel users');
        return;
      }
      if (newUser.password && newUser.password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
      }
      
      await createUser(newUser);
      alert('User created successfully');
      setShowCreateModal(false);
      setNewUser({
        username: '',
        email: '',
        phone: '',
        password: '',
        userType: 'channel',
        platform: 'web',
        role: 'user'
      });
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create user');
      console.error(error);
    }
  };

  const getUserTypeLabel = (userType?: string) => {
    switch (userType) {
      case 'operator': return '运营用户';
      case 'channel': return '渠道用户';
      default: return '未知';
    }
  };

  const getPlatformLabel = (platform?: string) => {
    switch (platform) {
      case 'web': return 'Web';
      case 'android': return 'Android';
      case 'ios': return 'iOS';
      case 'admin': return 'Admin';
      default: return '-';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="space-y-2">
          <h2 className="text-4xl font-bold gradient-text">用户管理</h2>
          <p className="text-base text-gray-600 font-medium">管理运营用户和渠道用户</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600 hover:from-primary-700 hover:via-purple-700 hover:to-pink-700 transition-all duration-200 hover:shadow-xl hover:shadow-primary-500/30 hover:scale-105 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          创建用户
        </button>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-6 border border-white/50 shadow-soft">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">用户类型:</span>
            <div className="flex glass p-1 rounded-lg">
              <button
                onClick={() => setUserTypeFilter('all')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  userTypeFilter === 'all' 
                    ? 'bg-gradient-to-r from-primary-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:bg-white/50'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setUserTypeFilter('operator')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  userTypeFilter === 'operator' 
                    ? 'bg-gradient-to-r from-primary-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:bg-white/50'
                }`}
              >
                运营用户
              </button>
              <button
                onClick={() => setUserTypeFilter('channel')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  userTypeFilter === 'channel' 
                    ? 'bg-gradient-to-r from-primary-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:bg-white/50'
                }`}
              >
                渠道用户
              </button>
            </div>
          </div>
          
          {userTypeFilter === 'channel' && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">平台:</span>
              <div className="flex glass p-1 rounded-lg">
                <button
                  onClick={() => setPlatformFilter('all')}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    platformFilter === 'all' 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                      : 'text-gray-600 hover:bg-white/50'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => setPlatformFilter('web')}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    platformFilter === 'web' 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                      : 'text-gray-600 hover:bg-white/50'
                  }`}
                >
                  Web
                </button>
                <button
                  onClick={() => setPlatformFilter('android')}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    platformFilter === 'android' 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                      : 'text-gray-600 hover:bg-white/50'
                  }`}
                >
                  Android
                </button>
                <button
                  onClick={() => setPlatformFilter('ios')}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    platformFilter === 'ios' 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                      : 'text-gray-600 hover:bg-white/50'
                  }`}
                >
                  iOS
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Table */}
      <div className="glass rounded-xl overflow-hidden border border-white/50 shadow-soft">
        <table className="min-w-full divide-y divide-gray-200/50">
          <thead className="bg-gradient-to-r from-gray-50/80 to-gray-100/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">用户信息</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">类型</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">平台</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">外部ID</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">余额</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">创建时间</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white/50 divide-y divide-gray-200/50">
            {users.map((user) => (
              <tr key={user._id} className="hover:bg-white/80 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg ${
                      user.userType === 'operator' 
                        ? 'bg-gradient-to-br from-primary-500 to-purple-600' 
                        : 'bg-gradient-to-br from-green-500 to-emerald-600'
                    }`}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-semibold text-gray-900">{user.username}</div>
                      <div className="text-xs text-gray-500">{user.email || user.phone || 'No contact'}</div>
                      <div className="text-xs text-gray-400 font-mono">ID: {user._id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-lg ${
                      user.userType === 'operator' 
                        ? 'bg-gradient-to-r from-primary-100 to-purple-100 text-primary-700 border border-primary-200/50' 
                        : 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200/50'
                    }`}>
                      {getUserTypeLabel(user.userType)}
                    </span>
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-lg ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700 border border-purple-200/50' : 'bg-gray-100 text-gray-700 border border-gray-200/50'
                  }`}>
                    {user.role}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2.5 py-1 inline-flex text-xs font-semibold rounded-lg bg-blue-100 text-blue-700 border border-blue-200/50">
                    {getPlatformLabel(user.platform)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.externalUserId ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                        {user.externalUserId}
                      </span>
                      {user.externalAppId && (
                        <span className="text-xs text-gray-500">App: {user.externalAppId}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                  💎 {user.balance ?? 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => handleRechargeClick(user)}
                    className="text-primary-600 hover:text-primary-700 bg-primary-50 px-4 py-1.5 rounded-lg transition-all duration-200 hover:bg-primary-100 font-semibold"
                  >
                    充值
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-lg font-medium">暂无用户</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recharge Modal */}
      {showRechargeModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass rounded-2xl shadow-2xl max-w-sm w-full p-8 animate-scale-in border border-white/30">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">充值钱包</h3>
            <p className="text-sm text-gray-600 mb-6">
              为用户 <strong>{selectedUser.username}</strong> 充值 AI 币
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">金额</label>
              <input 
                type="number" 
                min="1"
                className="w-full glass border border-white/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all duration-200 text-gray-900"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(Number(e.target.value))}
              />
              <div className="flex gap-2 mt-3">
                {[100, 500, 1000, 5000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setRechargeAmount(amt)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all duration-200 ${
                      rechargeAmount === amt 
                        ? 'bg-gradient-to-r from-primary-500 to-purple-600 text-white shadow-lg' 
                        : 'glass border border-white/50 text-gray-600 hover:bg-white/50'
                    }`}
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowRechargeModal(false)}
                className="px-6 py-2.5 text-gray-700 hover:bg-gray-100/80 rounded-xl font-semibold transition-all duration-200"
              >
                取消
              </button>
              <button 
                onClick={confirmRecharge}
                className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
              >
                确认充值
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in border border-white/30 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">创建用户</h3>
            <p className="text-sm text-gray-600 mb-6">创建新的运营用户或渠道用户</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">用户类型 *</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewUser({ ...newUser, userType: 'operator', platform: 'web' })}
                    className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                      newUser.userType === 'operator'
                        ? 'bg-gradient-to-r from-primary-500 to-purple-600 text-white shadow-lg'
                        : 'glass border border-white/50 text-gray-600 hover:bg-white/50'
                    }`}
                  >
                    运营用户
                  </button>
                  <button
                    onClick={() => setNewUser({ ...newUser, userType: 'channel', platform: 'web' })}
                    className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                      newUser.userType === 'channel'
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                        : 'glass border border-white/50 text-gray-600 hover:bg-white/50'
                    }`}
                  >
                    渠道用户
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">用户名 *</label>
                <input 
                  type="text"
                  className="w-full glass border border-white/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all duration-200 text-gray-900"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="输入用户名"
                />
              </div>

              {newUser.userType === 'channel' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">密码 *</label>
                    <input 
                      type="password"
                      className="w-full glass border border-white/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all duration-200 text-gray-900"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="至少6个字符"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">平台</label>
                    <div className="flex gap-2">
                      {['web', 'android', 'ios'].map(platform => (
                        <button
                          key={platform}
                          onClick={() => setNewUser({ ...newUser, platform: platform as any })}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                            newUser.platform === platform
                              ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg'
                              : 'glass border border-white/50 text-gray-600 hover:bg-white/50'
                          }`}
                        >
                          {platform.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">邮箱</label>
                <input 
                  type="email"
                  className="w-full glass border border-white/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all duration-200 text-gray-900"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="可选"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">手机号</label>
                <input 
                  type="tel"
                  className="w-full glass border border-white/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all duration-200 text-gray-900"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="可选"
                />
              </div>

              {newUser.userType === 'operator' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">角色</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewUser({ ...newUser, role: 'user' })}
                      className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                        newUser.role === 'user'
                          ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg'
                          : 'glass border border-white/50 text-gray-600 hover:bg-white/50'
                      }`}
                    >
                      普通用户
                    </button>
                    <button
                      onClick={() => setNewUser({ ...newUser, role: 'admin' })}
                      className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                        newUser.role === 'admin'
                          ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                          : 'glass border border-white/50 text-gray-600 hover:bg-white/50'
                      }`}
                    >
                      管理员
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUser({
                    username: '',
                    email: '',
                    phone: '',
                    password: '',
                    userType: 'channel',
                    platform: 'web',
                    role: 'user'
                  });
                }}
                className="px-6 py-2.5 text-gray-700 hover:bg-gray-100/80 rounded-xl font-semibold transition-all duration-200"
              >
                取消
              </button>
              <button 
                onClick={handleCreateUser}
                className="px-6 py-2.5 bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600 text-white rounded-xl hover:from-primary-700 hover:via-purple-700 hover:to-pink-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
              >
                创建用户
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
