# Frontend Dockerfile для Max Photo Gallery
FROM node:20-alpine

# Установка рабочей директории
WORKDIR /app

# Копирование package файлов
COPY package*.json ./

# Установка зависимостей
RUN npm install

# Копирование всех файлов проекта
COPY . .

# Сборка проекта
RUN npm run build

# Объявление переменной для порта
ARG VITE_DEV_PORT=5444
# Открытие порта для npm preview
EXPOSE $VITE_DEV_PORT

# Запуск preview сервера с указанием порта
# Использует переменную окружения VITE_DEV_PORT, если она задана, иначе 5444
CMD ["sh", "-c", "npm run preview -- --port ${VITE_DEV_PORT:-5444}"]
