# 手动修复 nginx.conf 语法错误

## 问题
```
nginx: [emerg] unexpected end of file, expecting "}" in /etc/nginx/nginx.conf:37
```

## 快速修复步骤

### 方法 1: 使用自动修复脚本（推荐）

```bash
cd /var/www/ai-host/deploy
chmod +x fix_nginx_conf_syntax.sh
sudo ./fix_nginx_conf_syntax.sh
```

### 方法 2: 手动修复

#### 步骤 1: 查看错误位置

```bash
# 查看第 37 行附近
sudo sed -n '25,45p' /etc/nginx/nginx.conf

# 或者查看完整文件
sudo cat /etc/nginx/nginx.conf
```

#### 步骤 2: 检查括号匹配

```bash
# 统计括号数量
grep -o '{' /etc/nginx/nginx.conf | wc -l  # 应该等于
grep -o '}' /etc/nginx/nginx.conf | wc -l  # 这个数字
```

#### 步骤 3: 修复

**如果缺少闭合括号：**

```bash
# 备份
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# 编辑文件
sudo nano /etc/nginx/nginx.conf

# 在文件末尾添加缺失的 }
# 通常是在 http { 块的末尾
```

**标准 nginx.conf 结构应该是：**

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

**注意：**
- `http {` 必须有对应的 `}`
- `events {` 必须有对应的 `}`
- 文件末尾应该以 `}` 结束（闭合 http 块）

#### 步骤 4: 测试

```bash
sudo nginx -t
```

如果显示 "test is successful"，说明修复成功。

#### 步骤 5: 重载

```bash
sudo nginx -s reload
```

## 常见问题

### 问题 1: 文件被截断

如果文件意外被截断，恢复备份：

```bash
sudo cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
```

### 问题 2: 多个 server 块未闭合

检查所有 server 块：

```bash
sudo grep -n "server {" /etc/nginx/nginx.conf
sudo grep -n "^}" /etc/nginx/nginx.conf
```

确保每个 `server {` 都有对应的 `}`。

### 问题 3: 不确定如何修复

使用诊断脚本：

```bash
cd /var/www/ai-host/deploy
chmod +x show_nginx_conf.sh
sudo ./show_nginx_conf.sh
```

这会显示完整的文件内容和括号统计。

## 验证修复

修复后运行：

```bash
# 1. 测试配置
sudo nginx -t

# 2. 如果通过，重载
sudo nginx -s reload

# 3. 检查错误日志
sudo tail -f /var/log/nginx/error.log
```

