#!/bin/bash

# Script to apply imported_photos migration to the database
# Usage: ./apply_migration.sh

echo "Applying imported_photos migration..."

# Определяем путь к SQL файлу
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/migration_add_imported_photos.sql"

# Применяем миграцию
# Замените параметры подключения на свои
psql -U app_user -d app_db -f "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
else
    echo "❌ Migration failed. Please check the error message above."
    exit 1
fi

# Проверяем, что таблица создана
echo ""
echo "Verifying table creation..."
psql -U app_user -d app_db -c "\d imported_photos"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Table imported_photos verified successfully!"
else
    echo ""
    echo "❌ Table verification failed."
    exit 1
fi
