import { useState, useEffect } from 'react';
import {
  ReviewAgent,
  getPendingReviewAgents,
  getAllUserAgents,
  approveAgent,
  rejectAgent,
} from '../api';

export default function ReviewAgents() {
  const [tabValue, setTabValue] = useState(0);
  const [pendingAgents, setPendingAgents] = useState<ReviewAgent[]>([]);
  const [allAgents, setAllAgents] = useState<ReviewAgent[]>([]);
  const [stats, setStats] = useState({ private: 0, pending: 0, public: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dialogs
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<ReviewAgent | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const getCreatorName = (creatorId: ReviewAgent['creatorId']) => {
    if (!creatorId) return '未知';
    if (typeof creatorId === 'string') return creatorId;
    return creatorId.username || '未知';
  };

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await getPendingReviewAgents({ limit: 50 });
      setPendingAgents(res.data.agents);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取待审核列表失败';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res = await getAllUserAgents({ limit: 100 });
      setAllAgents(res.data.agents);
      setStats(res.data.stats);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取角色列表失败';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tabValue === 0) {
      fetchPending();
    } else {
      fetchAll();
    }
  }, [tabValue]);

  const handleApprove = async (agent: ReviewAgent) => {
    try {
      setActionLoading(agent._id);
      await approveAgent(agent._id);
      // Remove from pending list
      setPendingAgents(prev => prev.filter(a => a._id !== agent._id));
      // Update stats
      setStats(prev => ({
        ...prev,
        pending: prev.pending - 1,
        public: prev.public + 1,
      }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败';
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedAgent || !rejectReason.trim()) return;
    try {
      setActionLoading(selectedAgent._id);
      await rejectAgent(selectedAgent._id, rejectReason);
      // Remove from pending list
      setPendingAgents(prev => prev.filter(a => a._id !== selectedAgent._id));
      // Update stats
      setStats(prev => ({
        ...prev,
        pending: prev.pending - 1,
        rejected: prev.rejected + 1,
      }));
      setRejectDialogOpen(false);
      setRejectReason('');
      setSelectedAgent(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败';
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (agent: ReviewAgent) => {
    setSelectedAgent(agent);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const openDetailDialog = (agent: ReviewAgent) => {
    setSelectedAgent(agent);
    setDetailDialogOpen(true);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const getVisibilityBadge = (visibility: string) => {
    const config: Record<string, { label: string; className: string }> = {
      private: { label: '私有', className: 'bg-gray-100 text-gray-700' },
      pending: { label: '待审核', className: 'bg-yellow-100 text-yellow-700' },
      public: { label: '已公开', className: 'bg-green-100 text-green-700' },
      rejected: { label: '已拒绝', className: 'bg-red-100 text-red-700' },
    };
    const c = config[visibility] || config.private;
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${c.className}`}>{c.label}</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">角色审核管理</h1>
        <button
          onClick={() => tabValue === 0 ? fetchPending() : fetchAll()}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex justify-between items-center">
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
          <div className="text-sm text-gray-500">待审核</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{stats.public}</div>
          <div className="text-sm text-gray-500">已通过</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{stats.rejected}</div>
          <div className="text-sm text-gray-500">已拒绝</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-3xl font-bold text-gray-600">{stats.private}</div>
          <div className="text-sm text-gray-500">私有</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setTabValue(0)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                tabValue === 0
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              待审核
              {stats.pending > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                  {stats.pending}
                </span>
              )}
            </button>
            <button
              onClick={() => setTabValue(1)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                tabValue === 1
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              全部角色
            </button>
          </nav>
        </div>

        {/* Pending Tab */}
        {tabValue === 0 && (
          <div className="p-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : pendingAgents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">暂无待审核的角色</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingAgents.map(agent => (
                  <div key={agent._id} className="bg-gray-50 rounded-xl overflow-hidden">
                    <div className="h-40 bg-gray-200">
                      <img
                        src={agent.avatarUrls?.[0] || 'https://via.placeholder.com/300x180?text=No+Image'}
                        alt={agent.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 truncate">{agent.name}</h3>
                      <p className="text-sm text-gray-500">创建者: {getCreatorName(agent.creatorId)}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        提交时间: {formatDate(agent.reviewStatus?.submittedAt)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between px-4 pb-4">
                      <button
                        onClick={() => openDetailDialog(agent)}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-white rounded-lg transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openRejectDialog(agent)}
                          disabled={actionLoading === agent._id}
                          className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === agent._id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent"></div>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          拒绝
                        </button>
                        <button
                          onClick={() => handleApprove(agent)}
                          disabled={actionLoading === agent._id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === agent._id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          通过
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* All Tab */}
        {tabValue === 1 && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建者</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allAgents.map(agent => (
                    <tr key={agent._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={agent.avatarUrls?.[0] || 'https://via.placeholder.com/40'}
                            alt={agent.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div>
                            <div className="font-medium text-gray-900">{agent.name}</div>
                            <div className="text-xs text-gray-500">
                              {agent.gender === 'female' ? '女' : agent.gender === 'male' ? '男' : '其他'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getCreatorName(agent.creatorId)}
                      </td>
                      <td className="px-4 py-3">
                        {getVisibilityBadge(agent.visibility)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(agent.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openDetailDialog(agent)}
                          className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="查看详情"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      {rejectDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">拒绝角色</h3>
            <p className="text-gray-600 mb-4">
              确定要拒绝角色 <strong>{selectedAgent?.name}</strong> 吗？
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">拒绝原因 *</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors resize-none"
                placeholder="请填写拒绝原因，创建者将看到此信息"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRejectDialogOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading === selectedAgent?._id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === selectedAgent?._id ? '处理中...' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      {detailDialogOpen && selectedAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">角色详情</h3>
              <button
                onClick={() => setDetailDialogOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <img
                  src={selectedAgent.avatarUrls?.[0] || 'https://via.placeholder.com/300'}
                  alt={selectedAgent.name}
                  className="w-full rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <h4 className="text-xl font-bold text-gray-900 mb-2">{selectedAgent.name}</h4>
                <p className="text-sm text-gray-500 mb-3">
                  性别: {selectedAgent.gender === 'female' ? '女' : selectedAgent.gender === 'male' ? '男' : '其他'} | 
                  风格: {selectedAgent.style === 'anime' ? '动漫' : '写实'}
                </p>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700">描述:</span>
                    <p className="text-sm text-gray-600">{selectedAgent.description || '无'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">开场白:</span>
                    <p className="text-sm text-gray-600">{selectedAgent.defaultGreeting || '无'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">角色设定:</span>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap">{selectedAgent.systemPrompt || '无'}</pre>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                  <p>创建者: {getCreatorName(selectedAgent.creatorId)}</p>
                  <p>创建时间: {formatDate(selectedAgent.createdAt)}</p>
                  <p className="mt-1">状态: {getVisibilityBadge(selectedAgent.visibility)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
