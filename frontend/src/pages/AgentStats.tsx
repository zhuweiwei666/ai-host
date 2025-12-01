import React, { useEffect, useState } from 'react';
import { http } from '../api';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

interface AgentStat {
  agentId: string;
  name: string;
  modelName: string;
  avatarUrl: string;
  
  // Usage
  messageCount: number;
  llmTokens: number;
  ttsChars: number;
  imageCount: number;
  
  // Financials
  revenueCoins: number;
  revenueUSD: number;
  
  // Costs
  totalCost: number;
  llmCost: number;
  ttsCost: number;
  imageCost: number;
  videoCost: number;
  
  // Metrics
  profitUSD: number;
  roi: number;
}

type SortField = 'roi' | 'totalCost' | 'llmTokens' | 'profitUSD';
type SortOrder = 'asc' | 'desc';
type TimeRange = '24h' | '7d' | '30d' | 'all' | 'custom';

const AgentStats: React.FC = () => {
  const [stats, setStats] = useState<AgentStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('roi');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  useEffect(() => {
    if (timeRange !== 'custom') {
        fetchStats();
    } else if (customStartDate && customEndDate) {
        fetchStats();
    }
  }, [timeRange, customStartDate, customEndDate]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Calculate Dates
      const now = new Date();
      let startDate = '';
      let endDate = '';

      if (timeRange === '24h') {
        now.setHours(now.getHours() - 24);
        startDate = now.toISOString();
      } else if (timeRange === '7d') {
        now.setDate(now.getDate() - 7);
        startDate = now.toISOString();
      } else if (timeRange === '30d') {
        now.setDate(now.getDate() - 30);
        startDate = now.toISOString();
      } else if (timeRange === 'custom') {
        if (customStartDate) startDate = customStartDate.toISOString();
        if (customEndDate) {
            // Set end date to end of day if user picks a date
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            endDate = end.toISOString();
        }
      }
      
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const res = await http.get(`/stats/agents?${params.toString()}`);
      setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch stats', error);
      // Don't alert on initial load if custom is empty
      if (timeRange !== 'custom' || (customStartDate && customEndDate)) {
          alert('Failed to load statistics');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sorting Logic
  const sortedStats = [...stats].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    return sortOrder === 'asc' ? valA - valB : valB - valA;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to desc for new field (usually higher is better/more interesting)
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="ml-1 text-gray-300">⇅</span>;
    return <span className="ml-1 text-indigo-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ROI & Stats Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Detailed financial breakdown per AI Agent (Revenue vs Cost).</p>
        </div>
        
        <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="flex items-center gap-2">
                <div className="inline-flex bg-white border border-gray-300 rounded-lg shadow-sm p-1">
                    {(['24h', '7d', '30d', 'all', 'custom'] as TimeRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                timeRange === range 
                                    ? 'bg-indigo-100 text-indigo-700 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                        >
                            {range === '24h' ? '24H' : range === '7d' ? '7D' : range === '30d' ? '30D' : range === 'custom' ? 'Custom' : 'All'}
                        </button>
                    ))}
                </div>
                
                {timeRange === 'custom' && (
                    <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg p-1 shadow-sm">
                        {/* @ts-ignore */}
                        <DatePicker
                            selected={customStartDate}
                            onChange={(date: any) => setCustomStartDate(date)}
                            selectsStart
                            startDate={customStartDate || undefined}
                            endDate={customEndDate || undefined}
                            placeholderText="Start Date"
                            className="text-sm border-none focus:ring-0 p-1 text-gray-600 w-24 text-center cursor-pointer"
                        />
                        <span className="text-gray-400">-</span>
                        {/* @ts-ignore */}
                        <DatePicker
                            selected={customEndDate}
                            onChange={(date: any) => setCustomEndDate(date)}
                            selectsEnd
                            startDate={customStartDate || undefined}
                            endDate={customEndDate || undefined}
                            minDate={customStartDate || undefined}
                            placeholderText="End Date"
                            className="text-sm border-none focus:ring-0 p-1 text-gray-600 w-24 text-center cursor-pointer"
                        />
                    </div>
                )}
            </div>

            <button 
            onClick={fetchStats}
            className="p-2 text-gray-500 hover:text-gray-700 bg-white border border-gray-300 rounded-full shadow-sm hover:bg-gray-50"
            title="Refresh"
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Msgs</th>
                <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => handleSort('llmTokens')}
                >
                    Usage Breakdown <SortIcon field="llmTokens" />
                </th>
                <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => handleSort('totalCost')}
                >
                    Est. Cost (USD) <SortIcon field="totalCost" />
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue (USD)</th>
                <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => handleSort('profitUSD')}
                >
                    Profit (USD) <SortIcon field="profitUSD" />
                </th>
                <th 
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => handleSort('roi')}
                >
                    ROI <SortIcon field="roi" />
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center">Loading...</td></tr>
              ) : sortedStats.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No data available for this period.</td></tr>
              ) : (
                sortedStats.map((agent) => (
                  <tr key={agent.agentId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <img className="h-10 w-10 rounded-full object-cover bg-gray-200" src={agent.avatarUrl || 'https://via.placeholder.com/40'} alt="" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                          <div className="text-xs text-gray-500">{agent.modelName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                      {agent.messageCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-gray-500">
                      <div className="flex flex-col items-end space-y-1">
                        <span>📝 {(agent.llmTokens / 1000).toFixed(1)}k Tok</span>
                        <span>🗣️ {(agent.ttsChars / 1000).toFixed(1)}k Chars</span>
                        <span>🖼️ {agent.imageCount} Imgs</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="font-medium text-gray-900">${agent.totalCost.toFixed(4)}</div>
                      <div className="text-xs text-gray-400 flex flex-col items-end">
                        <span>L: ${agent.llmCost.toFixed(3)}</span>
                        <span>T: ${agent.ttsCost.toFixed(3)}</span>
                        <span>I: ${agent.imageCost.toFixed(3)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                      ${agent.revenueUSD.toFixed(2)}
                      <span className="block text-xs text-gray-400">({agent.revenueCoins} Coins)</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold">
                        <span className={agent.profitUSD >= 0 ? 'text-green-600' : 'text-red-500'}>
                            ${agent.profitUSD.toFixed(2)}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          agent.roi > 100 ? 'bg-green-100 text-green-800' : 
                          agent.roi > 0 ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'
                      }`}>
                        {agent.roi.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AgentStats;