#!/bin/bash
# Скрипт для создания резервной копии базы данных

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql"

# Создаем директорию для бэкапов если её нет
mkdir -p "$BACKUP_DIR"

echo "🗄️  Создание резервной копии базы данных..."

# Создаем бэкап
docker-compose exec -T db pg_dump -U app_user app_db > "$BACKUP_FILE"

# Проверяем размер файла
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo "✅ Резервная копия создана: $BACKUP_FILE (размер: $FILE_SIZE)"
echo ""
echo "Для восстановления используйте:"
echo "cat $BACKUP_FILE | docker-compose exec -T db psql -U app_user -d app_db"
