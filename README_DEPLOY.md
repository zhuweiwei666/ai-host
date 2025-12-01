# Deployment Guide

## 1. Frontend Deployment

The frontend is a React Single Page Application (SPA).

### Build
Run the following command in the `frontend` directory:
```bash
npm run build
```
This will generate a `dist` folder.

### Nginx Configuration
Upload the contents of `dist` to your web server (e.g., `/usr/share/nginx/html`).

Configure Nginx to serve the SPA and proxy API requests to the backend.

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /usr/share/nginx/html;
    index index.html;

    # Serve SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Backend
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy Uploads
    location /uploads/ {
        proxy_pass http://localhost:4000/uploads/;
    }
}
```

## 2. Backend Deployment

The backend is a Node.js Express application.

### Setup
1. Navigate to `backend` directory.
2. Install dependencies: `npm install`
3. Create `.env` file based on `.env.production.example`.

### Environment Variables
Set the following in `backend/.env`:

```env
PORT=4000
MONGO_URI=mongodb://user:pass@mongo:27017/ai-host
# Frontend domain for CORS
FRONTEND_DOMAIN=http://your-domain.com
# OpenRouter/Provider Site URL
OPENROUTER_SITE_URL=http://your-domain.com
```

### Start
Use PM2 or similar process manager:
```bash
pm2 start src/server.js --name "ai-host-backend"
```

## 3. Verification

1. Open `http://your-domain.com`.
2. Check network tab to ensure API calls go to `/api/...`.
3. Verify no CORS errors in console.

