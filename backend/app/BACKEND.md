# Backend API

## Описание

Backend приложения для управления цифровыми фотографиями в мессенджере Max. Построен на FastAPI с использованием PostgreSQL и асинхронного программирования.

## Технологический стек

- **FastAPI** - современный веб-фреймворк для Python
- **PostgreSQL** - реляционная база данных
- **asyncpg** - асинхронный драйвер для PostgreSQL
- **Pydantic** - валидация данных
- **JWT** - аутентификация через токены
- **WebSocket** - реальное время обновлений
- **Python 3.10+** - язык программирования

## Структура проекта

```
backend/
├── app/
│   ├── main.py              # Точка входа приложения
│   ├── security.py          # Аутентификация и авторизация
│   ├── schemas.py           # Pydantic схемы для валидации
│   ├── logging_config.py    # Настройка логирования
│   └── routers/             # API роутеры
│       ├── auth.py          # Аутентификация
│       ├── photos.py        # Управление фотографиями
│       ├── trades.py        # Обмен фотографиями
│       ├── transfers.py     # Передача фотографий
│       ├── profile_requests.py  # Запросы на просмотр профиля
│       ├── websocket.py     # WebSocket соединения
│       └── health.py        # Проверка здоровья сервиса
├── postgresql/
│   ├── database.py          # Работа с БД
│   └── tables.sql           # Схема БД
└── requirements.txt         # Зависимости
```

## API Endpoints

### Аутентификация (`/auth`)

#### POST `/auth/login`
Вход пользователя через данные из мессенджера Max.

**Request:**
```json
{
  "init_data": "query_id=...&user=...&hash=..."
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "refresh_token": "eyJ...",
  "is_new_user": false
}
```

#### POST `/auth/refresh`
Обновление access токена через refresh токен.

