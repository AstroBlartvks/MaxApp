import asyncio
import asyncpg
import os
from dotenv import load_dotenv

async def main():
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("Error: DATABASE_URL not set in environment")
        return
    
    conn = await asyncpg.connect(database_url)
    
    try:
        with open('migration_add_public_photos.sql', 'r', encoding='utf-8') as f:
            migration_sql = f.read()
        
        await conn.execute(migration_sql)
        print("✅ Migration applied successfully!")
        print("Added is_public column to art_objects table")
        
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
