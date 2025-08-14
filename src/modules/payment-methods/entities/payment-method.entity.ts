import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index, BeforeInsert, BeforeUpdate } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { IsString, IsEnum, IsOptional, Length, IsJSON, IsBoolean } from 'class-validator';
import { EncryptionService } from '../../../shared/utils/encryption.util';

export enum PaymentMethodType {
  CARD = 'card',
  BANK_ACCOUNT = 'bank_account',
  MOBILE_MONEY = 'mobile_money',
  CRYPTO = 'crypto',
  PAYPAL = 'paypal',
  STRIPE = 'stripe',
}

export enum PaymentMethodStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  BLOCKED = 'blocked',
}

export enum CardType {
  VISA = 'visa',
  MASTERCARD = 'mastercard',
  AMEX = 'amex',
  DISCOVER = 'discover',
  JCB = 'jcb',
  DINERS = 'diners',
}

@Entity('payment_methods')
@Index(['merchantId', 'isDefault'])
@Index(['type', 'status'])
export class PaymentMethod extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
  })
  @IsString()
  @Length(2, 50)
  name: string;

  @Column({
    type: 'enum',
    enum: PaymentMethodType,
    nullable: false,
  })
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @Column({
    type: 'enum',
    enum: PaymentMethodStatus,
    default: PaymentMethodStatus.ACTIVE,
  })
  @IsEnum(PaymentMethodStatus)
  status: PaymentMethodStatus;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_default',
  })
  @IsBoolean()
  isDefault: boolean;

  // Encrypted sensitive data
  @Column({
    type: 'text',
    nullable: true,
    name: 'encrypted_data',
  })
  encryptedData?: string;

  // Card-specific fields (stored in encrypted format when applicable)
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'masked_number',
  })
  @IsString()
  @IsOptional()
  maskedNumber?: string; // e.g., "**** **** **** 1234"

  @Column({
    type: 'enum',
    enum: CardType,
    nullable: true,
    name: 'card_type',
  })
  @IsEnum(CardType)
  @IsOptional()
  cardType?: CardType;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'card_holder_name',
  })
  @IsString()
  @IsOptional()
  cardHolderName?: string;

  @Column({
    type: 'varchar',
    length: 7,
    nullable: true,
    name: 'expiry_date',
  })
  @IsString()
  @IsOptional()
  expiryDate?: string; // MM/YYYY

  // Bank account fields
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'bank_name',
  })
  @IsString()
  @IsOptional()
  bankName?: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'account_holder_name',
  })
  @IsString()
  @IsOptional()
  accountHolderName?: string;

  // Mobile money fields
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'provider_name',
  })
  @IsString()
  @IsOptional()
  providerName?: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'phone_number',
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  // External provider fields
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
    length: 50,
    nullable: true,
    name: 'external_provider',
  })
  @IsString()
  @IsOptional()
  externalProvider?: string;

  // Metadata and configuration
  @Column({
    type: 'json',
    nullable: true,
  })
  @IsJSON()
  @IsOptional()
  metadata?: {
    currency?: string;
    country?: string;
    processingFee?: number;
    limits?: {
      daily?: number;
      monthly?: number;
      perTransaction?: number;
    };
  };

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'last_used_at',
  })
  lastUsedAt?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'verified_at',
  })
  verifiedAt?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'expires_at',
  })
  expiresAt?: Date;

  // Foreign key
  @Column({
    type: 'uuid',
    name: 'merchant_id',
  })
  merchantId: string;

  // Relationships
  @ManyToOne(() => Merchant, (merchant) => merchant.paymentMethods, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @OneToMany(() => Payment, (payment) => payment.paymentMethod)
  payments: Payment[];

  // Methods for handling encrypted data
  setSecureData(data: Record<string, any>, encryptionService: EncryptionService): void {
    if (data && Object.keys(data).length > 0) {
      this.encryptedData = encryptionService.encrypt(JSON.stringify(data));
    }
  }

  getSecureData(encryptionService: EncryptionService): Record<string, any> | null {
    if (!this.encryptedData) return null;
    
    try {
      const decrypted = encryptionService.decrypt(this.encryptedData);
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error('Failed to decrypt payment method data');
    }
  }
}