@echo off
REM Скрипт для просмотра логов

set SERVICE=%1

if "%SERVICE%"=="" (
    echo [INFO] Просмотр логов всех сервисов...
    docker-compose logs -f --tail=100
) else (
    echo [INFO] Просмотр логов сервиса: %SERVICE%
    docker-compose logs -f --tail=100 %SERVICE%
)
