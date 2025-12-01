# Nginx 500 错误故障排查指南

## 常见原因和解决方案

### 1. 检查文件路径是否存在

```bash
# 检查前端构建文件是否存在
ls -la /var/www/ai-host-frontend/dist/

# 检查 index.html 是否存在
ls -la /var/www/ai-host-frontend/dist/index.html
```

**如果文件不存在：**
```bash
# 创建目录
sudo mkdir -p /var/www/ai-host-frontend/dist

# 设置正确的权限
sudo chown -R www-data:www-data /var/www/ai-host-frontend
sudo chmod -R 755 /var/www/ai-host-frontend
```

### 2. 检查 Nginx 配置语法

```bash
# 测试配置语法
sudo nginx -t

# 如果语法错误，会显示具体错误信息
```

### 3. 检查 Nginx 错误日志

```bash
# 查看错误日志
sudo tail -f /var/log/nginx/error.log

# 或者查看自定义错误日志
sudo tail -f /var/log/nginx/ai-host-error.log
```

### 4. 检查文件权限

```bash
# Nginx 通常以 www-data 用户运行
# 确保文件可读
sudo chown -R www-data:www-data /var/www/ai-host-frontend
sudo chmod -R 755 /var/www/ai-host-frontend/dist
```

### 5. 检查 SELinux（如果启用）

```bash
# 检查 SELinux 状态
getenforce

# 如果启用，可能需要设置上下文
sudo chcon -R -t httpd_sys_content_t /var/www/ai-host-frontend
```

### 6. 验证前端构建文件

```bash
# 确保 dist 目录中有 index.html
cat /var/www/ai-host-frontend/dist/index.html | head -20

# 检查是否有必要的文件
ls -la /var/www/ai-host-frontend/dist/assets/
```

### 7. 重新部署前端文件

如果文件缺失或损坏，重新部署：

```bash
# 在本地构建
cd frontend
npm run build

# 上传到服务器（使用 scp 或 rsync）
scp -r dist/* user@47.245.121.93:/var/www/ai-host-frontend/dist/

# 或者在服务器上直接构建
cd /path/to/ai-host/frontend
npm run build
sudo cp -r dist/* /var/www/ai-host-frontend/dist/
```

### 8. 检查是否有默认站点冲突

```bash
# 检查是否有默认站点
ls -la /etc/nginx/sites-enabled/

# 如果有 default，可能需要禁用
sudo rm /etc/nginx/sites-enabled/default
```

### 9. 完整重启 Nginx

```bash
# 停止 Nginx
sudo systemctl stop nginx

# 测试配置
sudo nginx -t

# 启动 Nginx
sudo systemctl start nginx

# 检查状态
sudo systemctl status nginx
```

### 10. 快速诊断脚本

在服务器上运行以下命令进行快速诊断：

```bash
#!/bin/bash
echo "=== Nginx 配置检查 ==="
sudo nginx -t

echo -e "\n=== 文件路径检查 ==="
ls -la /var/www/ai-host-frontend/dist/ | head -10

echo -e "\n=== index.html 检查 ==="
if [ -f /var/www/ai-host-frontend/dist/index.html ]; then
    echo "✓ index.html 存在"
    head -5 /var/www/ai-host-frontend/dist/index.html
else
    echo "✗ index.html 不存在"
fi

echo -e "\n=== 权限检查 ==="
ls -ld /var/www/ai-host-frontend/dist

echo -e "\n=== Nginx 错误日志（最后 20 行）==="
sudo tail -20 /var/log/nginx/error.log
```

## 推荐的部署步骤

1. **确保前端已构建**
   ```bash
   cd frontend
   npm run build
   ```

2. **创建目标目录**
   ```bash
   sudo mkdir -p /var/www/ai-host-frontend/dist
   ```

3. **复制文件**
   ```bash
   sudo cp -r frontend/dist/* /var/www/ai-host-frontend/dist/
   ```

4. **设置权限**
   ```bash
   sudo chown -R www-data:www-data /var/www/ai-host-frontend
   sudo chmod -R 755 /var/www/ai-host-frontend
   ```

5. **应用 Nginx 配置**
   ```bash
   sudo cp deploy/nginx_template.conf /etc/nginx/sites-available/ai-host
   sudo ln -sf /etc/nginx/sites-available/ai-host /etc/nginx/sites-enabled/ai-host
   ```

6. **测试并重载**
   ```bash
   sudo nginx -t
   sudo nginx -s reload
   ```

