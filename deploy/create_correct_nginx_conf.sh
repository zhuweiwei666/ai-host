#!/bin/bash

# 创建正确的 nginx.conf

set -e

echo "=========================================="
echo "  创建正确的 nginx.conf"
echo "=========================================="
echo ""

# 备份原文件
BACKUP_FILE="/etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)"
sudo cp /etc/nginx/nginx.conf "$BACKUP_FILE"
echo "✓ 已备份到: $BACKUP_FILE"
echo ""

# 创建正确的 nginx.conf
sudo tee /etc/nginx/nginx.conf > /dev/null <<'EOF'
user nginx;
worker_processes auto;

error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip Settings
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

    # Include server configurations
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF

echo "✓ 已创建正确的 nginx.conf"
echo ""

# 测试
echo "测试配置..."
if sudo nginx -t 2>&1; then
    echo "✓ 配置语法正确"
else
    echo "✗ 配置仍有错误"
    exit 1
fi
echo ""

echo "=========================================="
echo "  完成！"
echo "=========================================="
echo ""
echo "下一步:"
echo "1. 确保站点配置文件存在: /etc/nginx/sites-available/ai-host"
echo "2. 运行: sudo ./fix_all_nginx_issues.sh"
echo "3. 或手动重启: sudo systemctl restart nginx"
echo ""

