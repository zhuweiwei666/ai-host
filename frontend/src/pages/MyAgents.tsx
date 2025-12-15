import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserAgent,
  getMyAgents,
  deleteUserAgent,
  submitAgentForReview,
  withdrawAgentReview,
} from '../api';

const visibilityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  private: { label: '私有', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  pending: { label: '审核中', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  public: { label: '已公开', color: 'text-green-700', bgColor: 'bg-green-100' },
  rejected: { label: '已拒绝', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export default function MyAgents() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<UserAgent | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMyAgents();
      setAgents(res.data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '获取角色列表失败';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleDelete = async () => {
    if (!selectedAgent) return;
    try {
      setActionLoading(selectedAgent._id);
      await deleteUserAgent(selectedAgent._id);
      setAgents(prev => prev.filter(a => a._id !== selectedAgent._id));
      setDeleteDialogOpen(false);
      setSelectedAgent(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '删除失败';
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitReview = async (agent: UserAgent) => {
    try {
      setActionLoading(agent._id);
      const res = await submitAgentForReview(agent._id);
      setAgents(prev => prev.map(a => a._id === agent._id ? res.data : a));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '提交审核失败';
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleWithdrawReview = async (agent: UserAgent) => {
    try {
      setActionLoading(agent._id);
      const res = await withdrawAgentReview(agent._id);
      setAgents(prev => prev.map(a => a._id === agent._id ? res.data : a));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '撤回审核失败';
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">我的角色</h1>
        <button
          onClick={() => navigate('/my-agents/create')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          创建角色
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

      {/* Empty State */}
      {agents.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">还没有创建任何角色</h3>
          <p className="text-gray-500 mb-4">点击上方按钮创建你的第一个 AI 角色</p>
          <button
            onClick={() => navigate('/my-agents/create')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            创建角色
          </button>
        </div>
      )}

      {/* Agent Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => {
          const config = visibilityConfig[agent.visibility] || visibilityConfig.private;
          const isLoading = actionLoading === agent._id;

          return (
            <div key={agent._id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Avatar */}
              <div className="h-48 bg-gray-100 relative">
                <img
                  src={agent.avatarUrls?.[0] || 'https://via.placeholder.com/300x200?text=No+Image'}
                  alt={agent.name}
                  className="w-full h-full object-cover"
                />
                <span className={`absolute top-3 right-3 px-2 py-1 text-xs font-medium rounded-full ${config.bgColor} ${config.color}`}>
                  {config.label}
                </span>
              </div>

              <div className="p-4">
                {/* Name */}
                <h3 className="font-semibold text-gray-900 truncate">{agent.name}</h3>
                
                {/* Description */}
                <p className="text-sm text-gray-500 mt-1 line-clamp-2 min-h-[40px]">
                  {agent.description || '暂无描述'}
                </p>

                {/* Reject Reason */}
                {agent.visibility === 'rejected' && agent.reviewStatus?.rejectReason && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
                    拒绝原因：{agent.reviewStatus.rejectReason}
                  </div>
                )}

                {/* Stats */}
                {agent.visibility === 'public' && agent.stats && (
                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    <span>对话: {agent.stats.totalChats}</span>
                    <span>用户: {agent.stats.uniqueUsers}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/my-agents/edit/${agent._id}`)}
                      disabled={agent.visibility === 'pending' || isLoading}
                      className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      title="编辑"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAgent(agent);
                        setDeleteDialogOpen(true);
                      }}
                      disabled={isLoading}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                      title="删除"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Review Actions */}
                  {(agent.visibility === 'private' || agent.visibility === 'rejected') && (
                    <button
                      onClick={() => handleSubmitReview(agent)}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                      提交审核
                    </button>
                  )}

                  {agent.visibility === 'pending' && (
                    <button
                      onClick={() => handleWithdrawReview(agent)}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      )}
                      撤回审核
                    </button>
                  )}

                  {agent.visibility === 'public' && (
                    <span className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      已上架
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
            <p className="text-gray-600 mb-6">
              确定要删除角色 <strong>{selectedAgent?.name}</strong> 吗？此操作无法撤销。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteDialogOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading === selectedAgent?._id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === selectedAgent?._id ? '删除中...' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
