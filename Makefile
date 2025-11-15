# Makefile для Max Photo Gallery
# Использование: make <target>

.PHONY: help setup build up down restart logs logs-backend logs-frontend logs-db ps clean backup test dev prod

# Помощь (по умолчанию)
help:
	@echo "================================"
	@echo "Max Photo Gallery - Make Commands"
	@echo "================================"
	@echo ""
	@echo "Основные команды:"
	@echo "  make setup        - Создать .env файл из примера"
	@echo "  make build        - Собрать Docker образы"
	@echo "  make up           - Запустить все сервисы"
	@echo "  make down         - Остановить и удалить контейнеры"
	@echo "  make restart      - Перезапустить все сервисы"
	@echo ""
	@echo "Разработка:"
	@echo "  make dev          - Запустить в режиме разработки"
	@echo "  make dev-build    - Собрать и запустить dev версию"
	@echo ""
	@echo "Логи:"
	@echo "  make logs         - Показать логи всех сервисов"
	@echo "  make logs-backend - Показать логи backend"
	@echo "  make logs-frontend- Показать логи frontend"
	@echo "  make logs-db      - Показать логи базы данных"
	@echo ""
	@echo "Управление:"
	@echo "  make ps           - Показать статус контейнеров"
	@echo "  make backup       - Создать backup базы данных"
	@echo "  make clean        - Удалить контейнеры и volumes"
	@echo "  make test         - Запустить тесты (если есть)"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Запустить в production режиме"
	@echo ""

# Создание .env файла
setup:
	@if [ ! -f .env ]; then \
		cp .env.docker.example .env; \
		echo "✅ Файл .env создан. Отредактируйте его перед запуском!"; \
	else \
		echo "⚠️  Файл .env уже существует"; \
	fi

# Сборка образов
build:
	@echo "🏗️  Сборка Docker образов..."
	docker-compose build

# Запуск сервисов
up: setup
	@echo "🚀 Запуск сервисов..."
	docker-compose up -d
	@echo "✅ Сервисы запущены!"
	@echo "Frontend: http://localhost"
	@echo "Backend: http://localhost:8000"
	@echo "API Docs: http://localhost:8000/docs"

# Остановка сервисов
down:
	@echo "⏹️  Остановка сервисов..."
	docker-compose down
	@echo "✅ Сервисы остановлены"

# Перезапуск
restart:
	@echo "🔄 Перезапуск сервисов..."
	docker-compose restart
	@echo "✅ Сервисы перезапущены"

# Логи
logs:
	docker-compose logs -f --tail=100

logs-backend:
	docker-compose logs -f --tail=100 backend

logs-frontend:
	docker-compose logs -f --tail=100 frontend

logs-db:
	docker-compose logs -f --tail=100 db

# Статус
ps:
	docker-compose ps

# Backup базы данных
backup:
	@echo "💾 Создание backup базы данных..."
	@mkdir -p backups
	@docker-compose exec -T db pg_dump -U app_user app_db > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup создан в директории backups/"

# Очистка
clean:
	@echo "⚠️  Удаление контейнеров и volumes..."
	docker-compose down -v
	@echo "✅ Очистка завершена"

# Режим разработки
dev:
	@echo "🔧 Запуск в режиме разработки..."
	docker-compose -f docker-compose.dev.yml up

dev-build:
	@echo "🔧 Сборка и запуск в режиме разработки..."
	docker-compose -f docker-compose.dev.yml up --build

# Production режим
prod: setup build
	@echo "🚀 Запуск в production режиме..."
	docker-compose up -d
	@sleep 5
	@docker-compose ps
	@echo "✅ Production сервисы запущены!"

# Тесты (если есть)
test:
	@echo "🧪 Запуск тестов..."
	@docker-compose exec backend pytest || echo "⚠️  Тесты не настроены"

# Подключение к базе данных
db-shell:
	docker-compose exec db psql -U app_user -d app_db

# Подключение к backend контейнеру
backend-shell:
	docker-compose exec backend bash

# Пересборка конкретного сервиса
rebuild-backend:
	docker-compose up -d --build backend

rebuild-frontend:
	docker-compose up -d --build frontend

# Проверка здоровья
health:
	@echo "🏥 Проверка здоровья сервисов..."
	@curl -f http://localhost:8000/health || echo "❌ Backend недоступен"
	@curl -f http://localhost/ > /dev/null 2>&1 && echo "✅ Frontend доступен" || echo "❌ Frontend недоступен"

# Обновление (pull, rebuild, restart)
update:
	@echo "📦 Обновление проекта..."
	git pull
	docker-compose build
	docker-compose up -d
	@echo "✅ Обновление завершено"
