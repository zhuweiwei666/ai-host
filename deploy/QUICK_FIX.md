# 快速修复指南 - 针对当前错误

## 当前问题

1. ✅ **前端文件存在** - `/var/www/ai-host/frontend/dist/index.html` 存在
2. ❌ **nginx.conf 语法错误** - 第 37 行缺少闭合括号
3. ❌ **站点配置文件不存在** - `/etc/nginx/sites-available/ai-host` 不存在
4. ❌ **重定向循环** - `rewrite or internal redirection cycle`

## 立即执行（按顺序）

### 步骤 1: 修复 nginx.conf 语法错误

```bash
# 检查错误位置
sudo sed -n '30,45p' /etc/nginx/nginx.conf

# 查看完整错误
sudo nginx -t

# 如果看到 "unexpected end of file, expecting }" 在第 37 行
# 需要检查是否有未闭合的大括号
```

**常见修复方法：**
```bash
# 备份
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# 检查括号匹配
grep -o '{' /etc/nginx/nginx.conf | wc -l  # 应该等于
grep -o '}' /etc/nginx/nginx.conf | wc -l  # 这个数字

# 如果不等，手动编辑修复
sudo nano /etc/nginx/nginx.conf
```

### 步骤 2: 创建站点配置文件

```bash
# 复制模板配置
sudo cp /var/www/ai-host/deploy/nginx_template.conf /etc/nginx/sites-available/ai-host

# 启用站点
sudo ln -sf /etc/nginx/sites-available/ai-host /etc/nginx/sites-enabled/ai-host
```

### 步骤 3: 运行自动修复脚本

```bash
cd /var/www/ai-host/deploy
chmod +x fix_nginx_issues.sh
sudo ./fix_nginx_issues.sh
```

### 步骤 4: 验证

```bash
# 测试配置
sudo nginx -t

# 如果通过，重载
sudo nginx -s reload

# 检查错误日志
sudo tail -f /var/log/nginx/error.log
```

## 或者：手动修复 nginx.conf

如果自动修复失败，手动检查：

```bash
# 1. 查看第 37 行附近
sudo sed -n '30,45p' /etc/nginx/nginx.conf

# 2. 检查 http 块是否闭合
sudo grep -n "http {" /etc/nginx/nginx.conf
sudo grep -n "^}" /etc/nginx/nginx.conf

# 3. 确保每个 { 都有对应的 }
```

## 修复重定向循环

新的配置使用 `@fallback` 命名位置块，避免循环：

```nginx
location / {
    try_files $uri $uri/ @fallback;
}

location @fallback {
    rewrite ^.*$ /index.html last;
}
```

这已经包含在 `nginx_template.conf` 中。

