import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/client';

// DEMO credentials only. Never use these outside local development.
const users = [
  { id: '00000000-0000-4000-9000-000000000001', email: 'demo@eventflow.dev', name: 'Demo User', role: 'USER' as const, password: 'Demo@12345' },
  { id: '00000000-0000-4000-9000-000000000002', email: 'admin@eventflow.dev', name: 'Demo Admin', role: 'ADMIN' as const, password: 'Admin@12345' },
];
async function main() {
  const prisma = new PrismaClient();
  for (const { password, ...u } of users) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, passwordHash: await bcrypt.hash(password, 12) } });
  }
  console.log(`[auth-seed] ${users.length} demo users ready`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
