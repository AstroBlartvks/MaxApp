import sys
import os
import asyncio

# Add the project root to the Python path to resolve the 'app' module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import connect_db, close_db, get_connection

async def create_tables():
    """
    Reads the tables.sql file and executes the SQL commands to create the database tables.
    """
    await connect_db()
    try:
        # Construct the absolute path to the SQL file
        script_dir = os.path.dirname(__file__)
        sql_file_path = os.path.join(script_dir, 'tables.sql')

        with open(sql_file_path, 'r', encoding='utf-8') as f:
            sql_commands = f.read()

        async for conn in get_connection():
            # Execute the SQL commands from the file
            await conn.execute(sql_commands)
            print("Successfully created database tables.")

    except FileNotFoundError:
        print(f"Error: The file 'tables.sql' was not found in the same directory.")
    except Exception as e:
        print(f"An error occurred while creating the tables: {e}")
    finally:
        await close_db()

if __name__ == "__main__":
    print("Setting up database schema...")
    asyncio.run(create_tables())
