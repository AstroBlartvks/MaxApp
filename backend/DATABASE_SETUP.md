# Инструкция по установке базы данных PostgreSQL

## Требования

- PostgreSQL 12 или выше
- Права суперпользователя для создания базы данных и пользователя

## Шаг 1: Установка PostgreSQL

### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

### CentOS/RHEL:
```bash
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
```

### macOS (Homebrew):
```bash
brew install postgresql
brew services start postgresql
```

## Шаг 2: Создание базы данных и пользователя

Подключитесь к PostgreSQL как суперпользователь:

```bash
sudo -u postgres psql
```

Или если используете другого пользователя:
```bash
psql -U postgres
```

Выполните следующие SQL команды:

```sql
-- Создание пользователя
CREATE USER app_user WITH PASSWORD 'password';

-- Создание базы данных
CREATE DATABASE app_db OWNER app_user;

-- Предоставление прав
GRANT ALL PRIVILEGES ON DATABASE app_db TO app_user;

-- Выход из psql
\q
```

## Шаг 3: Настройка pg_hba.conf для доступа из Docker

Найдите файл `pg_hba.conf`:
```bash
sudo -u postgres psql -c "SHOW hba_file;"
```

Отредактируйте файл (обычно `/etc/postgresql/*/main/pg_hba.conf`):

```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

Добавьте или измените строки для локальных подключений:

```
# Локальные подключения
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5

# Для подключений из Docker (если используется network_mode: host)
host    app_db          app_user       127.0.0.1/32             md5
```

Если используете внешний IP, добавьте:
```
host    app_db          app_user       YOUR_IP/32               md5
```

Перезагрузите PostgreSQL:
```bash
sudo systemctl reload postgresql
# или
sudo systemctl restart postgresql
```

## Шаг 4: Создание таблиц

Примените SQL скрипт для создания таблиц:

```bash
psql -U app_user -d app_db -f postgresql/tables.sql
```

Или через Python скрипт:
```bash
cd postgresql
python3 create_tables.py
```

## Шаг 5: Применение миграций (если необходимо)

Примените миграции в порядке их создания:

```bash
# Миграция запросов на просмотр профиля
psql -U app_user -d app_db -f postgresql/migration_add_profile_view_requests.sql

# Миграция импортированных фото
psql -U app_user -d app_db -f postgresql/migration_add_imported_photos.sql

# Миграция избранных фото
psql -U app_user -d app_db -f postgresql/migration_add_favorites.sql

# Миграция публичных фото
psql -U app_user -d app_db -f postgresql/migration_add_public_photos.sql

# Миграция публичного профиля
psql -U app_user -d app_db -f postgresql/migration_add_public_profile.sql

# Миграция токена для обмена
psql -U app_user -d app_db -f postgresql/migration_add_share_token.sql

# Миграция метаданных фото
psql -U app_user -d app_db -f postgresql/migration_add_photo_metadata.sql

# Миграция контактной ссылки
psql -U app_user -d app_db -f postgresql/migration_add_contact_link.sql
```

Или используйте скрипт:
```bash
bash postgresql/apply_migration.sh
```

## Шаг 6: Проверка подключения

Проверьте подключение к базе данных:

```bash
psql -U app_user -d app_db -c "SELECT version();"
```

Должна вернуться информация о версии PostgreSQL.

## Удаление базы данных

Если нужно полностью удалить базу данных:

```bash
psql -U postgres -f drop_database.sql
```

Или вручную:
```bash
sudo -u postgres psql
```

```sql
DROP DATABASE IF EXISTS app_db;
DROP USER IF EXISTS app_user;
```

## Резервное копирование

### Создание дампа:
```bash
pg_dump -U app_user -d app_db > backup_$(date +%Y%m%d).sql
```

### Восстановление из дампа:
```bash
psql -U app_user -d app_db < backup_YYYYMMDD.sql
```

## Очистка данных (без удаления структуры)

Если нужно очистить все данные, но сохранить структуру:

```bash
psql -U app_user -d app_db -f postgresql/reset_database.sql
```

## Troubleshooting

### Ошибка: "no pg_hba.conf entry"
- Убедитесь, что добавили запись в `pg_hba.conf`
- Перезагрузите PostgreSQL после изменений

### Ошибка: "password authentication failed"
- Проверьте пароль в `.env` файле
- Убедитесь, что пользователь создан правильно

### Ошибка: "database does not exist"
- Убедитесь, что база данных создана
- Проверьте имя базы данных в `.env`

### Ошибка подключения из Docker
- Используйте `network_mode: host` в docker-compose.yml
- Или настройте правильный IP в `pg_hba.conf`
