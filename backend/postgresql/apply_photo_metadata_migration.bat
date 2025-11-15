@echo off
echo Applying photo metadata migration...
echo.

cd /d "%~dp0"

REM Проверка наличия файла миграции
if not exist "migration_add_photo_metadata.sql" (
    echo Error: migration_add_photo_metadata.sql not found!
    pause
    exit /b 1
)

REM Применение миграции через Python
python apply_photo_metadata_migration.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Migration applied successfully!
) else (
    echo.
    echo Migration failed! Check error messages above.
    echo.
    echo Alternative: You can apply manually using psql:
    echo psql -h 127.0.0.1 -U app_user -d app_db -f migration_add_photo_metadata.sql
)

pause
