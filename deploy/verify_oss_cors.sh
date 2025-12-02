#!/bin/bash

# 验证 OSS CORS 配置

echo "=========================================="
echo "  验证 OSS CORS 配置"
echo "=========================================="
echo ""

echo "测试 CORS 预检请求..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X OPTIONS \
  -H "Origin: http://47.245.121.93" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  http://ai-host.oss-ap-southeast-1.aliyuncs.com/ 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "HTTP 状态码: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ CORS 配置成功！"
    echo ""
    echo "响应头信息:"
    curl -s -I -X OPTIONS \
      -H "Origin: http://47.245.121.93" \
      -H "Access-Control-Request-Method: PUT" \
      http://ai-host.oss-ap-southeast-1.aliyuncs.com/ | grep -i "access-control"
    echo ""
    echo "✅ 现在可以正常上传文件了！"
elif [ "$HTTP_CODE" = "403" ]; then
    echo "❌ CORS 未配置或配置错误"
    echo ""
    echo "错误信息:"
    echo "$BODY" | grep -o '<Message>[^<]*</Message>' | sed 's/<Message>//;s/<\/Message>//'
    echo ""
    echo "请检查："
    echo "1. 是否在 OSS 控制台的'跨域设置（CORS）'中配置（不是'Bucket 授权策略'）"
    echo "2. 是否包含了 OPTIONS 方法"
    echo "3. 是否包含了正确的来源（Origin）"
    echo "4. 配置后是否等待了 1-2 分钟"
else
    echo "⚠️  未知状态码: $HTTP_CODE"
    echo "响应内容:"
    echo "$BODY" | head -20
fi

echo ""
echo "=========================================="

