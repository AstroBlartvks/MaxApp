# 📚 Documentation Index - Max Photo Gallery

Полный индекс документации проекта с описанием каждого файла.

---

## 🎯 Быстрый старт

Начните здесь, если это ваш первый запуск:

1. **[QUICKSTART.md](QUICKSTART.md)** ⭐ - Запуск за 5 минут
2. **[WINDOWS_GUIDE.md](WINDOWS_GUIDE.md)** 🪟 - Специально для Windows пользователей
3. **[README.md](README.md)** 📖 - Полное руководство

---

## 📖 Основная документация

### Для всех пользователей

| Файл | Описание | Когда читать |
|------|----------|--------------|
| **[README.md](README.md)** | Главное руководство с полной информацией | Первым делом |
| **[WINDOWS_GUIDE.md](WINDOWS_GUIDE.md)** | Руководство для Windows | Если используете Windows |
| **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** | Краткая сводка всего проекта | Для общего понимания |

### Для разработчиков

| Файл | Описание | Когда читать |
|------|----------|--------------|
| **[DOCKER.md](DOCKER.md)** | Детальная Docker архитектура | При работе с Docker |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Визуализация всей архитектуры | Для понимания системы |
| **[ENV_SETUP.md](ENV_SETUP.md)** | Настройка переменных окружения | При настройке .env файлов |

### Для DevOps/Production

| Файл | Описание | Когда читать |
|------|----------|--------------|
| **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** | Чеклист для production запуска | Перед деплоем |
| **[Makefile](Makefile)** | Make команды для автоматизации | При использовании Make |

---

## 🐳 Docker конфигурация

### Основные файлы

| Файл | Тип | Описание |
|------|-----|----------|
| **docker-compose.yml** | Config | Production конфигурация (3 сервиса) |
| **docker-compose.dev.yml** | Config | Development конфигурация с hot-reload |
| **.env.docker.example** | Template | Шаблон переменных окружения для Docker |

### Dockerfiles

| Файл | Назначение |
|------|------------|
| **backend/Dockerfile** | Backend production образ (Python 3.11-slim) |
| **front/Dockerfile** | Frontend production образ (multi-stage: Node + Nginx) |
| **front/Dockerfile.dev** | Frontend development образ (Vite dev server) |

### Конфигурация

| Файл | Назначение |
|------|------------|
| **backend/.dockerignore** | Исключения для backend образа |
| **front/.dockerignore** | Исключения для frontend образа |
| **front/nginx.conf** | Nginx конфигурация для frontend |

---

## 🔧 Скрипты автоматизации

### Windows (.bat)

| Скрипт | Описание | Использование |
|--------|----------|---------------|
| **start.bat** | Запуск всех сервисов | `start.bat` |
| **stop.bat** | Остановка сервисов | `stop.bat` |
| **backup.bat** | Создание backup БД | `backup.bat` |
| **logs.bat** | Просмотр логов | `logs.bat [service]` |

### Linux/Mac (.sh)

| Скрипт | Описание | Использование |
|--------|----------|---------------|
| **start.sh** | Запуск всех сервисов | `./start.sh` |
| **stop.sh** | Остановка сервисов | `./stop.sh` |
| **backup.sh** | Создание backup БД | `./backup.sh` |
| **logs.sh** | Просмотр логов | `./logs.sh [service]` |

### Make команды

```bash
make help         # Показать все команды
make setup        # Создать .env
make build        # Собрать образы
make up           # Запустить
make down         # Остановить
make logs         # Логи
make backup       # Backup БД
make dev          # Dev режим
make test         # Запустить тесты
```

---

## ⚙️ Конфигурационные файлы

### Environment Variables

| Файл | Расположение | Описание |
|------|--------------|----------|
| **.env.docker.example** | Root | Шаблон для Docker Compose |
| **.env.example** | Root | Общий шаблон проекта |
| **backend/.env.example** | Backend | Шаблон для backend |
| **backend/.env** | Backend | Реальные переменные backend (исправлен!) |
| **front/.env.example** | Frontend | Шаблон для frontend |
| **front/.env** | Frontend | Реальные переменные frontend |

### Git

| Файл | Описание |
|------|----------|
| **.gitignore** | Git ignore правила (root) |
| **front/.gitignore** | Git ignore правила (frontend) |

---

## 📂 Структура проекта

