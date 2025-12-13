# Common proxy parameters - included in API location blocks
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_cache_bypass $http_upgrade;

# Connection timeout only (read/send timeouts set per-location for flexibility)
proxy_connect_timeout 30s;

# Buffer settings
proxy_request_buffering off;
proxy_buffering off;
