-- Fix embedding dimension mismatch: change from vector(1536) to vector(384)
-- The local embedding model (paraphrase-multilingual-MiniLM-L12-v2) produces 384-dimensional vectors

-- Step 1: Drop the IVFFlat index first (cannot change column type with index attached)
DROP INDEX IF EXISTS "candidate_embeddings_embedding_idx";

-- Step 2: Clear all existing embeddings to avoid dimension mismatch on cast
TRUNCATE TABLE "candidate_embeddings";

-- Step 3: Drop old column and re-add with correct dimension
ALTER TABLE "candidate_embeddings" DROP COLUMN "embedding";
ALTER TABLE "candidate_embeddings" ADD COLUMN "embedding" vector(384);

-- Step 4: Recreate the IVFFlat index for the new dimension
-- (lists=100 requires at least 100 rows; use 1 for empty tables)
CREATE INDEX "candidate_embeddings_embedding_idx"
ON "candidate_embeddings" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 1);
