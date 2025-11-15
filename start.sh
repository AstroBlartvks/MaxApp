# Скрипт для быстрого старта проекта
# Использование: ./start.sh

#!/bin/bash

set -e

echo "=========================================="
echo "  Max Photo Gallery - Quick Start"
echo "=========================================="
echo ""

# Проверка наличия Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker и попробуйте снова."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose не установлен. Установите Docker Compose и попробуйте снова."
    exit 1
fi

# Проверка наличия .env файла
if [ ! -f .env ]; then
    echo "⚠️  Файл .env не найден. Копирую из .env.docker.example..."
    cp .env.docker.example .env
    echo "✅ Файл .env создан."
    echo ""
    echo "⚠️  ВАЖНО: Отредактируйте .env файл и установите:"
    echo "   - DB_PASSWORD (пароль базы данных)"
    echo "   - BOT_TOKEN (токен бота Max)"
    echo "   - SECRET_KEY и REFRESH_SECRET_KEY (для production)"
    echo ""
    read -p "Продолжить? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Настройте .env и запустите скрипт снова."
        exit 0
    fi
fi

# Проверка критичных переменных
source .env

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "change_me_strong_password_here" ]; then
    echo "⚠️  Предупреждение: DB_PASSWORD не установлен или использует значение по умолчанию!"
fi

if [ -z "$BOT_TOKEN" ] || [ "$BOT_TOKEN" = "YOUR_BOT_TOKEN_HERE" ]; then
    echo "⚠️  Предупреждение: BOT_TOKEN не установлен!"
fi

echo ""
echo "🏗️  Сборка Docker образов..."
docker-compose build

echo ""
echo "🚀 Запуск контейнеров..."
docker-compose up -d

echo ""
echo "⏳ Ожидание инициализации сервисов..."
sleep 10

echo ""
echo "📊 Статус контейнеров:"
docker-compose ps

echo ""
echo "✅ Проект запущен!"
echo ""
echo "🌐 Доступные сервисы:"
echo "   Frontend:  http://localhost"
echo "   Backend:   http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo ""
echo "📝 Полезные команды:"
echo "   Просмотр логов:     docker-compose logs -f"
echo "   Остановка:          docker-compose stop"
echo "   Перезапуск:         docker-compose restart"
echo "   Полная остановка:   docker-compose down"
echo ""
