# Frontend Dockerfile для Max Photo Gallery
# Multi-stage build для оптимизации размера

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Аргументы для переменных окружения при сборке
ARG VITE_API_URL=http://localhost:8000
ARG VITE_WS_URL=ws://localhost:8000/ws
ARG VITE_APP_NAME="Max Photo Gallery"
ARG VITE_APP_VERSION=1.0.0

# Устанавливаем переменные окружения для Vite
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_VERSION=$VITE_APP_VERSION

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение для production
RUN npm run build

# Stage 2: Production
FROM nginx:alpine

# Копируем собранное приложение из builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем кастомную конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем порт 80
EXPOSE 80

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"]
