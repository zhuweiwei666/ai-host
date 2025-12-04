# 修复 HTTPS 高风险提示

## 问题
浏览器显示"不安全"警告，因为使用的是 Cloudflare Origin Certificate，浏览器不信任。

## 解决方案

### 方案 1: 使用 Cloudflare Full SSL 模式（推荐，最简单）

1. 登录 Cloudflare 控制台：https://dash.cloudflare.com/
2. 选择域名：`cling-ai.com`
3. 进入：SSL/TLS 设置
4. 将加密模式改为：**Full (strict)**
5. 这样 Cloudflare 会自动处理 SSL，浏览器会显示绿色锁

### 方案 2: 使用 Let's Encrypt 免费证书

如果需要服务器端直接提供 SSL（不使用 Cloudflare），可以：

1. 安装 certbot：
```bash
ssh root@139.162.62.115
apt-get update
apt-get install -y certbot python3-certbot-nginx
```

2. 获取证书：
```bash
certbot certonly --standalone -d cling-ai.com -d www.cling-ai.com
```

3. 证书会保存在：`/etc/letsencrypt/live/cling-ai.com/`
   - `fullchain.pem` (证书)
   - `privkey.pem` (私钥)

4. 更新 Nginx 配置使用新证书：
```nginx
ssl_certificate /etc/letsencrypt/live/cling-ai.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/cling-ai.com/privkey.pem;
```

5. 设置自动续期：
```bash
certbot renew --dry-run
```

### 方案 3: 使用 Cloudflare 的 Full SSL + 自动证书

如果使用 Cloudflare，最简单的方法是：
1. 在 Cloudflare 控制台设置 SSL/TLS 为 "Full (strict)"
2. 这样 Cloudflare 会自动提供浏览器信任的证书
3. 不需要在服务器上配置证书

## 当前状态

当前使用的是 Cloudflare Origin Certificate，这是 Cloudflare 的内部证书，用于 Cloudflare 和源服务器之间的加密，但浏览器不信任。

**推荐使用方案 1**，最简单且不需要修改服务器配置。

