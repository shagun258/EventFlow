import { ArgsType, Field, Float, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsInt, IsOptional, IsPositive, IsString, IsUUID, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';

@ObjectType() export class User { @Field(() => ID) id: string; @Field() email: string; @Field() name: string; @Field() role: string; @Field() createdAt: string; }
@ObjectType() export class AuthPayload { @Field() token: string; @Field(() => User) user: User; }
@ObjectType() export class Category { @Field(() => ID) id: string; @Field() name: string; @Field() slug: string; }
@ObjectType() export class Product {
  @Field(() => ID) id: string; @Field() name: string; @Field() description: string; @Field(() => Float) price: number;
  @Field({ nullable: true }) imageUrl?: string; @Field() categoryId: string; @Field() categoryName: string; @Field() createdAt: string; }
@ObjectType() export class ProductPage { @Field(() => [Product]) products: Product[]; @Field(() => Int) total: number; }
@ObjectType() export class CartItem {
  @Field() productId: string; @Field() productName: string; @Field(() => Float) unitPrice: number; @Field(() => Int) quantity: number;
  @Field(() => Float) lineTotal: number; @Field() unavailable: boolean; }
@ObjectType() export class Cart { @Field(() => [CartItem]) items: CartItem[]; @Field(() => Float) total: number; @Field(() => Int) itemCount: number; }
@ObjectType() export class OrderItem { @Field() productId: string; @Field() productName: string; @Field(() => Float) unitPrice: number; @Field(() => Int) quantity: number; }
@ObjectType() export class Order {
  @Field(() => ID) id: string; @Field() orderNumber: string; @Field() userId: string; @Field() status: string; @Field(() => Float) total: number;
  @Field({ nullable: true }) failureReason?: string; @Field({ nullable: true }) paymentStatus?: string; @Field(() => [OrderItem]) items: OrderItem[];
  @Field() createdAt: string; @Field() updatedAt: string; }
@ObjectType() export class OrderPage { @Field(() => [Order]) orders: Order[]; @Field(() => Int) total: number; }
@ObjectType() export class Notification { @Field(() => ID) id: string; @Field() type: string; @Field() message: string; @Field({ nullable: true }) orderId?: string; @Field() read: boolean; @Field() createdAt: string; }
@ObjectType() export class NotificationPage { @Field(() => [Notification]) notifications: Notification[]; @Field(() => Int) total: number; @Field(() => Int) unreadCount: number; }
@ObjectType() export class InventoryItem { @Field() productId: string; @Field(() => Int) quantity: number; @Field(() => Int) reserved: number; @Field(() => Int) available: number; }
@ObjectType() export class InventoryPage { @Field(() => [InventoryItem]) items: InventoryItem[]; @Field(() => Int) total: number; }
@ObjectType() export class TopicCount { @Field() topic: string; @Field(() => Int) count: number; }
@ObjectType() export class Analytics {
  @Field(() => Int) totalEvents: number; @Field(() => [TopicCount]) byTopic: TopicCount[]; @Field(() => Int) ordersCreated: number; @Field(() => Int) ordersCancelled: number;
  @Field(() => Int) paymentsCompleted: number; @Field(() => Int) paymentsFailed: number; @Field(() => Float) revenue: number; }
@ObjectType() export class EventRecord { @Field() eventId: string; @Field() topic: string; @Field() source: string; @Field({ nullable: true }) entityId?: string; @Field() payloadJson: string; @Field() occurredAt: string; }
@ObjectType() export class EventPage { @Field(() => [EventRecord]) events: EventRecord[]; @Field(() => Int) total: number; }

@InputType() export class RegisterInput {
  @Field() @IsEmail() @MaxLength(254) email: string;
  @Field() @MinLength(8) @MaxLength(72) password: string; // bcrypt only uses the first 72 bytes
  @Field() @IsString() @MinLength(1) @MaxLength(100) name: string; }
@InputType() export class LoginInput { @Field() @IsEmail() email: string; @Field() @IsString() @MinLength(1) @MaxLength(72) password: string; }
@InputType() export class ProductInput {
  @Field() @IsString() @MinLength(1) @MaxLength(200) name: string;
  @Field() @IsString() @MaxLength(2000) description: string;
  @Field(() => Float) @IsPositive() @Max(1_000_000) price: number;
  @Field({ nullable: true }) @IsOptional() @IsUrl() imageUrl?: string;
  @Field() @IsUUID() categoryId: string; }
@InputType() export class CartItemInput { @Field() @IsUUID() productId: string; @Field(() => Int) @IsInt() @Min(1) @Max(100) quantity: number; }
@InputType() export class UpdateInventoryInput { @Field() @IsUUID() productId: string; @Field(() => Int) @IsInt() @Min(0) @Max(1_000_000) quantity: number; }

@ArgsType() export class PageArgs {
  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() @Min(1) page?: number;
  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() @Min(1) @Max(100) pageSize?: number; }
@ArgsType() export class ProductsArgs extends PageArgs {
  @Field({ nullable: true }) @IsOptional() @IsString() @MaxLength(100) search?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() categoryId?: string; }
@ArgsType() export class OrdersArgs extends PageArgs { @Field({ nullable: true }) @IsOptional() @IsString() status?: string; }
@ArgsType() export class NotificationsArgs extends PageArgs { @Field({ nullable: true }) @IsOptional() unreadOnly?: boolean; }
@ArgsType() export class EventsArgs extends PageArgs { @Field({ nullable: true }) @IsOptional() @IsString() topic?: string; }
