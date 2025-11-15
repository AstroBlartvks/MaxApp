# Используем официальный образ Python
FROM python:3.11-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем системные зависимости для PostgreSQL и других библиотек
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Копируем файл зависимостей
COPY requirements.txt .

# Устанавливаем Python зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь код приложения
COPY . .

# Создаем директорию для загрузок, если её нет
RUN mkdir -p uploads

# Открываем порт (по умолчанию 8000, можно переопределить через переменные окружения)
EXPOSE 8000

# Команда запуска приложения
# Используем переменные окружения для хоста и порта
CMD ["sh", "-c", "uvicorn app.main:app --host ${SERVER_HOST:-0.0.0.0} --port ${SERVER_PORT:-8000}"]
