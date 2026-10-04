import { PrismaClient } from '../generated/client';

// Same fixed product UUIDs as product-service seed. Index n = product n.
const stock = [50, 30, 15, 100, 60, 40, 45, 200, 80, 10, 70, 25];
async function main() {
  const prisma = new PrismaClient();
  for (const [i, quantity] of stock.entries()) {
    const productId = `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    await prisma.inventory.upsert({ where: { productId }, update: {}, create: { productId, quantity } });
  }
  console.log(`[inventory-seed] ${stock.length} stock rows ready`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
