-- DropIndex
DROP INDEX "candidate_embeddings_embedding_idx";

-- RenameIndex
ALTER INDEX "candidate_embeddings_candidate_profile_idx" RENAME TO "candidate_embeddings_candidate_profile_id_idx";
