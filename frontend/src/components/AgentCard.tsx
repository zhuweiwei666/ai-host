import React from 'react';
import { Agent, deleteAgent } from '../api';
import { useNavigate } from 'react-router-dom';

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
    <div className={`bg-white shadow rounded-lg p-6 flex flex-col gap-4 transition-all hover:shadow-md relative border ${agent.status === 'offline' ? 'border-gray-200 opacity-80' : 'border-transparent'}`}>
      
      {/* Status Badge (Top Right) */}
      {/* Removed badge in favor of central toggle as requested, but keeping status indicator is good practice. */}
      {/* Actually user asked for toggle in the CENTER. Let's put it in the action bar or overlay. */}
      
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4 overflow-hidden">
          <img 
            src={agent.avatarUrl || 'https://via.placeholder.com/64'} 
            alt={agent.name} 
            className="w-16 h-16 rounded-full object-cover object-[50%_20%] bg-gray-100 flex-shrink-0 border border-gray-200"
          />
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-900 truncate">{agent.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                agent.gender === 'female' ? 'bg-pink-100 text-pink-800' : 
                agent.gender === 'male' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
              }`}>
              {agent.gender}
            </span>
              {/* Status Text */}
              <span className={`text-xs ${agent.status === 'online' ? 'text-green-600' : 'text-gray-400'}`}>
                {agent.status === 'online' ? '● Online' : '○ Offline'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 truncate">Model: {agent.modelName}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button 
            onClick={() => navigate(`/edit/${agent._id}`)}
            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
          >
            Edit
          </button>
          <button 
            onClick={handleDelete}
            className="text-red-600 hover:text-red-900 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 line-clamp-2 h-10">{agent.description || 'No description provided.'}</p>
      
      {/* Central Status Toggle */}
      {onToggleStatus && (
        <div className="flex justify-center py-2">
          <button 
                onClick={onToggleStatus}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                    agent.status === 'online' ? 'bg-green-500' : 'bg-gray-200'
                }`}
                role="switch"
                aria-checked={agent.status === 'online'}
                title={agent.status === 'online' ? 'Click to Take Offline' : 'Click to Go Online'}
            >
                <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        agent.status === 'online' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
          </button>
            <span className="ml-3 text-sm text-gray-500 cursor-pointer" onClick={onToggleStatus}>
                {agent.status === 'online' ? '上架中' : '已下架'}
            </span>
          </div>
        )}

      <div className="mt-auto border-t pt-4">
        <button
          onClick={() => navigate(`/chat/${agent._id}`)}
          className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Chat with {agent.name}
        </button>
      </div>
    </div>
  );
};

export default AgentCard;
