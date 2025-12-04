FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# 容器内部端口，与server.js和nginx配置保持一致
EXPOSE 4000

CMD ["npm", "run", "start"]

