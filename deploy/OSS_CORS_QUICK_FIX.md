# OSS CORS 快速修复指南

## 🔴 问题：CORS 错误阻止上传

错误信息：
```
Access to XMLHttpRequest at 'http://ai-host.oss-ap-southeast-1.aliyuncs.com/...' 
from origin 'http://47.245.121.93' has been blocked by CORS policy
```

## ✅ 解决方案：配置 OSS CORS

### 方法 1: 通过阿里云控制台（推荐）

1. **登录阿里云 OSS 控制台**
   - 访问：https://oss.console.aliyun.com/
   - 选择 bucket：`ai-host`

2. **进入 CORS 设置**
   - 点击左侧菜单：**权限管理** -> **跨域设置（CORS）**
   - 点击 **创建规则**

3. **填写 CORS 规则**

   **来源（AllowedOrigins）：**
   ```
   http://47.245.121.93
   http://localhost:5173
   http://localhost:3000
   ```
   *注意：每行一个，或者使用 `*`（不推荐）*

   **允许 Methods（控制台不会列出 OPTIONS）：**
   - ✅ GET
   - ✅ PUT
   - ✅ POST
   - ✅ HEAD
   - ✅ DELETE
   - ℹ️ OSS 会自动响应 OPTIONS 预检，所以界面里不会单独显示该选项

   **允许 Headers：**
   ```
   *
   ```
   或者具体指定：
   ```
   Authorization
   Content-Type
   Content-Length
   x-oss-*
   ```

   **暴露 Headers：**
   ```
   ETag
   x-oss-request-id
   x-oss-next-append-position
   ```

   **缓存时间（秒）：**
   ```
   3600
   ```

4. **保存并等待生效**
   - 点击 **确定**
   - 等待 1-2 分钟

### 方法 2: 通过阿里云 CLI（如果已安装）

```bash
# 安装阿里云 CLI（如果未安装）
# wget https://aliyuncli.alicdn.com/aliyun-cli-linux-latest-amd64.tgz
# tar -xzf aliyun-cli-linux-latest-amd64.tgz
# sudo mv aliyun /usr/local/bin/

# 配置 AccessKey
aliyun configure set \
  --profile default \
  --mode AK \
  --region ap-southeast-1 \
  --access-key-id <你的AccessKeyId> \
  --access-key-secret <你的AccessKeySecret>

# 设置 CORS（创建 cors.json 文件）
cat > /tmp/cors.json << 'EOF'
{
  "CORSRule": [
    {
      "AllowedOrigin": ["http://47.245.121.93", "http://localhost:5173", "http://localhost:3000"],
      "AllowedMethod": ["GET", "PUT", "POST", "HEAD", "DELETE"],
      "AllowedHeader": ["*"],
      "ExposeHeader": ["ETag", "x-oss-request-id"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

# 应用 CORS 配置
aliyun oss put-bucket-cors \
  --bucket ai-host \
  --cors-configuration file:///tmp/cors.json
```

## 🔍 验证 CORS 配置

### 使用 curl 测试

```bash
# 测试 OPTIONS 预检请求
curl -X OPTIONS \
  -H "Origin: http://47.245.121.93" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v \
  http://ai-host.oss-ap-southeast-1.aliyuncs.com/

# 应该返回包含以下 header 的响应：
# Access-Control-Allow-Origin: http://47.245.121.93
# Access-Control-Allow-Methods: GET,PUT,POST,HEAD,DELETE
# Access-Control-Allow-Headers: *
```

### 在浏览器控制台测试

打开浏览器控制台，运行：

```javascript
fetch('http://ai-host.oss-ap-southeast-1.aliyuncs.com/', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'http://47.245.121.93',
    'Access-Control-Request-Method': 'PUT'
  }
}).then(r => {
  console.log('CORS Headers:', {
    'Access-Control-Allow-Origin': r.headers.get('Access-Control-Allow-Origin'),
    'Access-Control-Allow-Methods': r.headers.get('Access-Control-Allow-Methods')
  });
});
```

## 📋 需要提供的资料（用于进一步诊断）

如果配置 CORS 后仍然无法上传，请提供：

1. **OSS 环境变量**（隐藏敏感值）：
   ```bash
   grep "^OSS_" /var/www/ai-host/backend/.env.production.local | sed 's/=.*/=***/'
   ```

2. **STS 端点测试结果**：
   ```bash
   curl -H 'x-mock-user-id: test_user_001' http://127.0.0.1:4000/api/oss/sts
   ```

3. **浏览器控制台完整错误信息**（截图或复制）

4. **OSS bucket 信息**：
   - Bucket 名称
   - Region
   - 读写权限设置（公共读/私有）

5. **AccessKey 类型**：
   - Root 账户 AccessKey
   - RAM 子账户 AccessKey

## 🛠️ 其他可能的问题

### 1. Bucket 权限设置

- **如果 bucket 是"私有"**：确保 AccessKey 有 PutObject 权限
- **如果 bucket 是"公共读"**：上传仍然需要认证，但读取不需要

### 2. AccessKey 权限不足

确保 AccessKey 具有以下权限：
- `oss:PutObject` - 上传文件
- `oss:GetObject` - 读取文件（如果需要）

### 3. 网络问题

- 检查服务器是否能访问 OSS endpoint
- 检查防火墙设置

### 4. 前端代码问题

- 确保使用最新代码（已修复 CORS 相关代码）
- 清除浏览器缓存
- 检查浏览器控制台的完整错误堆栈

