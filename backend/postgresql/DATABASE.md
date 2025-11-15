# База данных PostgreSQL

## Описание

База данных для приложения управления цифровыми фотографиями в мессенджере Max. Использует PostgreSQL с асинхронным драйвером `asyncpg` для высокопроизводительных операций.

## Структура базы данных

### Таблицы

#### 1. `users`
Хранит информацию о пользователях из мессенджера.

**Поля:**
- `id` (BIGINT, PRIMARY KEY) - ID пользователя из мессенджера
- `first_name` (VARCHAR(255)) - Имя пользователя
- `last_name` (VARCHAR(255)) - Фамилия пользователя (опционально)
- `username` (VARCHAR(255), UNIQUE) - Username пользователя (опционально)
- `language_code` (VARCHAR(10)) - Код языка пользователя
- `photo_url` (TEXT) - URL фотографии профиля
- `created_at` (TIMESTAMPTZ) - Дата создания записи
- `last_seen_at` (TIMESTAMPTZ) - Дата последней активности

#### 2. `art_objects`
Хранит информацию о цифровых фотографиях (арт-объектах).

**Поля:**
- `id` (SERIAL, PRIMARY KEY) - Внутренний ID арт-объекта
- `owner_id` (BIGINT, FK -> users.id) - Текущий владелец
- `creator_id` (BIGINT, FK -> users.id) - Создатель фотографии
- `file_id` (VARCHAR(255)) - Идентификатор файла
- `file_type` (VARCHAR(50)) - Тип файла (photo, gif и т.д.)
- `is_original` (BOOLEAN) - Флаг оригинала (TRUE) или дубликата (FALSE)
- `original_art_id` (INTEGER, FK -> art_objects.id) - Ссылка на оригинал для дубликатов
- `signature` (TEXT) - Цифровая подпись для проверки подлинности
- `created_at` (TIMESTAMPTZ) - Дата создания
- `description` (TEXT) - Описание фотографии
- `tags` (TEXT[]) - Массив тегов
- `is_public` (BOOLEAN) - Публичная ли фотография

**Индексы:**
- По `owner_id` для быстрого поиска фотографий пользователя
- По `creator_id` для поиска по создателю

#### 3. `ownership_history`
Логирует историю передачи владения фотографиями.

**Поля:**
- `id` (SERIAL, PRIMARY KEY) - ID записи истории
- `art_object_id` (INTEGER, FK -> art_objects.id) - Арт-объект
- `from_user_id` (BIGINT, FK -> users.id) - Отправитель (NULL для создания)
- `to_user_id` (BIGINT, FK -> users.id) - Получатель
- `transfer_date` (TIMESTAMPTZ) - Дата передачи
- `transaction_type` (VARCHAR(50)) - Тип транзакции (creation, transfer, sale)

#### 4. `refresh_tokens`
Хранит refresh токены для JWT аутентификации.

**Поля:**
- `id` (SERIAL, PRIMARY KEY)
- `user_id` (BIGINT, FK -> users.id, ON DELETE CASCADE) - Пользователь
- `token` (VARCHAR(512), UNIQUE) - Токен
- `expires_at` (TIMESTAMPTZ) - Дата истечения
- `created_at` (TIMESTAMPTZ) - Дата создания
- `is_revoked` (BOOLEAN) - Отозван ли токен

**Индексы:**
- `idx_refresh_tokens_user_id` - По user_id
- `idx_refresh_tokens_token` - Уникальный индекс по токену

#### 5. `trades`
Управляет процессом обмена фотографиями между пользователями.

**Поля:**
- `id` (UUID, PRIMARY KEY) - Уникальный идентификатор трейда
- `art_object_id` (INTEGER, FK -> art_objects.id) - Фотография для обмена
- `sender_id` (BIGINT, FK -> users.id) - Отправитель
- `receiver_id` (BIGINT, FK -> users.id) - Получатель (может быть NULL)
- `status` (VARCHAR(50)) - Статус (pending, completed, rejected)
- `share_token` (VARCHAR(8)) - Токен для группировки нескольких трейдов в один QR-код
- `created_at` (TIMESTAMPTZ) - Дата создания
- `expires_at` (TIMESTAMPTZ) - Дата истечения (по умолчанию +5 минут)

