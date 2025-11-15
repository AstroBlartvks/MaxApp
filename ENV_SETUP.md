# Настройка переменных окружения

## Описание

Проект использует файлы `.env` для хранения конфигурационных данных, таких как пароли, токены, пути к базам данных и другие чувствительные настройки.

## Структура .env файлов

Проект содержит три `.env.example` файла:

1. **`.env.example`** (корень проекта) - общие настройки проекта
2. **`backend/.env.example`** - настройки backend API
3. **`front/.env.example`** - настройки frontend приложения

## Быстрая настройка

### 1. Backend

```bash
cd backend
cp .env.example .env
# Отредактируйте .env и заполните реальными значениями
```

### 2. Frontend

```bash
cd front
cp .env.example .env
# Отредактируйте .env и заполните реальными значениями
```

### 3. Корневой .env (опционально)

```bash
cp .env.example .env
# Отредактируйте .env для общих настроек
```

## Важные переменные окружения

### Backend (`backend/.env`)

#### Обязательные:

- `DATABASE_URL` - строка подключения к PostgreSQL
- `SECRET_KEY` - секретный ключ для JWT access токенов
- `REFRESH_SECRET_KEY` - секретный ключ для JWT refresh токенов
- `BOT_TOKEN` - токен бота мессенджера Max

#### Рекомендуемые:

- `BASE_URL` - базовый URL API (для формирования ссылок на файлы)
- `CORS_ORIGINS` - разрешенные домены для CORS
- `UPLOADS_DIR` - директория для загруженных файлов

### Frontend (`front/.env`)

#### Обязательные:

- `VITE_API_URL` - URL backend API

#### Опциональные:

- `VITE_WS_URL` - URL WebSocket сервера
- `VITE_DEBUG` - включить режим отладки
- `VITE_ENABLE_ERUDA` - включить Eruda для мобильной отладки

## Генерация секретных ключей

Для генерации безопасных секретных ключей используйте:

```bash
# Python
python -c "import secrets; print(secrets.token_hex(32))"

# OpenSSL
openssl rand -hex 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Безопасность

### ⚠️ ВАЖНО:

1. **Никогда не коммитьте `.env` файлы в git!**
   - Файл `.gitignore` уже настроен для исключения `.env` файлов
   - Используйте `.env.example` как шаблон

2. **Используйте разные ключи для production и development:**
   - Не используйте production ключи в development окружении
   - Генерируйте новые ключи для каждого окружения

3. **Храните секреты в безопасности:**
   - В production используйте переменные окружения системы
   - Или используйте секреты в вашей платформе развертывания (Docker secrets, Kubernetes secrets, etc.)

4. **Регулярно ротируйте токены и ключи:**
   - Особенно если они были скомпрометированы
   - Обновляйте `BOT_TOKEN` при необходимости

## Примеры конфигурации

### Development (backend/.env)

```env
DATABASE_URL=postgresql://app_user:dev_password@localhost:5432/app_db_dev
SECRET_KEY=dev_secret_key_here
REFRESH_SECRET_KEY=dev_refresh_secret_key_here
BOT_TOKEN=dev_bot_token_here
BASE_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
DEBUG=true
```

### Production (backend/.env)

```env
DATABASE_URL=postgresql://app_user:STRONG_PASSWORD@db.example.com:5432/app_db
SECRET_KEY=<сгенерированный_32_байтный_ключ>
REFRESH_SECRET_KEY=<другой_сгенерированный_32_байтный_ключ>
BOT_TOKEN=<production_bot_token>
BASE_URL=https://api.whitea.cloud
CORS_ORIGINS=https://whitea.cloud,https://www.whitea.cloud
DEBUG=false
```

### Frontend (front/.env)

```env
VITE_API_URL=https://api.whitea.cloud
VITE_WS_URL=wss://api.whitea.cloud/ws
VITE_DEBUG=false
```

## Проверка конфигурации

После настройки `.env` файлов проверьте:

1. **Backend:**
   ```bash
   cd backend
   python -c "from dotenv import load_dotenv; import os; load_dotenv(); print('DATABASE_URL:', os.getenv('DATABASE_URL'))"
   ```

2. **Frontend:**
   ```bash
   cd front
   npm run dev
   # Проверьте в консоли браузера, что VITE_API_URL загружен правильно
   ```

## Troubleshooting

### Проблема: Переменные окружения не загружаются

**Решение:**
1. Убедитесь, что файл `.env` существует в правильной директории
2. Проверьте, что нет опечаток в названиях переменных
3. Перезапустите приложение после изменения `.env`

### Проблема: Frontend не видит переменные с префиксом VITE_

**Решение:**
- В Vite только переменные с префиксом `VITE_` доступны в клиентском коде
- Перезапустите dev-сервер после изменения `.env`

### Проблема: Backend не подключается к базе данных

**Решение:**
1. Проверьте `DATABASE_URL` в `.env`
2. Убедитесь, что PostgreSQL запущен
3. Проверьте права доступа пользователя БД

## Дополнительная информация

- [Python-dotenv документация](https://github.com/theskumar/python-dotenv)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [FastAPI Configuration](https://fastapi.tiangolo.com/advanced/settings/)
