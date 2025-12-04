import React, { useState, useEffect } from 'react';
import { http } from '../api/http';
import { getUser } from '../utils/auth';

interface AdminUser {
  _id: string;
  username: string;
  email?: string;
  role: string;
  createdAt: string;
}

export default function Settings() {
  const currentUser = getUser();
  
  // 修改密码状态
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // 管理员管理状态
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 加载管理员列表
  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setAdminsLoading(true);
      const response = await http.get<AdminUser[]>('/users/admins');
      setAdmins(response.data);
    } catch (err: any) {
      console.error('Failed to fetch admins:', err);
    } finally {
      setAdminsLoading(false);
    }
  };

  // 修改密码
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: '两次输入的新密码不一致' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: '新密码至少需要6个字符' });
      return;
    }

    setPasswordLoading(true);
    try {
      await http.post('/users/change-password', { oldPassword, newPassword });
      setPasswordMessage({ type: 'success', text: '密码修改成功' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const message = err?.response?.data?.message || '修改密码失败';
      setPasswordMessage({ type: 'error', text: message });
    } finally {
      setPasswordLoading(false);
    }
  };

  // 创建管理员
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMessage(null);

    if (!newAdminUsername || !newAdminPassword) {
      setAdminMessage({ type: 'error', text: '用户名和密码为必填项' });
      return;
    }

    if (newAdminPassword.length < 6) {
      setAdminMessage({ type: 'error', text: '密码至少需要6个字符' });
      return;
    }

    setCreateLoading(true);
    try {
      await http.post('/users/create-admin', {
        username: newAdminUsername,
        password: newAdminPassword,
        email: newAdminEmail || undefined,
      });
      setAdminMessage({ type: 'success', text: '管理员创建成功' });
      setNewAdminUsername('');
      setNewAdminPassword('');
      setNewAdminEmail('');
      setShowCreateModal(false);
      fetchAdmins();
    } catch (err: any) {
      const message = err?.response?.data?.message || '创建管理员失败';
      setAdminMessage({ type: 'error', text: message });
    } finally {
      setCreateLoading(false);
    }
  };

  // 删除管理员
  const handleDeleteAdmin = async (id: string, username: string) => {
    if (!confirm(`确定要删除管理员 "${username}" 吗？此操作不可撤销。`)) {
      return;
    }

    try {
      await http.delete(`/users/admins/${id}`);
      setAdminMessage({ type: 'success', text: '管理员已删除' });
      fetchAdmins();
    } catch (err: any) {
      const message = err?.response?.data?.message || '删除管理员失败';
      setAdminMessage({ type: 'error', text: message });
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">系统设置</h1>

      {/* 修改密码 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          修改密码
        </h2>
        
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入当前密码"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请输入新密码（至少6个字符）"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="请再次输入新密码"
              required
            />
          </div>
          
          {passwordMessage && (
            <div className={`p-3 rounded-lg ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {passwordMessage.text}
            </div>
          )}
          
          <button
            type="submit"
            disabled={passwordLoading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {passwordLoading ? '修改中...' : '修改密码'}
          </button>
        </form>
      </div>

      {/* 管理员管理 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            管理员账号
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增管理员
          </button>
        </div>

        {adminMessage && (
          <div className={`p-3 rounded-lg mb-4 ${adminMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {adminMessage.text}
          </div>
        )}

        {adminsLoading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">用户名</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">邮箱</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">创建时间</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm mr-3">
                          {admin.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{admin.username}</span>
                        {admin._id === currentUser?._id && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">当前</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{admin.email || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(admin.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {admin._id !== currentUser?._id && (
                        <button
                          onClick={() => handleDeleteAdmin(admin._id, admin.username)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors"
                        >
                          删除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 创建管理员弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">新增管理员</h3>
            
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名 *</label>
                <input
                  type="text"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="请输入用户名"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码 *</label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="请输入密码（至少6个字符）"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱（可选）</label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="请输入邮箱"
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewAdminUsername('');
                    setNewAdminPassword('');
                    setNewAdminEmail('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createLoading ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

