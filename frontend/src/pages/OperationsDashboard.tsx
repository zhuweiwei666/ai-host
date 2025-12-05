import { useState, useEffect } from 'react';
import {
  getDashboardOverview,
  getAlertStats,
  getAlerts,
  acknowledgeAlertsBatch,
  resolveAlert,
  ignoreAlert,
  getAlertRules,
  toggleAlertRule,
  runAlertCheck,
  initDefaultAlertRules,
  getABExperiments,
  startABExperiment,
  endABExperiment,
  getRecallCandidates,
  executeRecall,
  getRecallEffectiveness,
  getUserSegmentation,
  getAvailableTasks,
  runTask,
  Alert,
  AlertRule,
  ABExperiment,
  RecallCandidate,
} from '../api';

type TabType = 'overview' | 'alerts' | 'ab-test' | 'recall' | 'users' | 'tasks';

export default function OperationsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(false);

  // Overview data
  const [overview, setOverview] = useState<{
    totalAgents: number;
    activeAgents: number;
    totalUsers: number;
    activeUsersToday: number;
    totalRevenue: number;
    revenueToday: number;
  } | null>(null);

  // Alert data
  const [alertStats, setAlertStats] = useState<{ total: number; bySeverity: Record<string, number>; byType: Record<string, number> } | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertFilter, setAlertFilter] = useState<{ status?: string; severity?: string }>({ status: 'active' });

  // A/B Test data
  const [experiments, setExperiments] = useState<ABExperiment[]>([]);

  // Recall data
  const [recallCandidates, setRecallCandidates] = useState<RecallCandidate[]>([]);
  const [recallEffectiveness, setRecallEffectiveness] = useState<{ totalSent: number; returned: number; returnRate: number } | null>(null);

  // User segmentation
  const [userSegmentation, setUserSegmentation] = useState<{ byLTV: Record<string, number>; byActivity: Record<string, number>; byChurnRisk: Record<string, number>; total: number } | null>(null);

  // Tasks
  const [tasks, setTasks] = useState<{ name: string; description: string }[]>([]);
  const [taskRunning, setTaskRunning] = useState<string | null>(null);

  // Fetch data based on active tab
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        switch (activeTab) {
          case 'overview':
            const overviewRes = await getDashboardOverview();
            setOverview(overviewRes.data.overview);
            break;
          case 'alerts':
            const [statsRes, alertsRes, rulesRes] = await Promise.all([
              getAlertStats(),
              getAlerts({ limit: 50, ...alertFilter }),
              getAlertRules(),
            ]);
            setAlertStats(statsRes.data);
            setAlerts(alertsRes.data.alerts);
            setAlertRules(rulesRes.data.rules);
            break;
          case 'ab-test':
            const expRes = await getABExperiments();
            setExperiments(expRes.data.experiments);
            break;
          case 'recall':
            const [candidatesRes, effectivenessRes] = await Promise.all([
              getRecallCandidates({ limit: 50 }),
              getRecallEffectiveness(7),
            ]);
            setRecallCandidates(candidatesRes.data.candidates);
            setRecallEffectiveness(effectivenessRes.data);
            break;
          case 'users':
            const segRes = await getUserSegmentation();
            setUserSegmentation(segRes.data);
            break;
          case 'tasks':
            const tasksRes = await getAvailableTasks();
            setTasks(tasksRes.data.tasks);
            break;
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTab, alertFilter]);

  // Alert actions
  const handleAcknowledgeAlerts = async (alertIds: string[]) => {
    try {
      await acknowledgeAlertsBatch(alertIds);
      setAlerts(alerts.map(a => alertIds.includes(a._id) ? { ...a, status: 'acknowledged' } : a));
    } catch (err) {
      console.error('Failed to acknowledge alerts:', err);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await resolveAlert(alertId);
      setAlerts(alerts.map(a => a._id === alertId ? { ...a, status: 'resolved' } : a));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  const handleIgnoreAlert = async (alertId: string) => {
    try {
      await ignoreAlert(alertId);
      setAlerts(alerts.map(a => a._id === alertId ? { ...a, status: 'ignored' } : a));
    } catch (err) {
      console.error('Failed to ignore alert:', err);
    }
  };

  const handleToggleRule = async (ruleId: string) => {
    try {
      const res = await toggleAlertRule(ruleId);
      setAlertRules(alertRules.map(r => r._id === ruleId ? { ...r, enabled: res.data.enabled } : r));
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleRunAlertCheck = async () => {
    try {
      setLoading(true);
      const res = await runAlertCheck();
      alert(`告警检测完成：新增 ${res.data.alertsCreated}，更新 ${res.data.alertsUpdated}`);
      // Refresh alerts
      const alertsRes = await getAlerts({ limit: 50, ...alertFilter });
      setAlerts(alertsRes.data.alerts);
      const statsRes = await getAlertStats();
      setAlertStats(statsRes.data);
    } catch (err) {
      console.error('Failed to run alert check:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInitDefaultRules = async () => {
    try {
      const res = await initDefaultAlertRules();
      alert(res.data.message);
      const rulesRes = await getAlertRules();
      setAlertRules(rulesRes.data.rules);
    } catch (err) {
      console.error('Failed to init default rules:', err);
    }
  };

  // A/B Test actions
  const handleStartExperiment = async (experimentId: string) => {
    try {
      await startABExperiment(experimentId);
      setExperiments(experiments.map(e => e._id === experimentId ? { ...e, status: 'running' } : e));
    } catch (err) {
      console.error('Failed to start experiment:', err);
    }
  };

  const handleEndExperiment = async (experimentId: string, apply: boolean) => {
    try {
      await endABExperiment(experimentId, apply);
      const expRes = await getABExperiments();
      setExperiments(expRes.data.experiments);
    } catch (err) {
      console.error('Failed to end experiment:', err);
    }
  };

  // Recall actions
  const handleExecuteRecall = async () => {
    try {
      setLoading(true);
      const res = await executeRecall(50);
      alert(`召回完成：发送 ${res.data.sent}，跳过 ${res.data.skipped}`);
    } catch (err) {
      console.error('Failed to execute recall:', err);
    } finally {
      setLoading(false);
    }
  };

  // Task actions
  const handleRunTask = async (taskName: string) => {
    try {
      setTaskRunning(taskName);
      const res = await runTask(taskName);
      alert(`任务 ${taskName} 完成：${JSON.stringify(res.data.result)}`);
    } catch (err) {
      console.error('Failed to run task:', err);
      alert(`任务失败: ${err}`);
    } finally {
      setTaskRunning(null);
    }
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: '概览', icon: '📊' },
    { id: 'alerts', label: '告警', icon: '🚨' },
    { id: 'ab-test', label: 'A/B测试', icon: '🔬' },
    { id: 'recall', label: '用户召回', icon: '📲' },
    { id: 'users', label: '用户分析', icon: '👥' },
    { id: 'tasks', label: '任务管理', icon: '⚙️' },
  ];

  const severityColors = {
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800',
  };

  const statusColors = {
    active: 'bg-red-500',
    acknowledged: 'bg-yellow-500',
    resolved: 'bg-green-500',
    ignored: 'bg-gray-500',
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">🎯 运营仪表盘</h1>
          <p className="text-gray-500 text-sm">AI 自进化系统监控中心</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && activeTab === 'overview' && overview && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-2xl font-bold text-blue-600">{overview.totalAgents}</div>
                <div className="text-sm text-gray-500">总主播数</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-2xl font-bold text-green-600">{overview.activeAgents}</div>
                <div className="text-sm text-gray-500">在线主播</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-2xl font-bold text-purple-600">{overview.totalUsers}</div>
                <div className="text-sm text-gray-500">总用户数</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-2xl font-bold text-orange-600">{overview.activeUsersToday}</div>
                <div className="text-sm text-gray-500">今日活跃</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-2xl font-bold text-yellow-600">{overview.totalRevenue}</div>
                <div className="text-sm text-gray-500">总收入(币)</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-2xl font-bold text-pink-600">{overview.revenueToday}</div>
                <div className="text-sm text-gray-500">今日收入</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">快速操作</h3>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => setActiveTab('alerts')}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                >
                  🚨 查看告警
                </button>
                <button 
                  onClick={() => setActiveTab('recall')}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                >
                  📲 用户召回
                </button>
                <button 
                  onClick={() => setActiveTab('ab-test')}
                  className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                >
                  🔬 A/B 测试
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'alerts' && (
          <div className="space-y-6">
            {/* Alert Stats */}
            {alertStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-3xl font-bold text-red-600">{alertStats.total}</div>
                  <div className="text-sm text-gray-500">活跃告警</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-3xl font-bold text-red-500">{alertStats.bySeverity.critical || 0}</div>
                  <div className="text-sm text-gray-500">严重</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-3xl font-bold text-yellow-500">{alertStats.bySeverity.warning || 0}</div>
                  <div className="text-sm text-gray-500">警告</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-3xl font-bold text-blue-500">{alertStats.bySeverity.info || 0}</div>
                  <div className="text-sm text-gray-500">通知</div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleRunAlertCheck}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                🔍 运行告警检测
              </button>
              <button
                onClick={handleInitDefaultRules}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                ⚙️ 初始化默认规则
              </button>
              <select
                value={alertFilter.status || ''}
                onChange={(e) => setAlertFilter({ ...alertFilter, status: e.target.value || undefined })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">所有状态</option>
                <option value="active">活跃</option>
                <option value="acknowledged">已确认</option>
                <option value="resolved">已解决</option>
              </select>
            </div>

            {/* Alert List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold">告警列表</h3>
              </div>
              <div className="divide-y">
                {alerts.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">暂无告警</div>
                ) : (
                  alerts.map(alert => (
                    <div key={alert._id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${statusColors[alert.status]}`}></div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${severityColors[alert.severity]}`}>
                                {alert.severity}
                              </span>
                              <span className="font-medium">{alert.title}</span>
                              {alert.duplicateCount > 1 && (
                                <span className="text-xs text-gray-500">×{alert.duplicateCount}</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(alert.createdAt).toLocaleString('zh-CN')}
                              {alert.agentId && ` · ${typeof alert.agentId === 'object' ? alert.agentId.name : alert.agentId}`}
                            </p>
                          </div>
                        </div>
                        {alert.status === 'active' && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleAcknowledgeAlerts([alert._id])}
                              className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                            >
                              确认
                            </button>
                            <button
                              onClick={() => handleResolveAlert(alert._id)}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              解决
                            </button>
                            <button
                              onClick={() => handleIgnoreAlert(alert._id)}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                              忽略
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Alert Rules */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold">告警规则</h3>
              </div>
              <div className="divide-y">
                {alertRules.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">暂无规则，请初始化默认规则</div>
                ) : (
                  alertRules.map(rule => (
                    <div key={rule._id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                          <span className="font-medium">{rule.name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${severityColors[rule.severity]}`}>
                            {rule.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
                      </div>
                      <button
                        onClick={() => handleToggleRule(rule._id)}
                        className={`px-3 py-1 rounded text-sm ${
                          rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {rule.enabled ? '已启用' : '已禁用'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'ab-test' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold">A/B 测试实验</h3>
              </div>
              <div className="divide-y">
                {experiments.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">暂无实验</div>
                ) : (
                  experiments.map(exp => (
                    <div key={exp._id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{exp.name}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              exp.status === 'running' ? 'bg-green-100 text-green-800' :
                              exp.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                              exp.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {exp.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            主播: {typeof exp.agentId === 'object' ? exp.agentId.name : exp.agentId}
                            {exp.variants && ` · ${exp.variants.length} 个变体`}
                          </p>
                          {exp.winner && (
                            <p className="text-sm text-green-600 mt-1">
                              🏆 赢家: {exp.variants.find(v => v.id === exp.winner)?.name || exp.winner}
                              {exp.confidenceLevel && ` (置信度: ${exp.confidenceLevel}%)`}
                            </p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          {exp.status === 'draft' && (
                            <button
                              onClick={() => handleStartExperiment(exp._id)}
                              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                            >
                              启动
                            </button>
                          )}
                          {exp.status === 'running' && (
                            <>
                              <button
                                onClick={() => handleEndExperiment(exp._id, false)}
                                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                              >
                                结束
                              </button>
                              <button
                                onClick={() => handleEndExperiment(exp._id, true)}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                              >
                                结束并应用赢家
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Variants */}
                      {exp.variants && exp.variants.length > 0 && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {exp.variants.map(v => (
                            <div key={v.id} className={`p-3 rounded-lg border ${v.id === exp.winner ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{v.name}</span>
                                {v.isControl && <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">对照组</span>}
                              </div>
                              <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                                <div><span className="text-gray-500">用户:</span> {v.metrics.totalUsers}</div>
                                <div><span className="text-gray-500">消息:</span> {v.metrics.messages}</div>
                                <div><span className="text-gray-500">送礼:</span> {v.metrics.gifts}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'recall' && (
          <div className="space-y-6">
            {/* Effectiveness Stats */}
            {recallEffectiveness && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-3xl font-bold text-blue-600">{recallEffectiveness.totalSent}</div>
                  <div className="text-sm text-gray-500">7天内发送</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-3xl font-bold text-green-600">{recallEffectiveness.returned}</div>
                  <div className="text-sm text-gray-500">成功回归</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-3xl font-bold text-purple-600">{recallEffectiveness.returnRate}%</div>
                  <div className="text-sm text-gray-500">回归率</div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={handleExecuteRecall}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                📲 执行批量召回
              </button>
            </div>

            {/* Candidates */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold">召回候选用户</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">用户ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">主播</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">不活跃天数</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">LTV</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">亲密度</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">召回类型</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">优先级</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recallCandidates.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{c.userId}</td>
                        <td className="px-4 py-3 text-sm">{c.agentId?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm">{c.aiAnalysis?.behavior?.daysSinceLastActive || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            c.aiAnalysis?.spending?.ltvTier === 'whale' ? 'bg-purple-100 text-purple-800' :
                            c.aiAnalysis?.spending?.ltvTier === 'dolphin' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {c.aiAnalysis?.spending?.ltvTier || 'free'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{c.intimacy}</td>
                        <td className="px-4 py-3 text-sm">{c.suggestedRecallType}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${c.recallPriority}%` }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'users' && (
          <div className="space-y-6">
            {userSegmentation ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* LTV 分布 */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <h3 className="font-semibold mb-4">💰 LTV 分布</h3>
                    <div className="space-y-2">
                      {Object.entries(userSegmentation.byLTV || {}).map(([tier, count]) => (
                        <div key={tier} className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            tier === 'whale' ? 'bg-purple-100 text-purple-800' :
                            tier === 'dolphin' ? 'bg-blue-100 text-blue-800' :
                            tier === 'minnow' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>{tier}</span>
                          <span className="font-medium">{count as number}</span>
                        </div>
                      ))}
                      {Object.keys(userSegmentation.byLTV || {}).length === 0 && (
                        <div className="text-gray-400 text-sm">暂无数据</div>
                      )}
                    </div>
                  </div>

                  {/* 活跃度分布 */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <h3 className="font-semibold mb-4">📊 活跃度分布</h3>
                    <div className="space-y-2">
                      {Object.entries(userSegmentation.byActivity || {}).map(([level, count]) => (
                        <div key={level} className="flex items-center justify-between">
                          <span>{level}</span>
                          <span className="font-medium">{count as number}</span>
                        </div>
                      ))}
                      {Object.keys(userSegmentation.byActivity || {}).length === 0 && (
                        <div className="text-gray-400 text-sm">暂无数据</div>
                      )}
                    </div>
                  </div>

                  {/* 流失风险分布 */}
                  <div className="bg-white rounded-lg shadow p-4">
                    <h3 className="font-semibold mb-4">⚠️ 流失风险</h3>
                    <div className="space-y-2">
                      {Object.entries(userSegmentation.byChurnRisk || {}).map(([risk, count]) => (
                        <div key={risk} className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            risk === 'high' ? 'bg-red-100 text-red-800' :
                            risk === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>{risk}</span>
                          <span className="font-medium">{count as number}</span>
                        </div>
                      ))}
                      {Object.keys(userSegmentation.byChurnRisk || {}).length === 0 && (
                        <div className="text-gray-400 text-sm">暂无数据</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-800">{userSegmentation.total || 0}</div>
                    <div className="text-gray-500">总用户数</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                暂无用户分析数据，请先运行用户分析任务
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'tasks' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold">后台任务</h3>
              <p className="text-sm text-gray-500">手动触发后台定时任务</p>
            </div>
            <div className="divide-y">
              {tasks.map(task => (
                <div key={task.name} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{task.name}</div>
                    <div className="text-sm text-gray-500">{task.description}</div>
                  </div>
                  <button
                    onClick={() => handleRunTask(task.name)}
                    disabled={taskRunning === task.name}
                    className={`px-4 py-2 rounded text-sm ${
                      taskRunning === task.name
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {taskRunning === task.name ? '运行中...' : '执行'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
