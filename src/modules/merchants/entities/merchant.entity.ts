import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { PaymentMethod } from '../../payment-methods/entities/payment-method.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { IsEmail, IsString, IsOptional, Length, IsEnum, IsPhoneNumber } from 'class-validator';

export enum MerchantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

export enum MerchantType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
  ENTERPRISE = 'enterprise',
}

@Entity('merchants')
@Index(['email'], { unique: true })
@Index(['businessId'], { unique: true, where: 'business_id IS NOT NULL' })
export class Merchant extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  @IsString()
  @Length(2, 100)
  name: string;

  @Column({
    type: 'varchar',
    length: 150,
    unique: true,
    nullable: false,
  })
  @IsEmail()
  email: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    select: false,
  })
  @IsString()
  password: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'business_name',
  })
  @IsString()
  @IsOptional()
  @Length(2, 100)
  businessName?: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    unique: true,
    name: 'business_id',
  })
  @IsString()
  @IsOptional()
  businessId?: string;

  @Column({
    type: 'enum',
    enum: MerchantType,
    default: MerchantType.INDIVIDUAL,
    name: 'merchant_type',
  })
  @IsEnum(MerchantType)
  merchantType: MerchantType;

  @Column({
    type: 'enum',
    enum: MerchantStatus,
    default: MerchantStatus.PENDING,
  })
  @IsEnum(MerchantStatus)
  status: MerchantStatus;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'webhook_url',
  })
  @IsString()
  @IsOptional()
  webhookUrl?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'webhook_secret',
  })
  @IsString()
  @IsOptional()
  webhookSecret?: string;

  @Column({
    type: 'json',
    nullable: true,
    name: 'api_settings',
  })
  apiSettings?: {
    rateLimit?: number;
    allowedIPs?: string[];
    webhookRetryCount?: number;
    webhookTimeoutMs?: number;
  };

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    name: 'total_processed_amount',
  })
  totalProcessedAmount: number;

  @Column({
    type: 'int',
    default: 0,
    name: 'total_transactions',
  })
  totalTransactions: number;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'last_transaction_at',
  })
  lastTransactionAt?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'verified_at',
  })
  verifiedAt?: Date;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'verified_by',
  })
  verifiedBy?: string;

  // Relationships
  @OneToMany(() => PaymentMethod, (paymentMethod) => paymentMethod.merchant, {
    cascade: ['soft-remove'],
  })
  paymentMethods: PaymentMethod[];

  @OneToMany(() => Payment, (payment) => payment.merchant, {
    cascade: ['soft-remove'],
  })
  payments: Payment[];
}