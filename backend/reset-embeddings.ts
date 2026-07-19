import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all existing candidate embeddings to prepare for the new Local Embedding model (dimension mismatch)...');
  const result = await prisma.$executeRawUnsafe(`DELETE FROM candidate_embeddings`);
  console.log(`Deleted ${result} rows from candidate_embeddings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
