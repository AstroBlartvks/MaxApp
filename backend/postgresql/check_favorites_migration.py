#!/usr/bin/env python3
"""
Скрипт для проверки и применения миграции favorite_photos
"""
import asyncio
import asyncpg
import os

async def check_and_apply_migration():
    # Параметры подключения (измените если нужно)
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = os.getenv('DB_PORT', '5432')
    DB_NAME = os.getenv('DB_NAME', 'app_db')
    DB_USER = os.getenv('DB_USER', 'app_user')
    DB_PASS = os.getenv('DB_PASS', 'your_password')
    
    try:
        # Подключение к БД
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS
        )
        
        print("✅ Подключение к БД успешно")
        
        # Проверить наличие таблицы
        table_exists = await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'favorite_photos'
            )
            """
        )
        
        if table_exists:
            print("✅ Таблица favorite_photos уже существует")
            
            # Показать статистику
            count = await conn.fetchval("SELECT COUNT(*) FROM favorite_photos")
            print(f"   Записей в таблице: {count}")
            
        else:
            print("❌ Таблица favorite_photos не найдена")
            print("📝 Применяем миграцию...")
            
            # Читаем и применяем миграцию
            migration_path = os.path.join(os.path.dirname(__file__), 'migration_add_favorites.sql')
            
            if not os.path.exists(migration_path):
                print(f"❌ Файл миграции не найден: {migration_path}")
                return
            
            with open(migration_path, 'r', encoding='utf-8') as f:
                migration_sql = f.read()
            
            # Применяем миграцию
            await conn.execute(migration_sql)
            print("✅ Миграция применена успешно!")
            
        # Проверить права
        print("\n📋 Проверка прав доступа...")
        grants = await conn.fetch(
            """
            SELECT privilege_type 
            FROM information_schema.role_table_grants 
            WHERE table_name='favorite_photos' AND grantee=$1
            """,
            DB_USER
        )
        
        if grants:
            privileges = [g['privilege_type'] for g in grants]
            print(f"✅ Права для {DB_USER}: {', '.join(privileges)}")
        else:
            print(f"⚠️  Нет прав для {DB_USER}")
            print("   Выдаём права...")
            await conn.execute(
                """
                GRANT SELECT, INSERT, UPDATE, DELETE ON favorite_photos TO app_user;
                GRANT USAGE, SELECT ON SEQUENCE favorite_photos_id_seq TO app_user;
                """
            )
            print("✅ Права выданы")
        
        await conn.close()
        print("\n✅ Всё готово! Избранное должно работать.")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_and_apply_migration())