**Request:**
```json
{
  "refresh_token": "eyJ..."
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

### Фотографии (`/api/photos`)

Все endpoints требуют аутентификации через Bearer токен.

#### GET `/api/photos/`
Получение всех фотографий текущего пользователя (включая импортированные).

**Response:**
```json
[
  {
    "id": 1,
    "url": "https://api.whitea.cloud/uploads/file_id",
    "file_id": "file_id",
    "created_at": "2024-01-01T00:00:00Z",
    "is_imported": false,
    "is_own": true,
    "description": null,
    "tags": [],
    "is_public": false
  }
]
```

#### POST `/api/photos/upload`
Загрузка одной или нескольких фотографий.

**Request:** `multipart/form-data`
- `files`: массив файлов изображений

**Response:** Массив созданных фотографий

#### DELETE `/api/photos/{photo_id}`
Удаление фотографии по ID.

#### POST `/api/photos/{photo_id}/favorite`
Добавление фотографии в избранное.

#### DELETE `/api/photos/{photo_id}/favorite`
Удаление фотографии из избранного.

#### GET `/api/photos/favorites`
Получение всех избранных фотографий.

#### GET `/api/photos/public`
Получение публичных фотографий всех пользователей.

#### PUT `/api/photos/{photo_id}/metadata`
Обновление метаданных фотографии (описание, теги, публичность).

**Request:**
```json
{
  "description": "Описание",
  "tags": ["tag1", "tag2"],
  "is_public": true
}
```

### Обмен фотографиями (`/trades`)

#### POST `/trades/create-share`
Создание обмена с несколькими фотографиями (один QR-код).

**Request:**
```json
{
  "art_object_ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "share_token": "ABC12345",
  "trade_count": 3
}
```

#### POST `/trades/scan-share-token`
Сканирование QR-кода для получения фотографий.

**Request:**
```json
{
  "share_token": "ABC12345"
}
```

**Response:**
```json
{
  "trade_count": 3,
  "trades": [
    {
      "trade_id": "uuid",
      "file_id": "file_id",
      "status": "pending"
    }
  ]
}
```

#### GET `/trades/scanned`
Получение всех отсканированных трейдов, ожидающих подтверждения.

**Response:**
```json
[
  {
    "trade_id": "uuid",
    "file_id": "file_id",
    "sender_id": 123,
    "status": "pending"
  }
]
```

#### POST `/trades/{trade_id}/confirm`
Подтверждение трейда.

#### POST `/trades/{trade_id}/reject`
Отклонение трейда.

### Передача фотографий (`/api/transfers`)

#### POST `/api/transfers/initiate`
Создание запроса на передачу фотографии.

**Request:**
```json
{
  "photo_file_id": "file_id"
}
```

#### GET `/api/transfers/pending`
Получение ожидающих запросов на передачу.

#### POST `/api/transfers/{transfer_id}/accept`
Принятие запроса на передачу.

#### POST `/api/transfers/{transfer_id}/reject`
Отклонение запроса на передачу.

### Запросы на просмотр профиля (`/api/profile-requests`)

#### POST `/api/profile-requests/create`
Создание запроса на просмотр профиля пользователя.

**Request:**
```json
{
  "target_user_id": 123
}
```

#### GET `/api/profile-requests/pending`
Получение ожидающих запросов на просмотр профиля.

#### POST `/api/profile-requests/{request_id}/approve`
Одобрение запроса с выбором фотографий для показа.

**Request:**
```json
{
  "selected_photo_ids": [1, 2, 3]
}
```

#### POST `/api/profile-requests/{request_id}/reject`
Отклонение запроса.

#### GET `/api/profile-requests/{request_id}/photos`
Получение фотографий из одобренного запроса.

### Профили пользователей (`/api/profile`)

#### GET `/api/profile/{user_id}`
Получение информации о профиле пользователя.

#### GET `/api/profile/{user_id}/photos`
Получение фотографий профиля пользователя (с учетом прав доступа).

#### POST `/api/profile/{user_id}/import-photo/{photo_id}`
Импорт фотографии из профиля другого пользователя.

#### GET `/api/profile/settings`
Получение настроек профиля текущего пользователя.

#### PUT `/api/profile/settings`
Обновление настроек профиля.

**Request:**
```json
{
  "is_public_profile": true,
  "contact_link": "https://..."
}
```

### WebSocket (`/ws`)

#### WebSocket `/ws?user_id={user_id}`
Подключение для получения обновлений в реальном времени.

**Сообщения от сервера:**
```json
{
  "type": "materials_updated",
  "message": "Материалы обновлены"
}
```

```json
{
  "type": "profile_view_request",
  "message": "Пользователь запрашивает доступ к вашему профилю"
}
```

### Health Check (`/health`)

#### GET `/health`
Проверка работоспособности сервиса.

**Response:**
```json
{
  "status": "healthy"
}
```

## Аутентификация

### JWT Tokens

Приложение использует два типа токенов:

1. **Access Token** - короткоживущий токен (30 минут) для доступа к API
2. **Refresh Token** - долгоживущий токен (30 дней) для обновления access токена

### Использование токенов

Все защищенные endpoints требуют заголовок:
```
Authorization: Bearer <access_token>
```

### Валидация InitData

При входе валидируется `init_data` от мессенджера Max через HMAC-SHA256 для обеспечения безопасности.

## Обработка ошибок

### Стандартные коды ответов

- `200` - Успешный запрос
- `201` - Ресурс создан
- `204` - Успешный запрос без тела ответа
- `400` - Неверный запрос
- `401` - Не авторизован
- `403` - Доступ запрещен
- `404` - Ресурс не найден
- `422` - Ошибка валидации
- `500` - Внутренняя ошибка сервера

### Формат ошибки

```json
{
  "detail": "Описание ошибки"
}
```

Для ошибок валидации:
```json
{
  "detail": "Validation error",
  "errors": [
    {
      "loc": ["body", "field"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

## CORS

Настроен CORS для следующих доменов:
- `https://whitea.cloud`
- `https://api.whitea.cloud`
- `http://localhost`
- `http://localhost:8080`
- `http://localhost:5173`

## Логирование

Логирование настроено в `logging_config.py`. Все логи записываются в:
- Консоль (stdout)
- Файл `error.log` (только ошибки)

## Статические файлы

Загруженные фотографии доступны по пути:
```
/uploads/{file_id}
```

Директория монтируется через FastAPI StaticFiles.

## Развертывание

### Установка зависимостей

```bash
pip install -r requirements.txt
```

### Настройка переменных окружения

Создайте файл `.env` или установите переменные окружения:
- `DATABASE_URL` - URL подключения к PostgreSQL
- `SECRET_KEY` - Секретный ключ для JWT
- `REFRESH_SECRET_KEY` - Секретный ключ для refresh токенов
- `BOT_TOKEN` - Токен бота мессенджера Max

### Запуск приложения

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Production

Рекомендуется использовать:
- **Gunicorn** с Uvicorn workers для production
- **Nginx** как reverse proxy
- **SSL/TLS** сертификаты (Let's Encrypt)
- **Supervisor** или **systemd** для управления процессом

Пример команды для Gunicorn:
```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Безопасность

1. **Валидация данных:** Все входные данные валидируются через Pydantic
2. **SQL Injection:** Используются параметризованные запросы
3. **JWT:** Токены подписываются и проверяются
4. **CORS:** Настроены только разрешенные домены
5. **Хеширование:** InitData проверяется через HMAC-SHA256

## Мониторинг

Рекомендуется настроить мониторинг:
- Логи приложения
- Метрики производительности
- Мониторинг базы данных
- Алерты на ошибки

## Тестирование

Для тестирования API можно использовать:
- **curl** - командная строка
- **Postman** - GUI инструмент
- **httpie** - удобная альтернатива curl
- **Swagger UI** - автоматически генерируется FastAPI по адресу `/docs`

## Документация API

FastAPI автоматически генерирует интерактивную документацию:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
