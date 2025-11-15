import sys
import os
import asyncio

# Add the project root to the Python path to resolve the 'app' module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import connect_db, close_db, get_connection

async def apply_migration():
    """
    Applies the imported_photos migration.
    """
    await connect_db()
    try:
        # Construct the absolute path to the SQL file
        script_dir = os.path.dirname(__file__)
        sql_file_path = os.path.join(script_dir, 'migration_add_imported_photos.sql')

        with open(sql_file_path, 'r', encoding='utf-8') as f:
            sql_commands = f.read()

        async for conn in get_connection():
            # Execute the SQL commands from the file
            await conn.execute(sql_commands)
            print("Successfully applied imported_photos migration.")

    except FileNotFoundError:
        print(f"Error: The migration file was not found.")
    except Exception as e:
        print(f"An error occurred while applying the migration: {e}")
    finally:
        await close_db()

if __name__ == "__main__":
    print("Applying imported_photos migration...")
    asyncio.run(apply_migration())
