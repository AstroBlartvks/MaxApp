# Скрипт для быстрого старта проекта (Windows)
# Использование: .\start.bat

@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo   Max Photo Gallery - Quick Start
echo ==========================================
echo.

REM Проверка наличия Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker не установлен. Установите Docker Desktop и попробуйте снова.
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Docker Compose не установлен.
        exit /b 1
    )
)

REM Проверка наличия .env файла
if not exist .env (
    echo [WARNING] Файл .env не найден. Копирую из .env.docker.example...
    copy .env.docker.example .env
    echo [OK] Файл .env создан.
    echo.
    echo [WARNING] ВАЖНО: Отредактируйте .env файл и установите:
    echo    - DB_PASSWORD ^(пароль базы данных^)
    echo    - BOT_TOKEN ^(токен бота Max^)
    echo    - SECRET_KEY и REFRESH_SECRET_KEY ^(для production^)
    echo.
    set /p continue="Продолжить? (y/n): "
    if /i not "!continue!"=="y" (
        echo Настройте .env и запустите скрипт снова.
        exit /b 0
    )
)

echo.
echo [INFO] Сборка Docker образов...
docker-compose build

echo.
echo [INFO] Запуск контейнеров...
docker-compose up -d

echo.
echo [INFO] Ожидание инициализации сервисов...
timeout /t 10 /nobreak >nul

echo.
echo [INFO] Статус контейнеров:
docker-compose ps

echo.
echo [OK] Проект запущен!
echo.
echo Доступные сервисы:
echo    Frontend:  http://localhost
echo    Backend:   http://localhost:8000
echo    API Docs:  http://localhost:8000/docs
echo.
echo Полезные команды:
echo    Просмотр логов:     docker-compose logs -f
echo    Остановка:          docker-compose stop
echo    Перезапуск:         docker-compose restart
echo    Полная остановка:   docker-compose down
echo.

pause
