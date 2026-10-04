import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { EventPublisher, Topics } from '@eventflow/kafka-events';
import { PrismaService } from './prisma.service';
import { isPrismaCode, rpcError, status } from './rpc-error';

export const REDIS = 'REDIS';
export interface ProductInput { name: string; description: string; price: number; imageUrl?: string; categoryId: string }

/**
 * Redis usage: read-through cache for product reads (60-120s TTL).
 * List caches are invalidated by bumping a version counter on every write.
 * If Redis is down the service degrades gracefully to PostgreSQL.
 */
@Injectable()
export class ProductService {
  private readonly log = new Logger('ProductService');
  constructor(private readonly prisma: PrismaService, @Inject(REDIS) private readonly redis: Redis, private readonly events: EventPublisher) {}

  private async cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    try { const hit = await this.redis.get(key); if (hit) return JSON.parse(hit); } catch (e) { this.log.warn(`Redis read failed: ${(e as Error).message}`); }
    const value = await load();
    try { await this.redis.set(key, JSON.stringify(value), 'EX', ttl); } catch (e) { this.log.warn(`Redis write failed: ${(e as Error).message}`); }
    return value;
  }
  private async invalidate(id?: string) {
    try { await this.redis.incr('products:ver'); if (id) await this.redis.del(`product:${id}`); } catch (e) { this.log.warn(`Cache invalidation failed: ${(e as Error).message}`); }
  }

  async list(q: { search?: string; categoryId?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, q.page || 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize || 12));
    const ver = (await this.redis.get('products:ver').catch(() => null)) ?? '0';
    const key = `products:${ver}:${JSON.stringify([q.search ?? '', q.categoryId ?? '', page, pageSize])}`;
    return this.cached(key, 60, async () => {
      const where = {
        ...(q.categoryId ? { categoryId: q.categoryId } : {}),
        ...(q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' as const } }, { description: { contains: q.search, mode: 'insensitive' as const } }] } : {}),
      };
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.product.findMany({ where, include: { category: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
        this.prisma.product.count({ where }),
      ]);
      return { products: rows.map(this.toDto), total };
    });
  }

  async get({ id }: { id: string }) {
    return this.cached(`product:${id}`, 120, async () => {
      const p = await this.prisma.product.findUnique({ where: { id }, include: { category: true } });
      if (!p) throw rpcError(status.NOT_FOUND, 'Product not found');
      return this.toDto(p);
    });
  }

  async categories() {
    return { categories: await this.cached('categories', 300, () => this.prisma.category.findMany({ orderBy: { name: 'asc' } })) };
  }

  async create(dto: ProductInput) {
    await this.validate(dto);
    const p = await this.prisma.product.create({ data: this.data(dto), include: { category: true } });
    await this.invalidate();
    this.log.log(`Product created: ${p.id}`);
    await this.events.publish(Topics.PRODUCT_CREATED, p.id, { productId: p.id, name: p.name, price: Number(p.price) })
      .catch((e) => this.log.error(`Failed to publish product.created: ${e.message}`));
    return this.toDto(p);
  }

  async update({ id, data }: { id: string; data: ProductInput }) {
    await this.validate(data);
    let p;
    try { p = await this.prisma.product.update({ where: { id }, data: this.data(data), include: { category: true } }); }
    catch (e) { if (isPrismaCode(e, 'P2025')) throw rpcError(status.NOT_FOUND, 'Product not found'); throw e; }
    await this.invalidate(id);
    this.log.log(`Product updated: ${id}`);
    await this.events.publish(Topics.PRODUCT_UPDATED, id, { productId: id, name: p.name, price: Number(p.price) })
      .catch((e) => this.log.error(`Failed to publish product.updated: ${e.message}`));
    return this.toDto(p);
  }

  async remove({ id }: { id: string }) {
    try { await this.prisma.product.delete({ where: { id } }); }
    catch (e) { if (isPrismaCode(e, 'P2025')) throw rpcError(status.NOT_FOUND, 'Product not found'); throw e; }
    await this.invalidate(id);
    this.log.log(`Product deleted: ${id}`);
    return { success: true };
  }

  private async validate(d: ProductInput) {
    if (!d?.name?.trim()) throw rpcError(status.INVALID_ARGUMENT, 'Name is required');
    if (!(d.price > 0)) throw rpcError(status.INVALID_ARGUMENT, 'Price must be greater than 0');
    if (!(await this.prisma.category.findUnique({ where: { id: d.categoryId } }))) throw rpcError(status.NOT_FOUND, 'Category not found');
  }
  private data = (d: ProductInput) => ({ name: d.name.trim(), description: d.description ?? '', price: d.price, imageUrl: d.imageUrl || null, categoryId: d.categoryId });
  private toDto = (p: any) => ({ id: p.id, name: p.name, description: p.description, price: Number(p.price), imageUrl: p.imageUrl ?? '',
    categoryId: p.categoryId, categoryName: p.category?.name ?? '', createdAt: new Date(p.createdAt).toISOString() });
}
