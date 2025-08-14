import { Entity, Column, ManyToOne, JoinColumn, Index, BeforeInsert } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { PaymentMethod } from '../../payment-methods/entities/payment-method.entity';
import { IsString, IsEnum, IsOptional, IsNumber, IsUUID, IsJSON, Min, Max } from 'class-validator';
import { v4 as uuidv4 } from 'uuid';

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
  DISPUTED = 'disputed',
  EXPIRED = 'expired',
}

export enum PaymentType {
  PAYMENT = 'payment',
  REFUND = 'refund',
  CHARGEBACK = 'chargeback',
  ADJUSTMENT = 'adjustment',
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  NGN = 'NGN',
  GHS = 'GHS',
  KES = 'KES',
  ZAR = 'ZAR',
  BTC = 'BTC',
  ETH = 'ETH',
}

export enum PaymentGateway {
  PAYSTACK = 'paystack',
  FLUTTERWAVE = 'flutterwave',
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  SQUARE = 'square',
  RAZORPAY = 'razorpay',
  INTERNAL = 'internal',
}

@Entity('payments')
@Index(['reference'], { unique: true })
@Index(['merchantId', 'status'])
@Index(['status', 'createdAt'])
@Index(['gateway', 'externalId'])
export class Payment extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    nullable: false,
  })
  @IsString()
  reference: string;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: false,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  amount: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.USD,
  })
  @IsEnum(Currency)
  currency: Currency;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentType,
    default: PaymentType.PAYMENT,
    name: 'payment_type',
  })
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @Column({
    type: 'enum',
    enum: PaymentGateway,
    default: PaymentGateway.INTERNAL,
  })
  @IsEnum(PaymentGateway)
  gateway: PaymentGateway;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  description?: string;

  // Gateway-specific fields
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'external_id',
  })
  @IsString()
  @IsOptional()
  externalId?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'gateway_reference',
  })
  @IsString()
  @IsOptional()
  gatewayReference?: string;

  @Column({
    type: 'json',
    nullable: true,
    name: 'gateway_response',
  })
  @IsJSON()
  @IsOptional()
  gatewayResponse?: Record<string, any>;

  // Fee information
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'gateway_fee',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gatewayFee: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'platform_fee',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  platformFee: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    name: 'net_amount',
  })
  netAmount?: number;

  // Customer information
  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
    name: 'customer_email',
  })
  @IsString()
  @IsOptional()
  customerEmail?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'customer_name',
  })
  @IsString()
  @IsOptional()
  customerName?: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'customer_phone',
  })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  // Timing information
  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'initiated_at',
  })
  initiatedAt?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'processed_at',
  })
  processedAt?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'completed_at',
  })
  completedAt?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'failed_at',
  })
  failedAt?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'expires_at',
  })
  expiresAt?: Date;

  // Error and failure information
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'failure_code',
  })
  @IsString()
  @IsOptional()
  failureCode?: string;

  @Column({
    type: 'text',
    nullable: true,
    name: 'failure_reason',
  })
  @IsString()
  @IsOptional()
  failureReason?: string;

  // Metadata and additional information
  @Column({
    type: 'json',
    nullable: true,
  })
  @IsJSON()
  @IsOptional()
  metadata?: {
    orderId?: string;
    customFields?: Record<string, any>;
    tags?: string[];
    source?: string;
    ipAddress?: string;
    userAgent?: string;
  };

  // Webhook tracking
  @Column({
    type: 'int',
    default: 0,
    name: 'webhook_attempts',
  })
  webhookAttempts: number;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'last_webhook_at',
  })
  lastWebhookAt?: Date;

  @Column({
    type: 'boolean',
    default: false,
    name: 'webhook_delivered',
  })
  webhookDelivered: boolean;

  // Foreign keys
  @Column({
    type: 'uuid',
    name: 'merchant_id',
  })
  @IsUUID()
  merchantId: string;

  @Column({
    type: 'uuid',
    nullable: true,
    name: 'payment_method_id',
  })
  @IsUUID()
  @IsOptional()
  paymentMethodId?: string;

  @Column({
    type: 'uuid',
    nullable: true,
    name: 'parent_payment_id',
  })
  @IsUUID()
  @IsOptional()
  parentPaymentId?: string; // For refunds and chargebacks

  // Relationships
  @ManyToOne(() => Merchant, (merchant) => merchant.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @ManyToOne(() => PaymentMethod, (paymentMethod) => paymentMethod.payments, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod?: PaymentMethod;

  @ManyToOne(() => Payment, { nullable: true })
  @JoinColumn({ name: 'parent_payment_id' })
  parentPayment?: Payment;

  // Lifecycle hooks
  @BeforeInsert()
  generateReference() {
    if (!this.reference) {
      this.reference = `PAY_${Date.now()}_${uuidv4().substring(0, 8).toUpperCase()}`;
    }
  }

  // Helper methods
  isSuccessful(): boolean {
    return this.status === PaymentStatus.COMPLETED;
  }

  isFailed(): boolean {
    return [PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED].includes(this.status);
  }

  isPending(): boolean {
    return [PaymentStatus.PENDING, PaymentStatus.PROCESSING].includes(this.status);
  }

  canBeRefunded(): boolean {
    return this.status === PaymentStatus.COMPLETED && this.paymentType === PaymentType.PAYMENT;
  }

  calculateNetAmount(): number {
    return this.amount - this.gatewayFee - this.platformFee;
  }
}