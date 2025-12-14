FROM node:20

WORKDIR /app

COPY package*.json ./

# Video post-processing (aspect ratio, iOS-friendly encoding)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN npm install

COPY . .

# 容器内部端口，与server.js和nginx配置保持一致
EXPOSE 4000

CMD ["npm", "run", "start"]

