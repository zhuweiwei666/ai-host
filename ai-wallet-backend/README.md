# AI Wallet Backend

Dedicated wallet service for AI-related virtual currency (AI coins).

## Features

- Separate micro-service for AI wallet
- Does NOT create users, **userId comes from main system**
- Endpoints:
  - `GET /api/ai-wallet/health`
  - `GET /api/ai-wallet/balance?userId=...`
  - `POST /api/ai-wallet/recharge`
  - `POST /api/ai-wallet/consume`
  - `POST /api/ai-wallet/reward/ad`

## Env

Copy `.env.example` to `.env` and fill:

```env
PORT=4100
MONGO_URI=your-mongodb-uri
SERVICE_NAME=ai-wallet
WALLET_SERVICE_KEY=changeme
```

## Run

```bash
npm install
cp .env.example .env
# Edit .env
npm run dev
```
