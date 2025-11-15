#!/bin/bash
# Скрипт для просмотра логов

SERVICE=$1

if [ -z "$SERVICE" ]; then
    echo "Просмотр логов всех сервисов..."
    docker-compose logs -f --tail=100
else
    echo "Просмотр логов сервиса: $SERVICE"
    docker-compose logs -f --tail=100 "$SERVICE"
fi
