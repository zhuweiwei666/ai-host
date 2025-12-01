# Nginx 500 错误快速修复指南

## 🚨 立即执行（在服务器上）

### 方法 1: 使用诊断脚本（推荐）

```bash
# 1. 上传脚本到服务器或克隆项目
cd /path/to/ai-host/deploy

# 2. 运行诊断脚本
chmod +x diagnose_500.sh
sudo ./diagnose_500.sh
```

诊断脚本会显示：
- ✅ 哪些配置正确
- ❌ 哪些配置有问题
- 📋 具体的错误信息

### 方法 2: 使用完整修复脚本

```bash
# 运行完整修复脚本（会尝试自动修复）
chmod +x fix_500_complete.sh
sudo ./fix_500_complete.sh
```

---

## 🔍 最常见的原因和解决方案

### 原因 1: 前端文件不存在（90% 的情况）

**症状**: 访问 `http://47.245.121.93/` 返回 500

**检查**:
```bash
ls -la /var/www/ai-host/frontend/dist/index.html
```

**解决**:
```bash
# 在本地构建
cd frontend
npm run build

# 上传到服务器（方法 1: 使用 scp）
scp -r dist/* root@47.245.121.93:/var/www/ai-host/frontend/dist/

# 或者在服务器上直接构建（方法 2）
cd /path/to/ai-host/frontend
npm run build
sudo cp -r dist/* /var/www/ai-host/frontend/dist/
```

### 原因 2: 文件权限问题

**检查**:
```bash
ls -l /var/www/ai-host/frontend/dist/index.html
```

**解决**:
```bash
sudo chown -R www-data:www-data /var/www/ai-host/frontend
sudo chmod -R 755 /var/www/ai-host/frontend
```

### 原因 3: Nginx 配置错误

**检查**:
```bash
sudo nginx -t
```

**解决**:
```bash
# 应用正确的配置
sudo cp /path/to/ai-host/deploy/nginx_template.conf /etc/nginx/sites-available/ai-host
sudo ln -sf /etc/nginx/sites-available/ai-host /etc/nginx/sites-enabled/ai-host
sudo nginx -t
sudo nginx -s reload
```

### 原因 4: 目录不存在

**检查**:
```bash
ls -ld /var/www/ai-host/frontend/dist
```

**解决**:
```bash
sudo mkdir -p /var/www/ai-host/frontend/dist
sudo chown -R www-data:www-data /var/www/ai-host/frontend
```

---

## 📋 完整修复步骤（手动）

### 步骤 1: 确保前端已构建

```bash
# 在本地或服务器上
cd frontend
npm install
npm run build
```

### 步骤 2: 创建目录并部署文件

```bash
# 在服务器上
sudo mkdir -p /var/www/ai-host/frontend/dist
sudo cp -r /path/to/frontend/dist/* /var/www/ai-host/frontend/dist/
```

### 步骤 3: 设置权限

```bash
sudo chown -R www-data:www-data /var/www/ai-host/frontend
sudo chmod -R 755 /var/www/ai-host/frontend
```

### 步骤 4: 应用 Nginx 配置

```bash
# 复制配置文件
sudo cp /path/to/ai-host/deploy/nginx_template.conf /etc/nginx/sites-available/ai-host

# 启用站点
sudo ln -sf /etc/nginx/sites-available/ai-host /etc/nginx/sites-enabled/ai-host

# 禁用默认站点（如果有）
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo nginx -s reload
```

### 步骤 5: 验证

```bash
# 检查文件
ls -la /var/www/ai-host/frontend/dist/index.html

# 检查 Nginx 状态
sudo systemctl status nginx

# 查看错误日志
sudo tail -f /var/log/nginx/error.log
```

---

## 🐛 查看错误日志

```bash
# 标准错误日志
sudo tail -f /var/log/nginx/error.log

# 自定义错误日志（如果配置了）
sudo tail -f /var/log/nginx/ai-host-error.log

# 访问日志
sudo tail -f /var/log/nginx/access.log
```

---

## ✅ 验证清单

- [ ] `/var/www/ai-host/frontend/dist/index.html` 存在
- [ ] 文件权限正确（www-data:www-data）
- [ ] Nginx 配置语法正确（`sudo nginx -t` 通过）
- [ ] 站点已启用（`/etc/nginx/sites-enabled/ai-host` 存在）
- [ ] Nginx 正在运行（`systemctl status nginx`）
- [ ] 无 SELinux 阻止（如果启用）

---

## 🆘 仍然无法解决？

1. **运行诊断脚本**:
   ```bash
   sudo ./diagnose_500.sh
   ```

2. **查看详细错误日志**:
   ```bash
   sudo tail -50 /var/log/nginx/error.log
   ```

3. **检查 Nginx 配置**:
   ```bash
   sudo nginx -T | grep -A 20 "server_name 47.245.121.93"
   ```

4. **测试文件访问**:
   ```bash
   sudo -u www-data cat /var/www/ai-host/frontend/dist/index.html | head -5
   ```

---

## 📞 需要帮助？

如果以上步骤都无法解决问题，请提供：
1. 诊断脚本的完整输出
2. Nginx 错误日志的最后 50 行
3. `sudo nginx -t` 的输出
4. `ls -la /var/www/ai-host/frontend/dist/` 的输出

