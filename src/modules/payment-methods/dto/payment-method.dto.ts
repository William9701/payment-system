import { IsString, IsEnum, IsOptional, IsBoolean, IsObject, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethodType, PaymentMethodStatus, CardType } from '../entities/payment-method.entity';

export class CreatePaymentMethodDto {
  @ApiProperty({
    description: 'Name for the payment method',
    example: 'My Default Card',
    maxLength: 50,
  })
  @IsString()
  @Length(2, 50)
  name: string;

  @ApiProperty({
    description: 'Payment method type',
    enum: PaymentMethodType,
    example: PaymentMethodType.STRIPE,
  })
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @ApiPropertyOptional({
    description: 'Whether this is the default payment method',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: 'External provider ID (e.g., Stripe account ID)',
    example: 'acct_1234567890',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  externalId?: string;

  @ApiPropertyOptional({
    description: 'External provider name',
    example: 'stripe',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  externalProvider?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the payment method',
    example: {
      currency: 'USD',
      country: 'US',
      processingFee: 2.9,
      limits: {
        daily: 10000,
        monthly: 100000,
        perTransaction: 5000
      }
    },
  })
  @IsOptional()
  @IsObject()
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
}

export class UpdatePaymentMethodDto {
  @ApiPropertyOptional({
    description: 'Name for the payment method',
    example: 'My Updated Card',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  name?: string;

  @ApiPropertyOptional({
    description: 'Payment method status',
    enum: PaymentMethodStatus,
    example: PaymentMethodStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(PaymentMethodStatus)
  status?: PaymentMethodStatus;

  @ApiPropertyOptional({
    description: 'Whether this is the default payment method',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata for the payment method',
    example: {
      currency: 'USD',
      country: 'US',
      processingFee: 2.9
    },
  })
  @IsOptional()
  @IsObject()
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
}

export class PaymentMethodResponseDto {
  @ApiProperty({
    description: 'Payment method ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Payment method name',
    example: 'My Default Card',
  })
  name: string;

  @ApiProperty({
    description: 'Payment method type',
    enum: PaymentMethodType,
    example: PaymentMethodType.STRIPE,
  })
  type: PaymentMethodType;

  @ApiProperty({
    description: 'Payment method status',
    enum: PaymentMethodStatus,
    example: PaymentMethodStatus.ACTIVE,
  })
  status: PaymentMethodStatus;

  @ApiProperty({
    description: 'Whether this is the default payment method',
    example: false,
  })
  isDefault: boolean;

  @ApiPropertyOptional({
    description: 'External provider ID',
    example: 'acct_1234567890',
  })
  externalId?: string;

  @ApiPropertyOptional({
    description: 'External provider name',
    example: 'stripe',
  })
  externalProvider?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2023-12-31T23:59:59.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-12-31T23:59:59.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Last used timestamp',
    example: '2023-12-31T23:59:59.000Z',
  })
  lastUsedAt?: Date;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: {
      currency: 'USD',
      country: 'US'
    },
  })
  metadata?: Record<string, any>;
}