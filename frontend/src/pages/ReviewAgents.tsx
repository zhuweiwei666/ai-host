import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Button,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  IconButton,
  Tooltip,
  Stack,
  Badge,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  ReviewAgent,
  getPendingReviewAgents,
  getAllUserAgents,
  approveAgent,
  rejectAgent,
} from '../api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

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

  const getVisibilityChip = (visibility: string) => {
    const config: Record<string, { label: string; color: 'default' | 'warning' | 'success' | 'error' }> = {
      private: { label: '私有', color: 'default' },
      pending: { label: '待审核', color: 'warning' },
      public: { label: '已公开', color: 'success' },
      rejected: { label: '已拒绝', color: 'error' },
    };
    const c = config[visibility] || config.private;
    return <Chip label={c.label} color={c.color} size="small" />;
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          角色审核管理
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={() => tabValue === 0 ? fetchPending() : fetchAll()}
        >
          刷新
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="warning.main">{stats.pending}</Typography>
              <Typography variant="body2" color="text.secondary">待审核</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="success.main">{stats.public}</Typography>
              <Typography variant="body2" color="text.secondary">已通过</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="error.main">{stats.rejected}</Typography>
              <Typography variant="body2" color="text.secondary">已拒绝</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4">{stats.private}</Typography>
              <Typography variant="body2" color="text.secondary">私有</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab
            label={
              <Badge badgeContent={stats.pending} color="warning">
                <Box pr={2}>待审核</Box>
              </Badge>
            }
          />
          <Tab label="全部角色" />
        </Tabs>

        {/* Pending Tab */}
        <TabPanel value={tabValue} index={0}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : pendingAgents.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography color="text.secondary">暂无待审核的角色</Typography>
            </Box>
          ) : (
            <Grid container spacing={3} sx={{ p: 2 }}>
              {pendingAgents.map(agent => (
                <Grid item xs={12} sm={6} md={4} key={agent._id}>
                  <Card>
                    <CardMedia
                      component="img"
                      height="180"
                      image={agent.avatarUrls?.[0] || 'https://via.placeholder.com/300x180?text=No+Image'}
                      alt={agent.name}
                      sx={{ objectFit: 'cover' }}
                    />
                    <CardContent>
                      <Typography variant="h6" noWrap>{agent.name}</Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        创建者: {agent.creatorId?.username || '未知'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        提交时间: {formatDate(agent.reviewStatus?.submittedAt)}
                      </Typography>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'space-between' }}>
                      <IconButton onClick={() => openDetailDialog(agent)}>
                        <ViewIcon />
                      </IconButton>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={actionLoading === agent._id ? <CircularProgress size={16} /> : <RejectIcon />}
                          onClick={() => openRejectDialog(agent)}
                          disabled={actionLoading === agent._id}
                        >
                          拒绝
                        </Button>
                        <Button
                          size="small"
                          color="success"
                          variant="contained"
                          startIcon={actionLoading === agent._id ? <CircularProgress size={16} /> : <ApproveIcon />}
                          onClick={() => handleApprove(agent)}
                          disabled={actionLoading === agent._id}
                        >
                          通过
                        </Button>
                      </Stack>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        {/* All Tab */}
        <TabPanel value={tabValue} index={1}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>角色</TableCell>
                    <TableCell>创建者</TableCell>
                    <TableCell>状态</TableCell>
                    <TableCell>创建时间</TableCell>
                    <TableCell>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allAgents.map(agent => (
                    <TableRow key={agent._id}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar src={agent.avatarUrls?.[0]} />
                          <Box>
                            <Typography variant="body2">{agent.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {agent.gender === 'female' ? '女' : agent.gender === 'male' ? '男' : '其他'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{agent.creatorId?.username || '-'}</TableCell>
                      <TableCell>{getVisibilityChip(agent.visibility)}</TableCell>
                      <TableCell>{formatDate(agent.createdAt)}</TableCell>
                      <TableCell>
                        <Tooltip title="查看详情">
                          <IconButton size="small" onClick={() => openDetailDialog(agent)}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>拒绝角色</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            确定要拒绝角色 <strong>{selectedAgent?.name}</strong> 吗？
          </Typography>
          <TextField
            fullWidth
            label="拒绝原因"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            multiline
            rows={3}
            required
            helperText="请填写拒绝原因，创建者将看到此信息"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>取消</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleReject}
            disabled={!rejectReason.trim() || actionLoading === selectedAgent?._id}
          >
            {actionLoading === selectedAgent?._id ? <CircularProgress size={20} /> : '确认拒绝'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>角色详情</DialogTitle>
        <DialogContent>
          {selectedAgent && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <img
                  src={selectedAgent.avatarUrls?.[0] || 'https://via.placeholder.com/300'}
                  alt={selectedAgent.name}
                  style={{ width: '100%', borderRadius: 8 }}
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <Typography variant="h5" gutterBottom>{selectedAgent.name}</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  性别: {selectedAgent.gender === 'female' ? '女' : selectedAgent.gender === 'male' ? '男' : '其他'} | 
                  风格: {selectedAgent.style === 'anime' ? '动漫' : '写实'}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>描述:</strong> {selectedAgent.description || '无'}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>开场白:</strong> {selectedAgent.defaultGreeting || '无'}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>角色设定:</strong>
                </Typography>
                <Paper variant="outlined" sx={{ p: 1, maxHeight: 200, overflow: 'auto' }}>
                  <Typography variant="body2" whiteSpace="pre-wrap">
                    {selectedAgent.systemPrompt || '无'}
                  </Typography>
                </Paper>
                <Box mt={2}>
                  <Typography variant="caption" color="text.secondary">
                    创建者: {selectedAgent.creatorId?.username || '未知'}<br />
                    创建时间: {formatDate(selectedAgent.createdAt)}<br />
                    状态: {getVisibilityChip(selectedAgent.visibility)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
