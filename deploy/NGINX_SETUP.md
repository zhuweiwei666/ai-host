# Nginx 配置说明

## 应用 Nginx 配置

### 1. 复制配置文件到 Nginx 配置目录

```bash
# 将模板文件复制到 Nginx sites-available 目录
sudo cp /path/to/ai-host/deploy/nginx_template.conf /etc/nginx/sites-available/ai-host

# 创建符号链接到 sites-enabled
sudo ln -s /etc/nginx/sites-available/ai-host /etc/nginx/sites-enabled/ai-host
```

### 2. 测试 Nginx 配置

```bash
# 检查配置语法
sudo nginx -t
```

### 3. 重新加载 Nginx

```bash
# 如果测试通过，重新加载配置
sudo nginx -s reload
```

## 配置说明

- **前端静态文件路径**: `/var/www/ai-host-frontend/dist`
- **后端 API 代理**: `/api/*` → `http://127.0.0.1:4000/api/`
- **前端路由支持**: 所有非 `/api/` 的请求都会回退到 `index.html`，支持前端路由刷新

## 重要提示

1. 确保前端构建文件已部署到 `/var/www/ai-host-frontend/dist`
2. 确保后端服务运行在 `127.0.0.1:4000`
3. 确保后端路由已配置 `/api` 前缀（如 `/api/agents`, `/api/chat` 等）

