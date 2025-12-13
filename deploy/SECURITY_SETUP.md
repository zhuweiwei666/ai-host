# Production Security Setup Guide

This guide covers the infrastructure and ops steps required to harden the cling-ai service for commercial use.

---

## 1. Cloudflare Configuration (Required)

### 1.1 Enable Proxy Mode (Orange Cloud)

1. Log in to Cloudflare Dashboard → DNS
2. For `cling-ai.com` A/CNAME record: click the cloud icon to turn it **orange (Proxied)**
3. Do the same for `www.cling-ai.com` and any API subdomains

### 1.2 Enable WAF Managed Rules

1. Security → WAF → Managed Rules
2. Enable **Cloudflare Managed Ruleset** (free tier includes basic protection)
3. Enable **OWASP Core Ruleset** if available on your plan

### 1.3 Add Rate Limiting Rules

Go to Security → WAF → Rate limiting rules. Add these rules:

| Rule Name | Expression | Requests | Period | Action |
|-----------|------------|----------|--------|--------|
| Sync Endpoint | `http.request.uri.path contains "/api/users/sync"` | 10 | 10s | Block |
| Chat Endpoint | `http.request.uri.path contains "/api/chat"` | 30 | 10s | Block |
| Image Gen | `http.request.uri.path contains "/api/generate-image"` | 5 | 60s | Block |
| Video Gen | `http.request.uri.path contains "/api/generate-video"` | 2 | 60s | Block |
| Wallet APIs | `http.request.uri.path contains "/api/wallet"` | 20 | 10s | Block |
| Billing APIs | `http.request.uri.path contains "/api/billing"` | 20 | 10s | Block |
| OSS Proxy | `http.request.uri.path contains "/api/oss/proxy"` | 30 | 10s | Block |

### 1.4 Bot Protection (Optional but Recommended)

1. Security → Bots → Configure Bot Fight Mode → Enable
2. Add custom rule: Challenge requests with `cf.client.bot` = true

### 1.5 Geo-blocking (If Needed)

If you see attacks from specific countries:
1. Security → WAF → Custom rules
2. Add rule: `ip.geoip.country in {"XX" "YY"}` → Block

---

## 2. Origin Server Firewall (Required)

### 2.1 Allow Only Cloudflare IPs

Run this on your server (139.162.62.115):

```bash
# Download and run the Cloudflare IP allowlist script
curl -sS https://raw.githubusercontent.com/zhuweiwei666/ai-host/main/deploy/setup_cloudflare_firewall.sh | bash
```

Or manually:

```bash
# Get Cloudflare IP ranges
CF_IPS=$(curl -s https://www.cloudflare.com/ips-v4)

# Flush existing rules (careful!)
sudo iptables -F INPUT

# Allow loopback
sudo iptables -A INPUT -i lo -j ACCEPT

# Allow established connections
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow SSH (port 22) from anywhere (or restrict to your IP)
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS only from Cloudflare
for ip in $CF_IPS; do
  sudo iptables -A INPUT -p tcp -s $ip --dport 80 -j ACCEPT
  sudo iptables -A INPUT -p tcp -s $ip --dport 443 -j ACCEPT
done

# Drop everything else to 80/443
sudo iptables -A INPUT -p tcp --dport 80 -j DROP
sudo iptables -A INPUT -p tcp --dport 443 -j DROP

# Save rules
sudo iptables-save | sudo tee /etc/iptables.rules
```

### 2.2 Verify Backend Port Not Exposed

```bash
# Should show port 4000 only on Docker internal network
sudo netstat -tlnp | grep 4000

# From external machine, this should fail:
curl -sS http://139.162.62.115:4000/api/agents
# Expected: Connection refused or timeout
```

### 2.3 Harden SSH

```bash
# Disable password authentication
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# Restart SSH
sudo systemctl restart sshd

# Install fail2ban
sudo apt-get update && sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 3. Verify Security Setup

### 3.1 Origin IP Not Reachable

```bash
# This should fail (timeout or connection refused)
curl -sS --connect-timeout 5 http://139.162.62.115/
curl -sS --connect-timeout 5 https://139.162.62.115/

# This should work (through Cloudflare)
curl -sS https://cling-ai.com/api/agents
```

### 3.2 Rate Limits Working

```bash
# Send 20 rapid requests - should get blocked after threshold
for i in {1..20}; do curl -sS -o /dev/null -w "%{http_code}\n" "https://cling-ai.com/api/users/sync" -X POST -H "Content-Type: application/json" -d '{"externalUserId":"test","platform":"ios"}'; done
```

### 3.3 Check Cloudflare Headers

```bash
curl -sS -I https://cling-ai.com/ | grep -i cf-
# Should see: cf-ray, cf-cache-status, etc.
```

---

## 4. Environment Variables Checklist

Ensure these are set in production `.env`:

```bash
# REQUIRED - Must not be default
JWT_SECRET=<random-64-char-string>

# REQUIRED - Must be "production"
NODE_ENV=production

# REQUIRED - Disable mock auth
ENABLE_MOCK_AUTH=false

# Webhook secrets (generate random strings)
APPLE_WEBHOOK_SECRET=<random-string>
GOOGLE_WEBHOOK_SECRET=<random-string>
STRIPE_WEBHOOK_SECRET=<random-string>
```

Generate secrets:
```bash
openssl rand -hex 32
```

---

## 5. Monitoring & Alerts

### 5.1 Health Check Endpoint

The backend now exposes: `GET /api/health`

Set up uptime monitoring (e.g., UptimeRobot, Pingdom, or Cloudflare Health Checks):
- URL: `https://cling-ai.com/api/health`
- Expected: HTTP 200, body contains `"status":"ok"`
- Check interval: 1 minute
- Alert on: 2 consecutive failures

### 5.2 Container Monitoring

```bash
# Add to crontab for basic monitoring
*/5 * * * * docker stats --no-stream >> /var/log/docker-stats.log
```

### 5.3 DB Backup

MongoDB Atlas handles backups automatically. Verify:
1. Atlas Dashboard → Backup → Continuous Backup enabled
2. Point-in-time recovery available

For self-hosted MongoDB:
```bash
# Nightly backup script
0 3 * * * mongodump --uri="$MONGO_URI" --out=/backups/$(date +\%Y\%m\%d)
```

---

## 6. Incident Response

If under attack:
1. **Enable Cloudflare "Under Attack" mode**: Security → Settings → I'm Under Attack
2. **Check logs**: `docker logs ai-host-backend --tail 1000`
3. **Block specific IPs/countries** in Cloudflare WAF
4. **Scale down if needed**: `docker-compose down` to stop bleeding

---

## Quick Reference

| Task | Command/Location |
|------|------------------|
| Enable Cloudflare proxy | Cloudflare Dashboard → DNS → Orange cloud |
| Add rate limit | Cloudflare → Security → WAF → Rate limiting |
| Block country | Cloudflare → Security → WAF → Custom rules |
| Check origin exposure | `curl http://139.162.62.115:443` (should fail) |
| Restart backend | `docker-compose restart ai-host-backend` |
| View logs | `docker logs ai-host-backend -f` |
| Health check | `curl https://cling-ai.com/api/health` |
