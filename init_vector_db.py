import os
import asyncio
from prisma import Prisma
import config

async def init_vector_db():
    """
    Initialize the vector database with the correct dimension and index.
    This allows dynamic configuration of vector dimensions via environment variables.
    """
    print("Initializing Vector DB...")
    
    # Get vector dimension from config/env
    # Default to 1024 if not set, but it should be set in production
    vector_dimension = config.VECTOR_DIMENSION
    print(f"Target Vector Dimension: {vector_dimension}")

    prisma = Prisma()
    try:
        await prisma.connect()
        
        # 1. Alter the column to the specific dimension
        # We use ::vector(N) to enforce the dimension constraint
        print(f"Altering 'Document' table 'embedding' column to vector({vector_dimension})...")
        alter_sql = f"""
            ALTER TABLE "Document" 
            ALTER COLUMN "embedding" TYPE vector({vector_dimension}) 
            USING "embedding"::vector({vector_dimension});
        """
        await prisma.execute_raw(alter_sql)
        print("Column dimension updated successfully.")

        # 2. Create HNSW index
        # We need to drop the existing index first if it exists to ensure it's rebuilt with the correct dimension
        print("Recreating HNSW index...")
        
        # Drop index if exists
        await prisma.execute_raw('DROP INDEX IF EXISTS "Document_embedding_idx";')
        
        # Create new index
        # Using vector_cosine_ops for cosine similarity (which is what we use in search)
        create_index_sql = f"""
            CREATE INDEX "Document_embedding_idx" 
            ON "Document" 
            USING hnsw ("embedding" vector_cosine_ops);
        """
        await prisma.execute_raw(create_index_sql)
        print("HNSW index created successfully.")
        
    except Exception as e:
        print(f"Error initializing Vector DB: {e}")
        # We don't raise here to allow the app to start even if DB init fails 
        # (though search might be broken if dimension is wrong)
        # But for a critical infrastructure piece, maybe we should exit?
        # Let's print a loud warning.
        print("WARNING: Vector DB initialization failed. Search functionality may be impaired.")
        raise e
    finally:
        if prisma.is_connected():
            await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(init_vector_db())