**Индексы:**
- `idx_trades_sender_id` - По sender_id
- `idx_trades_receiver_id` - По receiver_id
- `idx_trades_status` - По status
- `idx_trades_share_token` - По share_token

#### 6. `pending_transfers`
Управляет запросами на передачу владения фотографиями.

**Поля:**
- `id` (UUID, PRIMARY KEY) - Уникальный идентификатор запроса
- `photo_id` (INTEGER, FK -> art_objects.id) - Фотография
- `sharer_id` (BIGINT, FK -> users.id) - Текущий владелец
- `scanner_id` (BIGINT, FK -> users.id) - Пользователь, отсканировавший QR
- `status` (VARCHAR(50)) - Статус (pending, accepted, rejected)
- `created_at` (TIMESTAMPTZ) - Дата создания
- `expires_at` (TIMESTAMPTZ) - Дата истечения (по умолчанию +5 минут)

**Индексы:**
- `idx_pending_transfers_sharer_id` - По sharer_id
- `idx_pending_transfers_scanner_id` - По scanner_id
- `idx_pending_transfers_status` - По status

#### 7. `profile_view_requests`
Управляет запросами на просмотр профилей других пользователей.

**Поля:**
- `id` (UUID, PRIMARY KEY) - Уникальный идентификатор запроса
- `requester_id` (BIGINT, FK -> users.id) - Пользователь, запрашивающий доступ
- `target_id` (BIGINT, FK -> users.id) - Владелец профиля
- `status` (VARCHAR(50)) - Статус (pending, approved, rejected)
- `selected_photo_ids` (INTEGER[]) - Массив ID выбранных фотографий при одобрении
- `created_at` (TIMESTAMPTZ) - Дата создания
- `expires_at` (TIMESTAMPTZ) - Дата истечения (по умолчанию +24 часа)

**Индексы:**
- `idx_profile_view_requests_requester_id` - По requester_id
- `idx_profile_view_requests_target_id` - По target_id
- `idx_profile_view_requests_status` - По status
- `idx_profile_view_requests_expires_at` - По expires_at

#### 8. `imported_photos`
Хранит ссылки на импортированные фотографии из профилей других пользователей.

**Поля:**
- `id` (SERIAL, PRIMARY KEY)
- `user_id` (BIGINT, FK -> users.id, ON DELETE CASCADE) - Пользователь, импортировавший фото
- `photo_id` (INTEGER, FK -> art_objects.id, ON DELETE CASCADE) - Импортированная фотография
- `imported_at` (TIMESTAMPTZ) - Дата импорта
- UNIQUE(user_id, photo_id) - Один пользователь может импортировать одно фото только один раз

**Индексы:**
- `idx_imported_photos_user_id` - По user_id
- `idx_imported_photos_photo_id` - По photo_id

#### 9. `favorite_photos`
Хранит избранные фотографии пользователей.

**Поля:**
- `id` (SERIAL, PRIMARY KEY)
- `user_id` (BIGINT, FK -> users.id, ON DELETE CASCADE) - Пользователь
- `photo_id` (INTEGER, FK -> art_objects.id, ON DELETE CASCADE) - Фотография
- `favorited_at` (TIMESTAMPTZ) - Дата добавления в избранное
- UNIQUE(user_id, photo_id) - Один пользователь может добавить одно фото в избранное только один раз

**Индексы:**
- `idx_favorite_photos_user_id` - По user_id
- `idx_favorite_photos_photo_id` - По photo_id

## Подключение к базе данных

### Конфигурация

Подключение настраивается в файле `database.py`:

