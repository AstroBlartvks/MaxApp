-- ============================================
-- Скрипт для удаления базы данных
-- ============================================
-- ВНИМАНИЕ: Этот скрипт удалит ВСЮ базу данных!
-- Использование: psql -U postgres -f drop_database.sql

-- Отключить все активные подключения к базе данных
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'app_db'
  AND pid <> pg_backend_pid();

-- Удалить базу данных
DROP DATABASE IF EXISTS app_db;

-- Удалить пользователя (опционально, раскомментируйте если нужно)
-- DROP USER IF EXISTS app_user;

-- Вывод сообщения
DO $$
BEGIN
    RAISE NOTICE 'База данных app_db успешно удалена!';
END $$;
