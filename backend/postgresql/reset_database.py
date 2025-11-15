#!/usr/bin/env python3
"""
Скрипт для полной очистки базы данных.
ВНИМАНИЕ: Этот скрипт удалит ВСЕ данные из базы данных!
"""
import sys
import os
import asyncio

# Add the project root to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import connect_db, close_db, get_connection

async def reset_database():
    """
    Выполняет SQL команды для очистки всех таблиц базы данных.
    """
    await connect_db()
    try:
        # Construct the absolute path to the SQL file
        script_dir = os.path.dirname(__file__)
        sql_file_path = os.path.join(script_dir, 'reset_database.sql')

        with open(sql_file_path, 'r', encoding='utf-8') as f:
            sql_commands = f.read()

        async for conn in get_connection():
            # Execute the SQL commands from the file
            await conn.execute(sql_commands)
            print("✅ База данных успешно очищена!")
            print("   Все таблицы были очищены, последовательности сброшены.")

    except FileNotFoundError:
        print(f"❌ Ошибка: Файл 'reset_database.sql' не найден.")
    except Exception as e:
        print(f"❌ Произошла ошибка при очистке базы данных: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await close_db()

if __name__ == "__main__":
    print("⚠️  ВНИМАНИЕ: Этот скрипт удалит ВСЕ данные из базы данных!")
    response = input("Вы уверены, что хотите продолжить? (yes/no): ")
    
    if response.lower() in ['yes', 'y', 'да', 'д']:
        print("\nОчистка базы данных...")
        asyncio.run(reset_database())
    else:
        print("Операция отменена.")
