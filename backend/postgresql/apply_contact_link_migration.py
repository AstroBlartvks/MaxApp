import asyncpg
import asyncio
import os

async def apply_migration():
    conn = await asyncpg.connect(
        host="127.0.0.1",
        port=5432,
        user="app_user",
        password=os.getenv("DB_PASSWORD", "SecurePassword123"),
        database="app_db"
    )
    
    try:
        with open('postgresql/migration_add_contact_link.sql', 'r', encoding='utf-8') as f:
            migration_sql = f.read()
        
        await conn.execute(migration_sql)
        print("✅ Migration applied successfully: contact_link field added to users table")
        
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(apply_migration())
