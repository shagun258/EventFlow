import { PrismaClient } from '../generated/client';

// Fixed UUIDs so inventory/order seed data can reference these products later.
const pid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const cid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
const categories = [
  { id: cid(1), name: 'Electronics', slug: 'electronics' }, { id: cid(2), name: 'Books', slug: 'books' },
  { id: cid(3), name: 'Home Office', slug: 'home-office' }, { id: cid(4), name: 'Apparel', slug: 'apparel' },
];
const products: [string, string, number, number][] = [
  ['Wireless Headphones', 'Noise-cancelling over-ear headphones, 30h battery.', 79.99, 1],
  ['Mechanical Keyboard', 'Hot-swappable 75% keyboard with tactile switches.', 129.0, 1],
  ['4K Monitor 27"', 'IPS panel, USB-C power delivery, factory calibrated.', 349.0, 1],
  ['USB-C Hub', '7-in-1 hub: HDMI, SD, 3x USB-A, 100W pass-through.', 39.5, 1],
  ['Clean Architecture', 'A craftsman\'s guide to software structure and design.', 34.99, 2],
  ['Designing Data-Intensive Applications', 'The big ideas behind reliable, scalable systems.', 49.99, 2],
  ['The Pragmatic Programmer', 'Your journey to mastery, 20th anniversary edition.', 44.0, 2],
  ['Ceramic Coffee Mug', 'Handmade 350ml stoneware mug.', 12.5, 3],
  ['LED Desk Lamp', 'Dimmable lamp with 5 colour temperatures.', 29.99, 3],
  ['Ergonomic Chair', 'Adjustable lumbar support and breathable mesh back.', 219.0, 3],
  ['Developer Hoodie', 'Heavyweight organic cotton hoodie.', 54.0, 4],
  ['Canvas Backpack', 'Water-resistant, fits a 16" laptop.', 64.9, 4],
];
async function main() {
  const prisma = new PrismaClient();
  for (const c of categories) await prisma.category.upsert({ where: { id: c.id }, update: {}, create: c });
  for (const [i, [name, description, price, cat]] of products.entries()) {
    await prisma.product.upsert({ where: { id: pid(i + 1) }, update: {}, create: { id: pid(i + 1), name, description, price, categoryId: cid(cat) } });
  }
  console.log(`[product-seed] ${categories.length} categories, ${products.length} products ready`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