```
Proj/
│
├── 📚 ДОКУМЕНТАЦИЯ (13 файлов)
│   ├── README.md                    # Главное руководство
│   ├── QUICKSTART.md                # Быстрый старт
│   ├── WINDOWS_GUIDE.md             # Windows руководство
│   ├── PROJECT_SUMMARY.md           # Сводка проекта
│   ├── DOCKER.md                    # Docker документация
│   ├── ARCHITECTURE.md              # Визуализация архитектуры
│   ├── DEPLOYMENT_CHECKLIST.md      # Production чеклист
│   ├── ENV_SETUP.md                 # Настройка .env
│   ├── DOCUMENTATION_INDEX.md       # Этот файл
│   ├── Makefile                     # Make команды
│   └── backend/
│       ├── README.md                # Backend документация
│       ├── DATABASE_SETUP.md        # Настройка БД
│       └── BACKEND.md               # Backend детали
│   └── front/
│       └── README.md                # Frontend документация
│
├── 🐳 DOCKER (6 файлов)
│   ├── docker-compose.yml           # Production
│   ├── docker-compose.dev.yml       # Development
│   ├── .env.docker.example          # Шаблон переменных
│   ├── backend/Dockerfile           # Backend образ
│   ├── front/Dockerfile             # Frontend prod образ
│   └── front/Dockerfile.dev         # Frontend dev образ
│
├── 🔧 СКРИПТЫ (8 файлов)
│   ├── start.sh / start.bat         # Запуск
│   ├── stop.sh / stop.bat           # Остановка
│   ├── backup.sh / backup.bat       # Backup
│   └── logs.sh / logs.bat           # Логи
│
├── ⚙️ КОНФИГУРАЦИЯ (8+ файлов)
│   ├── .gitignore                   # Git ignore
│   ├── .env.docker.example          # Docker .env шаблон
│   ├── .env.example                 # Общий .env шаблон
│   ├── backend/.env                 # Backend переменные
│   ├── backend/.env.example         # Backend шаблон
│   ├── backend/.dockerignore        # Backend Docker ignore
│   ├── front/.env                   # Frontend переменные
│   ├── front/.env.example           # Frontend шаблон
│   ├── front/.dockerignore          # Frontend Docker ignore
│   └── front/nginx.conf             # Nginx конфигурация
│
├── 🔙 BACKEND
│   ├── app/                         # FastAPI приложение
│   │   ├── main.py                  # Точка входа
│   │   ├── routers/                 # API роутеры
│   │   ├── security.py              # JWT & Auth
│   │   └── schemas.py               # Pydantic модели
│   ├── postgresql/                  # БД скрипты
│   │   ├── database.py              # Подключение
│   │   └── tables.sql               # SQL схемы
│   ├── uploads/                     # Загруженные файлы
│   └── requirements.txt             # Python зависимости
│
└── 🎨 FRONTEND
    ├── src/                         # React исходники
    ├── public/                      # Статические файлы
    ├── package.json                 # Node зависимости
    └── vite.config.js               # Vite конфигурация
```

---

## 📝 Порядок чтения документации

### Для первого запуска:

2. **[ENV_SETUP.md](ENV_SETUP.md)** - Настройте переменные
3. **[README.md](README.md)** - Полное понимание

### Для Windows пользователей:

1. **[WINDOWS_GUIDE.md](WINDOWS_GUIDE.md)** - Все шаги для Windows
3. **[README.md](README.md)** - При необходимости

### Для разработчиков:

1. **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Обзор
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** - Архитектура
3. **[DOCKER.md](DOCKER.md)** - Docker детали
4. **[backend/README.md](backend/README.md)** - Backend API
5. **[front/README.md](front/README.md)** - Frontend


### Переменные окружения
- [ENV_SETUP.md](ENV_SETUP.md) - Детальное руководство
- [.env.docker.example](.env.docker.example) - Шаблон
- [backend/.env.example](backend/.env.example) - Backend шаблон
- [front/.env.example](front/.env.example) - Frontend шаблон

### Архитектура
- [ARCHITECTURE.md](ARCHITECTURE.md) - Визуализация
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Сводка
- [DOCKER.md](DOCKER.md) - Docker архитектура

### Troubleshooting
- [README.md#troubleshooting](README.md#troubleshooting) - Основные проблемы
- [WINDOWS_GUIDE.md#решение-проблем](WINDOWS_GUIDE.md#решение-проблем-на-windows) - Windows проблемы
- [DOCKER.md#мониторинг](DOCKER.md#мониторинг) - Docker мониторинг

### Production
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Полный чеклист
- [README.md#безопасность](README.md#безопасность) - Безопасность
- [DOCKER.md#production-рекомендации](DOCKER.md#production-рекомендации) - Рекомендации

### API
- [backend/README.md](backend/README.md) - Backend документация
- http://localhost:8000/docs - Swagger UI (после запуска)

### Разработка
- [docker-compose.dev.yml](docker-compose.dev.yml) - Dev окружение
- [Makefile](Makefile) - Make команды
- [backend/README.md](backend/README.md) - Backend dev

---

## 📊 Статистика документации

```
Всего файлов документации: 13+
Всего строк кода: ~50,000+
Docker конфигураций: 3
Скриптов автоматизации: 8
Конфигурационных файлов: 10+

Покрытие тем:
✅ Быстрый старт
✅ Детальные инструкции
✅ Windows поддержка
✅ Linux/Mac поддержка
✅ Docker документация
✅ Production чеклист
✅ Troubleshooting
✅ Architecture визуализация
✅ API документация
✅ Примеры кода
✅ Скрипты автоматизации
```

---

## 🎯 Рекомендуемые пути изучения

### Путь 1: "Хочу просто запустить"
```
QUICKSTART.md → start.bat/start.sh → http://localhost
```

### Путь 2: "Хочу понять как это работает"
```
PROJECT_SUMMARY.md → ARCHITECTURE.md → DOCKER.md → README.md
```

### Путь 3: "Хочу развернуть в production"
```
README.md → ENV_SETUP.md → DEPLOYMENT_CHECKLIST.md → DOCKER.md
```

### Путь 4: "Хочу разрабатывать"
```
ARCHITECTURE.md → backend/README.md → front/README.md → docker-compose.dev.yml
```

---

