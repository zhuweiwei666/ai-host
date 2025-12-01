#!/bin/bash

# 收集上传相关的所有日志

OUTPUT_FILE="upload_logs_$(date +%Y%m%d_%H%M%S).txt"

echo "=========================================="
echo "  收集上传问题日志"
echo "=========================================="
echo ""
echo "日志将保存到: $OUTPUT_FILE"
echo ""

{
    echo "=========================================="
    echo "  上传问题日志收集"
    echo "  时间: $(date)"
    echo "=========================================="
    echo ""
    
    echo "=== 1. 后端服务状态 ==="
    pm2 list 2>/dev/null || echo "PM2 未安装或服务未运行"
    echo ""
    
    echo "=== 2. 后端 PM2 日志（最近 200 行）==="
    pm2 logs ai-host-backend --lines 200 --nostream 2>/dev/null || \
    pm2 logs ai-backend --lines 200 --nostream 2>/dev/null || \
    echo "无法获取 PM2 日志"
    echo ""
    
    echo "=== 3. Nginx 错误日志（最近 100 行）==="
    sudo tail -100 /var/log/nginx/error.log 2>/dev/null || echo "无法读取 Nginx 错误日志"
    echo ""
    
    echo "=== 4. Nginx 访问日志 - OSS 相关（最近 100 行）==="
    sudo tail -100 /var/log/nginx/access.log 2>/dev/null | grep -E "/api/oss|/api/upload|/uploads" || echo "未找到相关访问记录"
    echo ""
    
    echo "=== 5. Nginx 自定义错误日志（如果存在）==="
    sudo tail -100 /var/log/nginx/ai-host-error.log 2>/dev/null || echo "自定义错误日志不存在"
    echo ""
    
    echo "=== 6. 后端路由配置检查 ==="
    if [ -f "/var/www/ai-host/backend/src/server.js" ]; then
        echo "--- server.js 中的路由挂载 ---"
        grep -n "app.use.*oss\|app.use.*upload" /var/www/ai-host/backend/src/server.js || echo "未找到 OSS/upload 路由"
        echo ""
    else
        echo "server.js 不存在"
    fi
    
    if [ -f "/var/www/ai-host/backend/src/routes/oss.js" ]; then
        echo "--- oss.js 路由文件内容 ---"
        head -30 /var/www/ai-host/backend/src/routes/oss.js
        echo ""
    else
        echo "oss.js 路由文件不存在"
    fi
    echo ""
    
    echo "=== 7. 环境变量检查（隐藏敏感信息）==="
    ENV_FILE="/var/www/ai-host/backend/.env.production.local"
    if [ -f "$ENV_FILE" ]; then
        echo "--- OSS 相关环境变量（值已隐藏）---"
        grep "^OSS_" "$ENV_FILE" 2>/dev/null | sed 's/=.*/=***/' || echo "未找到 OSS 环境变量"
    else
        echo "环境变量文件不存在: $ENV_FILE"
        echo "检查 .env 文件:"
        if [ -f "/var/www/ai-host/backend/.env" ]; then
            grep "^OSS_" "/var/www/ai-host/backend/.env" 2>/dev/null | sed 's/=.*/=***/' || echo "未找到 OSS 环境变量"
        fi
    fi
    echo ""
    
    echo "=== 8. 依赖检查 ==="
    if [ -f "/var/www/ai-host/backend/package.json" ]; then
        echo "--- package.json 中的 ali-oss ---"
        grep -A 2 -B 2 "ali-oss" /var/www/ai-host/backend/package.json || echo "未找到 ali-oss"
    fi
    
    if [ -d "/var/www/ai-host/backend/node_modules/ali-oss" ]; then
        echo "✓ ali-oss 已安装"
    else
        echo "✗ ali-oss 未安装"
    fi
    echo ""
    
    echo "=== 9. 端口监听检查 ==="
    echo "--- 端口 4000 监听状态 ---"
    netstat -tlnp 2>/dev/null | grep ":4000" || \
    ss -tlnp 2>/dev/null | grep ":4000" || \
    echo "端口 4000 未监听"
    echo ""
    
    echo "=== 10. 测试 STS 端点 ==="
    echo "--- 测试 /api/oss/sts (无认证) ---"
    curl -v http://127.0.0.1:4000/api/oss/sts 2>&1 | head -20
    echo ""
    
    echo "=== 11. Nginx 配置检查 ==="
    if [ -f "/etc/nginx/sites-available/ai-host" ]; then
        echo "--- /api/ 代理配置 ---"
        grep -A 10 "location /api/" /etc/nginx/sites-available/ai-host || echo "未找到 /api/ 配置"
    fi
    echo ""
    
    echo "=== 12. 前端 OSS 上传代码检查 ==="
    if [ -f "/var/www/ai-host/frontend/src/utils/ossUpload.ts" ]; then
        echo "--- ossUpload.ts 中的 STS 端点 ---"
        grep -n "/oss/sts\|/api/oss" /var/www/ai-host/frontend/src/utils/ossUpload.ts || echo "未找到 STS 端点"
    fi
    echo ""
    
    echo "=========================================="
    echo "  日志收集完成"
    echo "=========================================="
    
} | tee "$OUTPUT_FILE"

echo ""
echo "=========================================="
echo "  日志已保存到: $OUTPUT_FILE"
echo "=========================================="
echo ""
echo "请将以下内容发送给我："
echo "1. 文件内容: cat $OUTPUT_FILE"
echo "2. 或者直接复制文件内容"
echo ""

