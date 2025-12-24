import { useState, useEffect } from 'react';
import {
  getApplications,
  createApplication,
  addAppChannel,
  Application
} from '../api';

export default function ApplicationManagement() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppDesc, setNewAppDesc] = useState('');

  const [showChannelModal, setShowChannelModal] = useState<string | null>(null);
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelName, setNewChannelName] = useState('');

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await getApplications();
      setApps(res.data);
    } catch (err) {
      console.error('Failed to fetch apps:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleCreateApp = async () => {
    if (!newAppName) return;
    try {
      await createApplication({ name: newAppName, description: newAppDesc });
      setNewAppName('');
      setNewAppDesc('');
      setShowAddModal(false);
      fetchApps();
    } catch (err) {
      alert('创建失败: ' + err);
    }
  };

  const handleAddChannel = async () => {
    if (!showChannelModal || !newChannelId || !newChannelName) return;
    try {
      await addAppChannel(showChannelModal, newChannelId, newChannelName);
      setNewChannelId('');
      setNewChannelName('');
      setShowChannelModal(null);
      fetchApps();
    } catch (err) {
      alert('添加渠道失败: ' + err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📱 应用与归因管理</h1>
          <p className="text-gray-500 text-sm">管理接入中台的多个 AI 工具 App 及其推广渠道</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          + 注册新应用
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {apps.map(app => (
            <div key={app.appId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-50 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-gray-900">{app.name}</h3>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded font-mono">
                      {app.appId}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      app.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {app.status === 'active' ? '运行中' : '已停用'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{app.description || '暂无描述'}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-1">Secret Key</div>
                  <code className="px-2 py-1 bg-gray-100 rounded text-xs select-all">{app.secretKey}</code>
                </div>
              </div>
              
              <div className="p-5 bg-gray-50/30">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-semibold text-gray-700">归因渠道 ({app.channels?.length || 0})</h4>
                  <button 
                    onClick={() => setShowChannelModal(app.appId)}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    + 添加渠道
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  {app.channels?.map(channel => (
                    <div key={channel.channelId} className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center gap-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{channel.name}</div>
                        <div className="text-xs font-mono text-gray-400">{channel.channelId}</div>
                      </div>
                    </div>
                  ))}
                  {(!app.channels || app.channels.length === 0) && (
                    <div className="text-xs text-gray-400 italic">暂无归因渠道，请点击添加</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add App Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">注册新应用</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">应用名称</label>
                <input
                  type="text"
                  value={newAppName}
                  onChange={e => setNewAppName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="例如：AI视频助手"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">应用描述</label>
                <textarea
                  value={newAppDesc}
                  onChange={e => setNewAppDesc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none h-24"
                  placeholder="简要说明该应用的功能..."
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleCreateApp}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Channel Modal */}
      {showChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">添加归因渠道</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">渠道 ID (channelId)</label>
                <input
                  type="text"
                  value={newChannelId}
                  onChange={e => setNewChannelId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="例如：tiktok_ads_01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">渠道名称</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="例如：TikTok 12月信息流广告"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowChannelModal(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleAddChannel}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
