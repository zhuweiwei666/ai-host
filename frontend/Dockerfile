FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build



FROM nginx:latest

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Create SSL directory and copy certificates
RUN mkdir -p /etc/nginx/ssl
COPY ssl/cling-ai.com.crt /etc/nginx/ssl/cling-ai.com.crt
COPY ssl/cling-ai.com.key /etc/nginx/ssl/cling-ai.com.key

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]

