import React from 'react';
import { Agent, deleteAgent } from '../api';
import { useNavigate } from 'react-router-dom';
import { normalizeImageUrl } from '../utils/imageUrl';

interface AgentCardProps {
  agent: Agent;
  onDelete: () => void;
  onToggleStatus?: () => void; // New prop for toggling status
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, onDelete, onToggleStatus }) => {
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete ${agent.name}?`)) {
      try {
      await deleteAgent(agent._id!);
        onDelete(); // Refresh list on success
      } catch (error) {
        console.error('Delete failed:', error);
        alert('Failed to delete agent. Please try again.');
      }
    }
  };

  return (
    <div className={`group glass rounded-2xl p-6 flex flex-col gap-5 transition-all duration-300 card-hover relative overflow-hidden ${
      agent.status === 'offline' ? 'opacity-75' : ''
    }`}>
      {/* Gradient Background Effect */}
      <div className={`absolute inset-0 bg-gradient-to-br ${
        agent.status === 'online' 
          ? 'from-primary-50/50 via-purple-50/30 to-pink-50/20' 
          : 'from-gray-50/50 to-gray-100/30'
      } opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-0`} />
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4 overflow-hidden flex-1 min-w-0">
            {/* Avatar - 移除外框 */}
            <div className="relative flex-shrink-0">
              <img 
                src={normalizeImageUrl(agent.avatarUrl)} 
                alt={agent.name} 
                className="w-20 h-20 rounded-2xl object-cover object-[50%_20%] bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0 shadow-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80';
                }}
              />
              {agent.status === 'online' && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white shadow-lg animate-pulse" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-gray-900 truncate mb-2">{agent.name}</h3>
              {/* 优化布局：使用 flex-col 避免挤压 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold capitalize shadow-sm flex-shrink-0 ${
                  agent.gender === 'female' ? 'bg-gradient-to-r from-pink-100 to-rose-100 text-pink-700 border border-pink-200/50' : 
                  agent.gender === 'male' ? 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-200/50' : 
                  'bg-gray-100 text-gray-700 border border-gray-200/50'
                }`}>
                  {agent.gender}
                </span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium flex-shrink-0 ${
                  agent.status === 'online' ? 'text-green-600' : 'text-gray-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${agent.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                  {agent.status === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2 truncate font-medium">Model: {agent.modelName?.split('/').pop() || 'N/A'}</p>
            </div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button 
              onClick={() => navigate(`/edit/${agent._id}`)}
              className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all duration-200 group/edit"
              title="编辑"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button 
              onClick={handleDelete}
              className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
              title="删除"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        
        <p className="text-sm text-gray-600 line-clamp-2 min-h-[2.5rem] mb-4 leading-relaxed">
          {agent.description || 'No description provided.'}
        </p>
        
        {/* Status Toggle */}
        {onToggleStatus && (
          <div className="flex items-center justify-center gap-3 py-3 mb-4 bg-gray-50/80 rounded-xl border border-gray-200/50">
            <span className="text-sm font-medium text-gray-600">
              {agent.status === 'online' ? '上架中' : '已下架'}
            </span>
            <button 
              onClick={onToggleStatus}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 shadow-inner ${
                agent.status === 'online' 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-green-500/30' 
                  : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={agent.status === 'online'}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition-all duration-300 ease-in-out ${
                  agent.status === 'online' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}

        {/* Chat Button */}
        <button
          onClick={() => navigate(`/chat/${agent._id}`)}
          className="w-full flex justify-center items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600 hover:from-primary-700 hover:via-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Chat with {agent.name}
        </button>
      </div>
    </div>
  );
};

export default AgentCard;
