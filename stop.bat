@echo off
REM Скрипт для остановки проекта

echo Остановка Max Photo Gallery...

docker-compose stop

echo.
echo [OK] Все контейнеры остановлены.
echo.
echo Для полного удаления контейнеров используйте: docker-compose down
echo Для удаления с данными используйте: docker-compose down -v

pause
