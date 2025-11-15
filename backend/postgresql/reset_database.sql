-- Скрипт для полной очистки всех таблиц базы данных
-- ВНИМАНИЕ: Этот скрипт удалит ВСЕ данные из базы данных!

-- Отключить проверку внешних ключей временно
SET session_replication_role = 'replica';

-- Удаление данных из всех таблиц в правильном порядке (с учетом внешних ключей)
TRUNCATE TABLE profile_view_requests CASCADE;
TRUNCATE TABLE pending_transfers CASCADE;
TRUNCATE TABLE trades CASCADE;
TRUNCATE TABLE refresh_tokens CASCADE;
TRUNCATE TABLE ownership_history CASCADE;
TRUNCATE TABLE art_objects CASCADE;
TRUNCATE TABLE users CASCADE;

-- Включить проверку внешних ключей обратно
SET session_replication_role = 'origin';

-- Сброс последовательностей (для SERIAL полей)
ALTER SEQUENCE IF EXISTS art_objects_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS ownership_history_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS refresh_tokens_id_seq RESTART WITH 1;

-- Вывод сообщения об успешной очистке
DO $$
BEGIN
    RAISE NOTICE 'База данных успешно очищена!';
END $$;
