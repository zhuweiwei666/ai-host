# API 接口文档更新指南

## 📋 更新原则

**每次新增或修改 API 接口时，必须同步更新接口文档！**

## 📍 文档位置

- **前端页面**: `frontend/src/pages/ApiDocs.tsx`
- **访问路径**: `/api-docs` (菜单栏 → 接口文档)

## 🔄 更新步骤

### 1. 新增接口时

在 `frontend/src/pages/ApiDocs.tsx` 的 `apiEndpoints` 对象中，找到对应的分类，添加新的接口定义：

```typescript
{
  method: 'POST', // GET, POST, PUT, DELETE, PATCH
  path: '/api/your-endpoint',
  description: '接口描述',
  auth: 'Public' | 'Required' | 'Admin',
  params: {
    query: { /* 查询参数 */ },
    body: { /* 请求体参数 */ },
    path: { /* 路径参数 */ }
  },
  response: { /* 响应示例 */ },
  example: {
    request: { /* 请求示例 */ },
    response: { /* 响应示例 */ }
  }
}
```

### 2. 修改接口时

找到对应的接口定义，更新以下内容：
- `description`: 如果接口功能改变
- `params`: 如果参数有变化
- `response`: 如果响应格式改变
- `example`: 更新示例代码

### 3. 删除接口时

从对应的分类数组中移除该接口定义。

## 📚 接口分类

文档按以下分类组织：

1. **用户管理** (`users`) - 用户注册、登录、同步、管理
2. **AI主播** (`agents`) - AI主播的CRUD操作
3. **聊天** (`chat`) - 聊天消息、历史、TTS
4. **图片生成** (`image`) - 图片生成接口
5. **视频生成** (`video`) - 视频生成接口
6. **钱包** (`wallet`) - 余额查询、奖励
7. **OSS存储** (`oss`) - 文件上传凭证
8. **语音模型** (`voice`) - 语音模型管理
9. **数据统计** (`stats`) - 统计数据

## ✅ 检查清单

更新接口文档后，请确认：

- [ ] 接口路径正确
- [ ] HTTP方法正确
- [ ] 认证要求标注正确（Public/Required/Admin）
- [ ] 参数说明完整（路径参数、查询参数、请求体）
- [ ] 响应示例准确
- [ ] 请求示例准确（如果有）
- [ ] cURL示例可复制使用
- [ ] 分类正确

## 🎯 最佳实践

1. **及时更新**: 每次代码提交前检查是否需要更新文档
2. **保持准确**: 确保文档与实际接口实现一致
3. **示例完整**: 提供可运行的示例代码
4. **描述清晰**: 用简洁明了的语言描述接口功能

## 📝 示例

### 新增接口示例

```typescript
// 在对应的分类数组中添加
{
  method: 'POST',
  path: '/api/new-feature',
  description: '新功能接口描述',
  auth: 'Required',
  params: {
    body: {
      param1: 'string (必填) - 参数1说明',
      param2: 'number (可选) - 参数2说明'
    }
  },
  response: {
    success: true,
    data: {}
  },
  example: {
    request: {
      param1: 'value1',
      param2: 123
    },
    response: {
      success: true,
      data: { id: '123' }
    }
  }
}
```

---

**记住：文档是给开发者看的，保持准确和及时更新非常重要！**

