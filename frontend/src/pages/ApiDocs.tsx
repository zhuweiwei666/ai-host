import React, { useState } from 'react';

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  auth: 'Public' | 'Required' | 'Admin';
  params?: {
    query?: Record<string, string>;
    body?: Record<string, any>;
    path?: Record<string, string>;
  };
  response: any;
  example?: {
    request?: any;
    response?: any;
  };
}

const ApiDocs: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('users');
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  const baseUrl = 'http://139.162.62.115';

  const copyToClipboard = (text: string, endpoint: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(endpoint);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const apiEndpoints: Record<string, ApiEndpoint[]> = {
    users: [
      {
        method: 'POST',
        path: '/api/users/sync',
        description: '同步外部用户（Android/iOS专用）- 如果用户不存在则创建，存在则返回',
        auth: 'Public',
        params: {
          body: {
            externalUserId: 'string (必填) - 外部产品的用户ID',
            platform: 'string (必填) - android 或 ios',
            externalAppId: 'string (可选) - 外部应用ID',
            email: 'string (可选) - 邮箱',
            phone: 'string (可选) - 手机号',
            username: 'string (可选) - 用户名，不提供则自动生成'
          }
        },
        response: {
          user: {
            _id: '内部用户ID',
            externalUserId: '外部用户ID',
            username: '用户名',
            email: '邮箱',
            phone: '手机号',
            platform: '平台类型',
            userType: 'channel',
            role: 'user'
          },
          token: 'JWT认证token',
          balance: 0,
          isNew: true
        },
        example: {
          request: {
            externalUserId: 'android_user_12345',
            platform: 'android',
            externalAppId: 'com.example.app'
          },
          response: {
            user: {
              _id: '692be3f3b5220b3109bde535',
              externalUserId: 'android_user_12345',
              username: 'user_android_user_12345_android_1234567890',
              platform: 'android',
              userType: 'channel',
              role: 'user'
            },
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            balance: 0,
            isNew: true
          }
        }
      },
      {
        method: 'POST',
        path: '/api/users/register',
        description: '注册新渠道用户（Web平台专用）',
        auth: 'Public',
        params: {
          body: {
            username: 'string (必填) - 用户名',
            password: 'string (必填) - 密码（至少6个字符）',
            email: 'string (可选) - 邮箱',
            phone: 'string (可选) - 手机号',
            platform: 'string (可选) - 默认为 "web"'
          }
        },
        response: {
          user: { _id: 'string', username: 'string', email: 'string', ... },
          token: 'JWT token'
        }
      },
      {
        method: 'POST',
        path: '/api/users/login',
        description: '用户登录（支持Web用户名密码或Android/iOS外部ID）',
        auth: 'Public',
        params: {
          body: {
            username: 'string (可选) - 用户名（Web平台）',
            password: 'string (可选) - 密码（Web平台）',
            externalUserId: 'string (可选) - 外部用户ID（Android/iOS）',
            platform: 'string (可选) - android 或 ios'
          }
        },
        response: {
          user: { _id: 'string', username: 'string', ... },
          token: 'JWT token',
          balance: 0
        }
      },
      {
        method: 'GET',
        path: '/api/users',
        description: '获取用户列表（管理员权限）',
        auth: 'Admin',
        params: {
          query: {
            userType: 'string (可选) - operator 或 channel',
            platform: 'string (可选) - web, android, ios',
            isActive: 'boolean (可选) - 是否激活'
          }
        },
        response: [
          {
            _id: 'string',
            username: 'string',
            email: 'string',
            userType: 'operator' | 'channel',
            platform: 'string',
            balance: 0,
            ...
          }
        ]
      },
      {
        method: 'POST',
        path: '/api/users',
        description: '创建新用户（管理员权限）',
        auth: 'Admin',
        params: {
          body: {
            username: 'string (必填)',
            email: 'string (可选)',
            role: 'string (可选) - admin 或 user',
            userType: 'string (可选) - operator 或 channel',
            platform: 'string (可选)',
            phone: 'string (可选)',
            password: 'string (可选) - 渠道用户必填'
          }
        },
        response: { _id: 'string', username: 'string', ... }
      },
      {
        method: 'POST',
        path: '/api/users/:id/recharge',
        description: '充值用户钱包（管理员或自己）',
        auth: 'Required',
        params: {
          path: { id: 'string - 用户ID' },
          body: { amount: 'number (必填) - 充值金额' }
        },
        response: { success: true, balance: 0 }
      },
      {
        method: 'POST',
        path: '/api/users/init-admin',
        description: '初始化管理员用户（如果不存在）',
        auth: 'Public',
        response: { _id: 'string', username: 'admin', role: 'admin', ... }
      }
    ],
    agents: [
      {
        method: 'GET',
        path: '/api/agents',
        description: '获取AI主播列表（公开访问）',
        auth: 'Public',
        params: {
          query: {
            status: 'string (可选) - online 或 offline',
            style: 'string (可选) - realistic 或 anime'
          }
        },
        response: [
          {
            _id: 'string',
            name: 'string',
            gender: 'string',
            style: 'string',
            avatarUrl: 'string',
            description: 'string',
            modelName: 'string',
            status: 'online' | 'offline',
            ...
          }
        ]
      },
      {
        method: 'GET',
        path: '/api/agents/:id',
        description: '获取单个AI主播详情',
        auth: 'Public',
        params: {
          path: { id: 'string - 主播ID' }
        },
        response: { _id: 'string', name: 'string', ... }
      },
      {
        method: 'POST',
        path: '/api/agents',
        description: '创建新AI主播（管理员权限）',
        auth: 'Admin',
        params: {
          body: {
            name: 'string (必填)',
            gender: 'string (必填) - male, female, other',
            style: 'string (可选) - realistic 或 anime',
            description: 'string (可选)',
            modelName: 'string (可选)',
            avatarUrl: 'string (可选)',
            ...
          }
        },
        response: { _id: 'string', name: 'string', ... }
      },
      {
        method: 'PUT',
        path: '/api/agents/:id',
        description: '更新AI主播（管理员权限）',
        auth: 'Admin',
        params: {
          path: { id: 'string - 主播ID' },
          body: { name: 'string', ... }
        },
        response: { _id: 'string', name: 'string', ... }
      },
      {
        method: 'DELETE',
        path: '/api/agents/:id',
        description: '删除AI主播（管理员权限）',
        auth: 'Admin',
        params: {
          path: { id: 'string - 主播ID' }
        },
        response: { message: 'Agent deleted' }
      },
      {
        method: 'POST',
        path: '/api/agents/scrape',
        description: '爬取AI主播数据（管理员权限）',
        auth: 'Admin',
        response: { message: 'Scraping started in background...' }
      }
    ],
    chat: [
      {
        method: 'GET',
        path: '/api/chat/history/:agentId',
        description: '获取与指定AI主播的聊天历史',
        auth: 'Required',
        params: {
          path: { agentId: 'string - 主播ID' }
        },
        response: [
          {
            _id: 'string',
            role: 'user' | 'assistant',
            content: 'string',
            createdAt: 'string',
            audioUrl: 'string (可选)'
          }
        ]
      },
      {
        method: 'POST',
        path: '/api/chat',
        description: '发送聊天消息',
        auth: 'Required',
        params: {
          body: {
            agentId: 'string (必填) - 主播ID',
            prompt: 'string (必填) - 用户消息',
            history: 'array (可选) - 历史消息',
            skipImageGen: 'boolean (可选) - 跳过图片生成'
          }
        },
        response: {
          content: 'string - AI回复内容',
          imageUrl: 'string (可选) - 如果触发图片生成',
          balance: 0,
          intimacy: 0
        }
      },
      {
        method: 'POST',
        path: '/api/chat/tts',
        description: '生成语音（TTS）',
        auth: 'Required',
        params: {
          body: {
            agentId: 'string (必填) - 主播ID',
            text: 'string (必填) - 要转换的文本'
          }
        },
        response: {
          audioUrl: 'string - 音频URL',
          balance: 0
        }
      }
    ],
    image: [
      {
        method: 'POST',
        path: '/api/generate-image',
        description: '生成图片',
        auth: 'Required',
        params: {
          body: {
            description: 'string (必填) - 图片描述',
            count: 'number (可选) - 生成数量，默认1',
            width: 'number (可选) - 图片宽度',
            height: 'number (可选) - 图片高度',
            provider: 'string (可选) - fal 或 volcengine',
            agentId: 'string (可选) - 关联的主播ID',
            useAvatar: 'boolean (可选) - 是否使用主播头像',
            useImg2Img: 'boolean (可选) - 是否使用图片到图片'
          }
        },
        response: {
          images: ['string - 图片URL数组'],
          balance: 0
        }
      }
    ],
    video: [
      {
        method: 'POST',
        path: '/api/generate-video',
        description: '生成视频',
        auth: 'Required',
        params: {
          body: {
            prompt: 'string (必填) - 视频描述',
            agentId: 'string (可选) - 关联的主播ID'
          }
        },
        response: {
          videoUrl: 'string - 视频URL',
          balance: 0
        }
      }
    ],
    wallet: [
      {
        method: 'GET',
        path: '/api/wallet/balance',
        description: '获取钱包余额',
        auth: 'Required',
        response: { balance: 0 }
      },
      {
        method: 'POST',
        path: '/api/wallet/reward/ad',
        description: '观看广告奖励',
        auth: 'Required',
        params: {
          body: {
            traceId: 'string (必填) - 追踪ID，防止重复奖励'
          }
        },
        response: {
          success: true,
          balance: 0,
          message: 'Ad reward received! +50 Coins'
        }
      }
    ],
    oss: [
      {
        method: 'GET',
        path: '/api/oss/sts',
        description: '获取OSS临时上传凭证',
        auth: 'Public',
        response: {
          accessKeyId: 'string',
          accessKeySecret: 'string',
          securityToken: 'string',
          expiration: 'string',
          bucket: 'string',
          region: 'string',
          endpoint: 'string',
          basePath: 'string'
        }
      }
    ],
    voice: [
      {
        method: 'POST',
        path: '/api/voice-models/sync',
        description: '同步语音模型（从Fish Audio）',
        auth: 'Public',
        params: {
          query: {
            limit: 'number (可选) - 同步数量限制',
            pageSize: 'number (可选) - 每页大小',
            sortBy: 'string (可选) - 排序方式'
          }
        },
        response: {
          fetched: 0,
          upserted: 0,
          remoteTotal: 0
        }
      },
      {
        method: 'GET',
        path: '/api/voice-models',
        description: '获取语音模型列表',
        auth: 'Public',
        response: [
          {
            _id: 'string',
            remoteId: 'string',
            title: 'string',
            description: 'string',
            ...
          }
        ]
      },
      {
        method: 'POST',
        path: '/api/voice-models/extract',
        description: '从视频提取语音模型',
        auth: 'Public',
        params: {
          body: {
            videoUrl: 'string (必填) - 视频URL',
            name: 'string (必填) - 模型名称'
          }
        },
        response: { _id: 'string', ... }
      },
      {
        method: 'POST',
        path: '/api/voice-models/create',
        description: '创建语音模型',
        auth: 'Public',
        params: {
          body: {
            remoteId: 'string (必填)',
            title: 'string (必填)',
            ...
          }
        },
        response: { _id: 'string', ... }
      },
      {
        method: 'POST',
        path: '/api/voice-models/:id/preview',
        description: '预览语音模型',
        auth: 'Public',
        params: {
          path: { id: 'string - 模型ID' },
          body: { text: 'string (必填) - 预览文本' }
        },
        response: { audioUrl: 'string' }
      },
      {
        method: 'DELETE',
        path: '/api/voice-models/:id',
        description: '删除语音模型',
        auth: 'Public',
        params: {
          path: { id: 'string - 模型ID' }
        },
        response: { message: 'Voice model deleted' }
      },
      {
        method: 'DELETE',
        path: '/api/voice-models/batch',
        description: '批量删除语音模型',
        auth: 'Public',
        params: {
          body: { ids: ['string'] }
        },
        response: { deleted: 0 }
      },
      {
        method: 'PATCH',
        path: '/api/voice-models/:id/favorite',
        description: '收藏/取消收藏语音模型',
        auth: 'Public',
        params: {
          path: { id: 'string - 模型ID' },
          body: { isFavorite: 'boolean' }
        },
        response: { _id: 'string', isFavorite: true }
      },
      {
        method: 'PATCH',
        path: '/api/voice-models/:id',
        description: '更新语音模型',
        auth: 'Public',
        params: {
          path: { id: 'string - 模型ID' },
          body: { title: 'string', ... }
        },
        response: { _id: 'string', ... }
      }
    ],
    stats: [
      {
        method: 'GET',
        path: '/api/stats/agents',
        description: '获取AI主播统计数据（管理员权限）',
        auth: 'Admin',
        params: {
          query: {
            startDate: 'string (可选) - 开始日期',
            endDate: 'string (可选) - 结束日期'
          }
        },
        response: [
          {
            agentId: 'string',
            agentName: 'string',
            totalCost: 0,
            totalRevenue: 0,
            netProfit: 0,
            llmCost: 0,
            ttsCost: 0,
            imageCost: 0,
            videoCost: 0,
            ...
          }
        ]
      }
    ]
  };

  const categories = [
    { id: 'users', name: '用户管理', icon: '👥' },
    { id: 'agents', name: 'AI主播', icon: '🤖' },
    { id: 'chat', name: '聊天', icon: '💬' },
    { id: 'image', name: '图片生成', icon: '🖼️' },
    { id: 'video', name: '视频生成', icon: '🎬' },
    { id: 'wallet', name: '钱包', icon: '💰' },
    { id: 'oss', name: 'OSS存储', icon: '☁️' },
    { id: 'voice', name: '语音模型', icon: '🎤' },
    { id: 'stats', name: '数据统计', icon: '📊' }
  ];

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-blue-100 text-blue-700 border-blue-300',
      POST: 'bg-green-100 text-green-700 border-green-300',
      PUT: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      DELETE: 'bg-red-100 text-red-700 border-red-300',
      PATCH: 'bg-purple-100 text-purple-700 border-purple-300'
    };
    return colors[method] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const getAuthBadge = (auth: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      Public: { text: '公开', color: 'bg-green-100 text-green-700' },
      Required: { text: '需认证', color: 'bg-blue-100 text-blue-700' },
      Admin: { text: '管理员', color: 'bg-purple-100 text-purple-700' }
    };
    const badge = badges[auth] || badges.Required;
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold gradient-text mb-2">API 接口文档</h1>
        <p className="text-base text-gray-600 font-medium">完整的API接口说明和调用示例</p>
      </div>

      <div className="flex gap-6">
        {/* 侧边栏分类 */}
        <div className="w-64 flex-shrink-0">
          <div className="glass rounded-xl p-4 border border-white/50 shadow-soft sticky top-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">接口分类</h2>
            <div className="space-y-1">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeCategory === category.id
                      ? 'bg-gradient-to-r from-primary-500 to-purple-600 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-white/50'
                  }`}
                >
                  <span>{category.icon}</span>
                  <span>{category.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1">
          <div className="space-y-6">
            {apiEndpoints[activeCategory]?.map((endpoint, index) => {
              const fullPath = `${baseUrl}${endpoint.path}`;
              const curlExample = endpoint.method === 'GET'
                ? `curl -X ${endpoint.method} "${fullPath}${endpoint.params?.query ? '?' + Object.keys(endpoint.params.query).map(k => `${k}=value`).join('&') : ''}"${endpoint.auth !== 'Public' ? ' \\\n  -H "Authorization: Bearer YOUR_TOKEN"' : ''}`
                : `curl -X ${endpoint.method} "${fullPath}"${endpoint.auth !== 'Public' ? ' \\\n  -H "Authorization: Bearer YOUR_TOKEN"' : ''} \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(endpoint.example?.request || {}, null, 2)}'`;

              return (
                <div key={index} className="glass rounded-xl p-6 border border-white/50 shadow-soft">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${getMethodColor(endpoint.method)}`}>
                          {endpoint.method}
                        </span>
                        <code className="text-lg font-mono text-gray-900 font-semibold">{endpoint.path}</code>
                        {getAuthBadge(endpoint.auth)}
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{endpoint.description}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(fullPath, `${endpoint.method} ${endpoint.path}`)}
                      className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                      title="复制路径"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                    </button>
                  </div>

                  {/* 参数说明 */}
                  {endpoint.params && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">参数说明</h3>
                      <div className="space-y-2">
                        {endpoint.params.path && (
                          <div>
                            <span className="text-xs font-semibold text-gray-500">路径参数:</span>
                            <div className="mt-1 space-y-1">
                              {Object.entries(endpoint.params.path).map(([key, value]) => (
                                <div key={key} className="text-xs text-gray-600 ml-4">
                                  <code className="text-primary-600">{key}</code>: {value}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {endpoint.params.query && (
                          <div>
                            <span className="text-xs font-semibold text-gray-500">查询参数:</span>
                            <div className="mt-1 space-y-1">
                              {Object.entries(endpoint.params.query).map(([key, value]) => (
                                <div key={key} className="text-xs text-gray-600 ml-4">
                                  <code className="text-primary-600">{key}</code>: {value}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {endpoint.params.body && (
                          <div>
                            <span className="text-xs font-semibold text-gray-500">请求体:</span>
                            <div className="mt-1 space-y-1">
                              {Object.entries(endpoint.params.body).map(([key, value]) => (
                                <div key={key} className="text-xs text-gray-600 ml-4">
                                  <code className="text-primary-600">{key}</code>: {value}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 响应示例 */}
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">响应示例</h3>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <pre className="text-xs text-gray-700 overflow-x-auto">
                        {JSON.stringify(endpoint.response, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* 请求示例 */}
                  {endpoint.example && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">请求示例</h3>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <pre className="text-xs text-gray-700 overflow-x-auto">
                          {JSON.stringify(endpoint.example.request || {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* cURL 示例 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700">cURL 示例</h3>
                      <button
                        onClick={() => copyToClipboard(curlExample, `${endpoint.method} ${endpoint.path}`)}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {copiedEndpoint === `${endpoint.method} ${endpoint.path}` ? '✓ 已复制' : '复制'}
                      </button>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                      <pre className="text-xs text-gray-300 overflow-x-auto font-mono">
                        {curlExample}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 认证说明 */}
      <div className="mt-8 glass rounded-xl p-6 border border-white/50 shadow-soft">
        <h2 className="text-xl font-bold text-gray-900 mb-4">认证说明</h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div>
            <span className="font-semibold text-gray-700">公开接口 (Public):</span>
            <span className="ml-2">无需认证，可直接调用</span>
          </div>
          <div>
            <span className="font-semibold text-gray-700">需认证 (Required):</span>
            <span className="ml-2">需要在请求头中添加: <code className="bg-gray-100 px-2 py-1 rounded">Authorization: Bearer YOUR_TOKEN</code></span>
          </div>
          <div>
            <span className="font-semibold text-gray-700">管理员 (Admin):</span>
            <span className="ml-2">需要管理员权限，除了认证token外，用户角色必须是admin</span>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">
              <strong>获取Token:</strong> 通过 <code className="bg-blue-100 px-1 py-0.5 rounded">/api/users/login</code> 或 <code className="bg-blue-100 px-1 py-0.5 rounded">/api/users/sync</code> 接口获取JWT token
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiDocs;

