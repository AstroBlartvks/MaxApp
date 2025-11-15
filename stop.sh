#!/bin/bash
# Скрипт для остановки проекта

set -e

echo "Остановка Max Photo Gallery..."

# Остановка контейнеров
docker-compose stop

echo "✅ Все контейнеры остановлены."
echo ""
echo "Для полного удаления контейнеров используйте: docker-compose down"
echo "Для удаления с данными используйте: docker-compose down -v"
