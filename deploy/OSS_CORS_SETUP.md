# OSS CORS 配置指南

## 问题描述

前端直接上传到 OSS 时遇到 CORS 错误：
```
Access to XMLHttpRequest at 'http://ai-host.oss-ap-southeast-1.aliyuncs.com/...' 
from origin 'http://47.245.121.93' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 解决方案

### 步骤 1: 登录阿里云 OSS 控制台

1. 访问：https://oss.console.aliyun.com/
2. 选择 bucket：`ai-host`（或你的 bucket 名称）
3. 进入 **权限管理** -> **跨域设置（CORS）**

### 步骤 2: 创建 CORS 规则

点击 **创建规则**，填写以下配置：

#### 来源（AllowedOrigins）
```
http://47.245.121.93
http://localhost:5173
http://localhost:3000
```
**注意：** 每行一个，或者使用通配符 `*`（不推荐，安全性较低）

#### 允许 Methods
勾选以下方法：
- ✅ GET
- ✅ PUT
- ✅ POST
- ✅ HEAD
- ✅ OPTIONS（用于预检请求）

#### 允许 Headers
```
*
```
或者具体指定：
```
Authorization
Content-Type
x-oss-*
```

#### 暴露 Headers
```
ETag
x-oss-request-id
x-oss-next-append-position
```

#### 缓存时间（秒）
```
3600
```

### 步骤 3: 保存并测试

1. 点击 **确定** 保存规则
2. 等待 1-2 分钟让配置生效
3. 重新测试前端上传功能

## 验证 CORS 配置

使用 curl 测试 CORS 预检请求：

```bash
curl -X OPTIONS \
  -H "Origin: http://47.245.121.93" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v \
  http://ai-host.oss-ap-southeast-1.aliyuncs.com/
```

应该返回包含 `Access-Control-Allow-Origin` 的响应。

## 其他需要检查的配置

### 1. Bucket 权限设置

- **读写权限：** 建议设置为"私有"（更安全）
- **如果设置为私有，需要确保：**
  - AccessKey 有 PutObject 权限
  - 或者配置 Bucket Policy 允许特定操作

### 2. AccessKey 权限

确保使用的 AccessKey 具有以下权限：
- `oss:PutObject` - 上传文件
- `oss:GetObject` - 读取文件（如果需要）

### 3. Bucket Policy（可选）

如果需要更细粒度的权限控制，可以配置 Bucket Policy：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "RAM": ["acs:ram::<AccountID>:user/<UserName>"]
      },
      "Action": [
        "oss:PutObject",
        "oss:GetObject"
      ],
      "Resource": [
        "acs:oss:*:*:ai-host/uploads/*"
      ]
    }
  ]
}
```

## 常见问题

### Q: 配置 CORS 后仍然报错？

A: 
1. 等待 1-2 分钟让配置生效
2. 清除浏览器缓存
3. 检查 Origin 是否完全匹配（包括协议 http/https）
4. 检查浏览器控制台的完整错误信息

### Q: 使用 root 账户还是 RAM 子账户？

A: 
- **推荐：** 使用 RAM 子账户（更安全）
- **当前：** 代码已支持 root 账户（用于快速测试）

### Q: 如何创建 RAM 子账户？

A:
1. 登录 RAM 控制台：https://ram.console.aliyun.com/
2. 创建用户 -> 创建 AccessKey
3. 授予 OSS 相关权限
4. 更新 `.env.production.local` 中的 AccessKey