```python
DATABASE_URL = "postgresql://app_user:password@127.0.0.1:5432/app_db"
```

### Пул соединений

Используется пул соединений `asyncpg.Pool` для эффективного управления подключениями:

```python
_connection_pool: Optional[asyncpg.Pool] = None

async def connect_db():
    """Создает пул соединений к PostgreSQL."""
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = await asyncpg.create_pool(DATABASE_URL)
```

### Основные функции работы с БД

- `connect_db()` - Создание пула соединений
- `close_db()` - Закрытие пула соединений
- `get_connection()` - Получение соединения из пула (контекстный менеджер)
- `upsert_user()` - Создание/обновление пользователя
- `get_user_by_id()` - Получение пользователя по ID
- `create_art_object()` - Создание арт-объекта
- `get_photos_by_owner()` - Получение фотографий пользователя
- `delete_photos_by_ids()` - Удаление фотографий
- `store_refresh_token()` - Сохранение refresh токена
- `get_refresh_token()` - Получение refresh токена

## Миграции

### Применение миграций

Все миграции находятся в директории `backend/postgresql/`:

1. **Создание таблиц** (для новой установки):
   ```bash
   psql -U app_user -d app_db -f postgresql/tables.sql
   ```

2. **Применение отдельных миграций:**
   - `migration_add_profile_view_requests.sql` - Добавление таблицы запросов на просмотр профиля
   - `migration_add_imported_photos.sql` - Добавление таблицы импортированных фото
   - `migration_add_favorites.sql` - Добавление таблицы избранных фото
   - `migration_add_public_photos.sql` - Добавление поддержки публичных фото
   - `migration_add_public_profile.sql` - Добавление поддержки публичных профилей
   - `migration_add_share_token.sql` - Добавление токена для группового обмена
   - `migration_add_photo_metadata.sql` - Добавление метаданных к фотографиям

### Скрипты для миграций

- `apply_migration.sh` - Bash скрипт для применения миграций
- `apply_imported_photos_migration.py` - Python скрипт для миграции импортированных фото
- `apply_photo_metadata_migration.py` - Python скрипт для миграции метаданных

## Права доступа

Пользователь базы данных `app_user` должен иметь следующие права:
- SELECT, INSERT, UPDATE, DELETE на все таблицы
- Использование sequences для автоинкремента ID
- Создание индексов

## Резервное копирование

Рекомендуется настроить регулярное резервное копирование базы данных:

```bash
# Создание дампа
pg_dump -U app_user -d app_db > backup_$(date +%Y%m%d).sql

# Восстановление из дампа
psql -U app_user -d app_db < backup_YYYYMMDD.sql
```

## Производительность

### Оптимизация запросов

1. Используются индексы на часто запрашиваемых полях
2. Пул соединений ограничивает количество одновременных подключений
3. Асинхронные запросы через `asyncpg` обеспечивают высокую производительность

### Мониторинг

Рекомендуется мониторить:
- Размер базы данных
- Количество активных соединений
- Медленные запросы (через `pg_stat_statements`)
- Размер таблиц и индексов

## Безопасность

1. **Пароли:** Хранятся в переменных окружения, не в коде
2. **SQL Injection:** Все запросы используют параметризованные запросы (`$1, $2, ...`)
3. **Права доступа:** Минимальные необходимые права для `app_user`
4. **Каскадное удаление:** Настроено для зависимых таблиц (imported_photos, favorite_photos)

## Устранение неполадок

### Проблема: Ошибка подключения

```bash
# Проверка доступности PostgreSQL
psql -U app_user -d app_db -c "SELECT 1;"

# Проверка прав доступа
psql -U app_user -d app_db -c "\dp"
```

### Проблема: Отсутствует таблица

Применить соответствующую миграцию из директории `postgresql/`.

### Проблема: Медленные запросы

Проверить наличие индексов:
```sql
SELECT * FROM pg_indexes WHERE tablename = 'table_name';
```
