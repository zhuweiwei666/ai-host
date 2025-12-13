#!/bin/bash
# Basic monitoring setup for cling-ai server
# Run on the production server

set -e

echo "=== Monitoring Setup for cling-ai ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo $0"
  exit 1
fi

# 1. Create log rotation for Docker
echo "[1/4] Setting up Docker log rotation..."
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
EOF

# 2. Create health check script
echo "[2/4] Creating health check script..."
cat > /root/ai-host/check_health.sh << 'SCRIPT'
#!/bin/bash
# Health check script - run via cron

HEALTH_URL="http://localhost:4000/api/health"
ALERT_EMAIL="${ALERT_EMAIL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" 2>/dev/null)

if [ "$response" != "200" ]; then
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  message="[ALERT] cling-ai health check failed at $timestamp (HTTP $response)"
  
  echo "$message" >> /var/log/cling-ai-health.log
  
  # Send email if configured
  if [ -n "$ALERT_EMAIL" ]; then
    echo "$message" | mail -s "cling-ai Health Alert" "$ALERT_EMAIL"
  fi
  
  # Send Slack if configured
  if [ -n "$SLACK_WEBHOOK" ]; then
    curl -s -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"$message\"}" "$SLACK_WEBHOOK"
  fi
  
  exit 1
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') OK" >> /var/log/cling-ai-health.log
exit 0
SCRIPT
chmod +x /root/ai-host/check_health.sh

# 3. Add cron jobs
echo "[3/4] Setting up cron jobs..."

# Create cron entries
(crontab -l 2>/dev/null || true; cat << 'CRON'
# cling-ai monitoring - health check every 2 minutes
*/2 * * * * /root/ai-host/check_health.sh

# Docker stats log every 5 minutes
*/5 * * * * docker stats --no-stream --format "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" >> /var/log/docker-stats.log 2>&1

# Cleanup old logs weekly
0 3 * * 0 find /var/log -name "cling-ai-*.log" -mtime +30 -delete
0 3 * * 0 find /var/log -name "docker-stats.log" -size +100M -exec truncate -s 0 {} \;
CRON
) | sort -u | crontab -

# 4. Create simple status dashboard script
echo "[4/4] Creating status dashboard..."
cat > /root/ai-host/status.sh << 'SCRIPT'
#!/bin/bash
# Quick status overview

echo "=== cling-ai Status ==="
echo ""
echo "Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(ai-host|ai-wallet)"
echo ""
echo "Health Check:"
curl -s http://localhost:4000/api/health | python3 -m json.tool 2>/dev/null || echo "FAILED"
echo ""
echo "Recent Logs (last 10 lines):"
docker logs ai-host-backend --tail 10 2>&1 | tail -5
echo ""
echo "Resource Usage:"
docker stats --no-stream --format "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep -E "(ai-host|ai-wallet)"
SCRIPT
chmod +x /root/ai-host/status.sh

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Commands:"
echo "  /root/ai-host/status.sh        - Quick status overview"
echo "  /root/ai-host/check_health.sh  - Run health check"
echo ""
echo "Logs:"
echo "  /var/log/cling-ai-health.log   - Health check history"
echo "  /var/log/docker-stats.log      - Container resource usage"
echo ""
echo "To configure alerts, set environment variables:"
echo "  export ALERT_EMAIL=you@example.com"
echo "  export SLACK_WEBHOOK=https://hooks.slack.com/..."
