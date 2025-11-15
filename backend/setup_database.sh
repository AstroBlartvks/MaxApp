#!/bin/bash

# Скрипт для установки базы данных PostgreSQL
# Использование: sudo ./setup_database.sh

set -e

echo "=========================================="
echo "Установка базы данных PostgreSQL"
echo "=========================================="

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Параметры по умолчанию
DB_NAME="${DB_NAME:-app_db}"
DB_USER="${DB_USER:-app_user}"
DB_PASSWORD="${DB_PASSWORD:-password}"

echo -e "${YELLOW}Параметры базы данных:${NC}"
echo "  Имя БД: $DB_NAME"
echo "  Пользователь: $DB_USER"
echo "  Пароль: $DB_PASSWORD"
echo ""

# Проверка прав доступа
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Ошибка: Этот скрипт должен быть запущен с правами sudo${NC}"
    exit 1
fi

# Проверка наличия PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${RED}PostgreSQL не установлен!${NC}"
    echo "Установите PostgreSQL:"
    echo "  Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
    echo "  CentOS/RHEL: sudo yum install postgresql-server postgresql-contrib"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL установлен${NC}"

# Проверка статуса PostgreSQL
if ! systemctl is-active --quiet postgresql; then
    echo "Запуск PostgreSQL..."
    systemctl start postgresql
    systemctl enable postgresql
fi

echo -e "${GREEN}✓ PostgreSQL запущен${NC}"

# Создание базы данных и пользователя
echo ""
echo "Создание базы данных и пользователя..."

sudo -u postgres psql <<EOF
-- Создание базы данных
SELECT 'Создание базы данных $DB_NAME...' AS status;
CREATE DATABASE $DB_NAME;

-- Создание пользователя
SELECT 'Создание пользователя $DB_USER...' AS status;
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    ELSE
        ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- Предоставление прав
SELECT 'Предоставление прав...' AS status;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Подключение к базе данных и предоставление прав на схему
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;

\q
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ База данных и пользователь созданы${NC}"
else
    echo -e "${RED}✗ Ошибка при создании базы данных${NC}"
    exit 1
fi

# Создание таблиц
echo ""
echo "Создание таблиц из database.sql..."

if [ -f "database.sql" ]; then
    PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -d $DB_NAME -f database.sql
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Таблицы созданы${NC}"
    else
        echo -e "${RED}✗ Ошибка при создании таблиц${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Файл database.sql не найден. Пропуск создания таблиц.${NC}"
fi

# Настройка pg_hba.conf
echo ""
echo -e "${YELLOW}Настройка pg_hba.conf для доступа из Docker...${NC}"
echo "Найдите файл pg_hba.conf:"
HBA_FILE=$(sudo -u postgres psql -t -c "SHOW hba_file;" | xargs)
echo "  Файл: $HBA_FILE"

echo ""
echo "Убедитесь, что в файле есть следующие строки:"
echo "  host    all             all             127.0.0.1/32            md5"
echo "  host    all             all             0.0.0.0/0               md5"
echo ""
echo "После редактирования выполните:"
echo "  sudo systemctl reload postgresql"

# Проверка подключения
echo ""
echo "Проверка подключения к базе данных..."
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -d $DB_NAME -c "\dt" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Подключение успешно${NC}"
    echo ""
    echo "Список таблиц:"
    PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -d $DB_NAME -c "\dt"
else
    echo -e "${RED}✗ Ошибка подключения к базе данных${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=========================================="
echo "Установка завершена успешно!"
echo "==========================================${NC}"
echo ""
echo "Следующие шаги:"
echo "1. Настройте .env файл с параметрами подключения к БД"
echo "2. Настройте pg_hba.conf для доступа из Docker (если нужно)"
echo "3. Запустите бэкенд (см. README.md)"
