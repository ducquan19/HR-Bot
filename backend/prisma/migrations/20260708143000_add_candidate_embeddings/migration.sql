CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "candidate_embeddings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidate_profile_id" UUID NOT NULL,
    "source_type" VARCHAR(50) NOT NULL DEFAULT 'profile',
    "source_id" UUID,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "candidate_embeddings_embedding_idx"
ON "candidate_embeddings" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS "candidate_embeddings_candidate_profile_idx"
ON "candidate_embeddings"("candidate_profile_id");

CREATE INDEX IF NOT EXISTS "candidate_embeddings_source_idx"
ON "candidate_embeddings"("source_type", "source_id");

ALTER TABLE "candidate_embeddings"
ADD CONSTRAINT "candidate_embeddings_candidate_profile_id_fkey"
FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
