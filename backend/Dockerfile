FROM node:20

WORKDIR /app

COPY package*.json ./

# Video post-processing + Puppeteer/Chrome runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
  ffmpeg \
  ca-certificates \
  wget \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnss3 \
  libnspr4 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libxshmfence1 \
  libxkbcommon0 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libxcb1 \
  libxext6 \
  libxrender1 \
  libxi6 \
  libxtst6 \
  && rm -rf /var/lib/apt/lists/*

RUN npm install

COPY . .

# 容器内部端口，与server.js和nginx配置保持一致
EXPOSE 4000

CMD ["npm", "run", "start"]

