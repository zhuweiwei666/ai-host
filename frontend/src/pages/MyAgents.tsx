import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Undo as UndoIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  HourglassEmpty as PendingIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
} from '@mui/icons-material';
import {
  UserAgent,
  getMyAgents,
  deleteUserAgent,
  submitAgentForReview,
  withdrawAgentReview,
} from '../api';

const visibilityConfig: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning'; icon: React.ReactNode }> = {
  private: { label: '私有', color: 'default', icon: <VisibilityOffIcon fontSize="small" /> },
  pending: { label: '审核中', color: 'warning', icon: <PendingIcon fontSize="small" /> },
  public: { label: '已公开', color: 'success', icon: <ApprovedIcon fontSize="small" /> },
  rejected: { label: '已拒绝', color: 'error', icon: <RejectedIcon fontSize="small" /> },
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          我的角色
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/my-agents/create')}
        >
          创建角色
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Empty State */}
      {agents.length === 0 && (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            还没有创建任何角色
          </Typography>
          <Typography color="text.secondary" mb={2}>
            点击上方按钮创建你的第一个 AI 角色
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/my-agents/create')}
          >
            创建角色
          </Button>
        </Card>
      )}

      {/* Agent Grid */}
      <Grid container spacing={3}>
        {agents.map(agent => {
          const config = visibilityConfig[agent.visibility] || visibilityConfig.private;
          const isLoading = actionLoading === agent._id;

          return (
            <Grid item xs={12} sm={6} md={4} key={agent._id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Avatar */}
                <CardMedia
                  component="img"
                  height="200"
                  image={agent.avatarUrls?.[0] || 'https://via.placeholder.com/300x200?text=No+Image'}
                  alt={agent.name}
                  sx={{ objectFit: 'cover' }}
                />

                <CardContent sx={{ flexGrow: 1 }}>
                  {/* Name & Status */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6" noWrap sx={{ maxWidth: '60%' }}>
                      {agent.name}
                    </Typography>
                    <Chip
                      icon={config.icon as React.ReactElement}
                      label={config.label}
                      color={config.color}
                      size="small"
                    />
                  </Box>

                  {/* Description */}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      minHeight: '40px',
                    }}
                  >
                    {agent.description || '暂无描述'}
                  </Typography>

                  {/* Reject Reason */}
                  {agent.visibility === 'rejected' && agent.reviewStatus?.rejectReason && (
                    <Alert severity="error" sx={{ mt: 1, py: 0 }}>
                      <Typography variant="caption">
                        拒绝原因：{agent.reviewStatus.rejectReason}
                      </Typography>
                    </Alert>
                  )}

                  {/* Stats */}
                  {agent.visibility === 'public' && agent.stats && (
                    <Stack direction="row" spacing={2} mt={1}>
                      <Typography variant="caption" color="text.secondary">
                        对话: {agent.stats.totalChats}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        用户: {agent.stats.uniqueUsers}
                      </Typography>
                    </Stack>
                  )}
                </CardContent>

                {/* Actions */}
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Box>
                    <Tooltip title="编辑">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/my-agents/edit/${agent._id}`)}
                        disabled={agent.visibility === 'pending' || isLoading}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setSelectedAgent(agent);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={isLoading}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Review Actions */}
                  {(agent.visibility === 'private' || agent.visibility === 'rejected') && (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={isLoading ? <CircularProgress size={16} /> : <SendIcon />}
                      onClick={() => handleSubmitReview(agent)}
                      disabled={isLoading}
                    >
                      提交审核
                    </Button>
                  )}

                  {agent.visibility === 'pending' && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={isLoading ? <CircularProgress size={16} /> : <UndoIcon />}
                      onClick={() => handleWithdrawReview(agent)}
                      disabled={isLoading}
                    >
                      撤回审核
                    </Button>
                  )}

                  {agent.visibility === 'public' && (
                    <Chip
                      icon={<VisibilityIcon />}
                      label="已上架"
                      color="success"
                      size="small"
                    />
                  )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除角色 <strong>{selectedAgent?.name}</strong> 吗？此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={actionLoading === selectedAgent?._id}
          >
            {actionLoading === selectedAgent?._id ? <CircularProgress size={20} /> : '删除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
