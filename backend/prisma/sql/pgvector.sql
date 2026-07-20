-- Run after `npx prisma migrate dev` if you want semantic search with pgvector.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS candidate_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL DEFAULT 'profile',
  source_id UUID,
  content TEXT NOT NULL,
  embedding vector(384),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS candidate_embeddings_embedding_idx
ON candidate_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS candidate_embeddings_candidate_profile_idx
ON candidate_embeddings(candidate_profile_id);
