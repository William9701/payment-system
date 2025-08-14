import { IsString, IsNumber, IsEnum, IsOptional, IsUUID, IsEmail, IsObject, Min, Max, Length, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Currency, PaymentGateway } from '../entities/payment.entity';

export class InitializePaymentDto {
  @ApiProperty({
    description: 'Payment amount in the specified currency',
    example: 100.50,
    minimum: 0.01,
    maximum: 999999999.99,
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Amount must have at most 2 decimal places' })
  @Min(0.01, { message: 'Amount must be at least 0.01' })
  @Max(999999999.99, { message: 'Amount cannot exceed 999,999,999.99' })
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    description: 'Currency code for the payment',
    enum: Currency,
    example: Currency.USD,
  })
  @IsEnum(Currency, { message: 'Currency must be a valid currency code' })
  currency: Currency;

  @ApiPropertyOptional({
    description: 'Payment method ID to use for this payment. Create one using POST /payment-methods first',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Payment method ID must be a valid UUID' })
  paymentMethodId?: string;

  @ApiProperty({
    description: 'Payment gateway to process the payment',
    enum: PaymentGateway,
    example: PaymentGateway.STRIPE,
  })
  @IsEnum(PaymentGateway, { message: 'Gateway must be a valid payment gateway' })
  gateway: PaymentGateway;

  @ApiPropertyOptional({
    description: 'Description of the payment',
    example: 'Payment for order #12345',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @Length(0, 255, { message: 'Description cannot exceed 255 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Customer email address',
    example: 'customer@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Customer email must be a valid email address' })
  customerEmail?: string;

  @ApiPropertyOptional({
    description: 'Customer name',
    example: 'John Doe',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Customer name must be a string' })
  @Length(0, 100, { message: 'Customer name cannot exceed 100 characters' })
  customerName?: string;

  @ApiPropertyOptional({
    description: 'Customer phone number',
    example: '+1234567890',
    maxLength: 20,
  })
  @IsOptional()
  @IsString({ message: 'Customer phone must be a string' })
  @Length(0, 20, { message: 'Customer phone cannot exceed 20 characters' })
  customerPhone?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the payment',
    example: {
      orderId: 'ORDER_123',
      source: 'web',
      customFields: {
        productId: '456',
        categoryId: '789'
      }
    },
  })
  @IsOptional()
  @IsObject({ message: 'Metadata must be an object' })
  metadata?: {
    orderId?: string;
    customFields?: Record<string, any>;
    tags?: string[];
    source?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

export class PaymentResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Unique payment reference',
    example: 'PAY_1640995200_A1B2C3D4',
  })
  reference: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 100.50,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment currency',
    enum: Currency,
    example: Currency.USD,
  })
  currency: Currency;

  @ApiProperty({
    description: 'Payment status',
    example: 'pending',
  })
  status: string;

  @ApiProperty({
    description: 'Payment gateway',
    enum: PaymentGateway,
    example: PaymentGateway.STRIPE,
  })
  gateway: PaymentGateway;

  @ApiPropertyOptional({
    description: 'Payment description',
    example: 'Payment for order #12345',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Customer email',
    example: 'customer@example.com',
  })
  customerEmail?: string;

  @ApiPropertyOptional({
    description: 'Customer name',
    example: 'John Doe',
  })
  customerName?: string;

  @ApiProperty({
    description: 'Payment creation timestamp',
    example: '2023-12-31T23:59:59.000Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Payment expiration timestamp',
    example: '2024-01-01T01:00:00.000Z',
  })
  expiresAt?: Date;

  @ApiPropertyOptional({
    description: 'Additional payment metadata',
    example: {
      orderId: 'ORDER_123',
      source: 'web'
    },
  })
  metadata?: Record<string, any>;
}

export class GetPaymentDto {
  @ApiProperty({
    description: 'Payment reference or ID',
    example: 'PAY_1640995200_A1B2C3D4',
  })
  @IsString({ message: 'Reference must be a string' })
  @IsNotEmpty({ message: 'Reference cannot be empty' })
  reference: string;
}

export class UpdatePaymentStatusDto {
  @ApiProperty({
    description: 'New payment status',
    example: 'completed',
  })
  @IsString({ message: 'Status must be a string' })
  @IsNotEmpty({ message: 'Status cannot be empty' })
  status: string;

  @ApiPropertyOptional({
    description: 'External gateway reference',
    example: 'stripe_pi_1234567890',
  })
  @IsOptional()
  @IsString({ message: 'Gateway reference must be a string' })
  gatewayReference?: string;

  @ApiPropertyOptional({
    description: 'Gateway response data',
    example: {
      transactionId: 'txn_1234567890',
      responseCode: '00',
      responseMessage: 'Successful'
    },
  })
  @IsOptional()
  @IsObject({ message: 'Gateway response must be an object' })
  gatewayResponse?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Failure code if payment failed',
    example: 'INSUFFICIENT_FUNDS',
  })
  @IsOptional()
  @IsString({ message: 'Failure code must be a string' })
  failureCode?: string;

  @ApiPropertyOptional({
    description: 'Failure reason if payment failed',
    example: 'Insufficient funds in account',
  })
  @IsOptional()
  @IsString({ message: 'Failure reason must be a string' })
  failureReason?: string;
}