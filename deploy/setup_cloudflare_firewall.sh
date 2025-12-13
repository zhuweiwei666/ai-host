#!/bin/bash
# Setup firewall to only allow Cloudflare IPs to access HTTP/HTTPS
# Run on the origin server (139.162.62.115)

set -e

echo "=== Cloudflare Firewall Setup ==="
echo "This will configure iptables to only allow Cloudflare IPs on ports 80/443"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo $0"
  exit 1
fi

# Backup current rules
echo "[1/6] Backing up current iptables rules..."
iptables-save > /tmp/iptables-backup-$(date +%Y%m%d%H%M%S).rules
echo "Backup saved to /tmp/"

# Get Cloudflare IP ranges
echo "[2/6] Fetching Cloudflare IP ranges..."
CF_IPS_V4=$(curl -s https://www.cloudflare.com/ips-v4)
CF_IPS_V6=$(curl -s https://www.cloudflare.com/ips-v6)

if [ -z "$CF_IPS_V4" ]; then
  echo "ERROR: Could not fetch Cloudflare IPs. Aborting."
  exit 1
fi

echo "Found $(echo "$CF_IPS_V4" | wc -l) IPv4 ranges"

# Create new rules
echo "[3/6] Creating iptables rules..."

# Flush existing rules for ports 80/443 only (safer than full flush)
iptables -D INPUT -p tcp --dport 80 -j DROP 2>/dev/null || true
iptables -D INPUT -p tcp --dport 443 -j DROP 2>/dev/null || true

# Remove old Cloudflare rules (if any)
iptables-save | grep -v "cloudflare" | iptables-restore 2>/dev/null || true

# Allow Cloudflare IPs
for ip in $CF_IPS_V4; do
  iptables -A INPUT -p tcp -s $ip --dport 80 -m comment --comment "cloudflare" -j ACCEPT
  iptables -A INPUT -p tcp -s $ip --dport 443 -m comment --comment "cloudflare" -j ACCEPT
done

# Drop other traffic to 80/443
iptables -A INPUT -p tcp --dport 80 -j DROP
iptables -A INPUT -p tcp --dport 443 -j DROP

echo "[4/6] Saving iptables rules..."
iptables-save > /etc/iptables.rules

# Ensure rules persist on reboot
echo "[5/6] Setting up persistence..."
if [ -f /etc/debian_version ]; then
  # Debian/Ubuntu
  apt-get install -y iptables-persistent 2>/dev/null || true
  netfilter-persistent save 2>/dev/null || iptables-save > /etc/iptables/rules.v4
elif [ -f /etc/redhat-release ]; then
  # CentOS/RHEL
  service iptables save
fi

echo "[6/6] Verifying..."
echo ""
echo "Current rules for ports 80/443:"
iptables -L INPUT -n | grep -E "(80|443)"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Verify origin is protected:"
echo "  curl -sS --connect-timeout 5 http://$(hostname -I | awk '{print $1}')/"
echo "  (Should timeout or refuse connection)"
echo ""
echo "To revert: iptables-restore < /tmp/iptables-backup-*.rules"
