@echo off
REM Скрипт для создания резервной копии базы данных

setlocal

set BACKUP_DIR=backups
set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_FILE=%BACKUP_DIR%\db_backup_%TIMESTAMP%.sql

REM Создаем директорию для бэкапов если её нет
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo [INFO] Создание резервной копии базы данных...

REM Создаем бэкап
docker-compose exec -T db pg_dump -U app_user app_db > "%BACKUP_FILE%"

echo [OK] Резервная копия создана: %BACKUP_FILE%
echo.
echo Для восстановления используйте:
echo type %BACKUP_FILE% ^| docker-compose exec -T db psql -U app_user -d app_db

pause
