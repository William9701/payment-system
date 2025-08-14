import { IsString, IsObject, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WebhookPayloadDto {
  @ApiProperty({
    description: 'Event type from the payment gateway',
    example: 'payment.completed',
  })
  @IsString({ message: 'Event must be a string' })
  @IsNotEmpty({ message: 'Event cannot be empty' })
  event: string;

  @ApiProperty({
    description: 'Payment reference or gateway transaction ID',
    example: 'PAY_1640995200_A1B2C3D4',
  })
  @IsString({ message: 'Reference must be a string' })
  @IsNotEmpty({ message: 'Reference cannot be empty' })
  reference: string;

  @ApiProperty({
    description: 'Payment status from the gateway',
    example: 'completed',
  })
  @IsString({ message: 'Status must be a string' })
  @IsNotEmpty({ message: 'Status cannot be empty' })
  status: string;

  @ApiPropertyOptional({
    description: 'Gateway-specific transaction reference',
    example: 'stripe_pi_1234567890',
  })
  @IsOptional()
  @IsString({ message: 'Gateway reference must be a string' })
  gatewayReference?: string;

  @ApiPropertyOptional({
    description: 'Gateway response data',
    example: {
      id: 'pi_1234567890',
      amount: 10050,
      currency: 'usd',
      status: 'succeeded',
      created: 1640995200
    },
  })
  @IsOptional()
  @IsObject({ message: 'Data must be an object' })
  data?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Failure code if payment failed',
    example: 'card_declined',
  })
  @IsOptional()
  @IsString({ message: 'Failure code must be a string' })
  failureCode?: string;

  @ApiPropertyOptional({
    description: 'Failure message if payment failed',
    example: 'Your card was declined.',
  })
  @IsOptional()
  @IsString({ message: 'Failure message must be a string' })
  failureMessage?: string;

  @ApiPropertyOptional({
    description: 'Gateway fees charged for the transaction',
    example: 2.9,
  })
  @IsOptional()
  gatewayFee?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata from the gateway',
    example: {
      customer_id: 'cus_1234567890',
      payment_method_id: 'pm_1234567890'
    },
  })
  @IsOptional()
  @IsObject({ message: 'Metadata must be an object' })
  metadata?: Record<string, any>;
}

export class WebhookResponseDto {
  @ApiProperty({
    description: 'Acknowledgment message',
    example: 'Webhook processed successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Whether the webhook was processed successfully',
    example: true,
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Payment reference that was updated',
    example: 'PAY_1640995200_A1B2C3D4',
  })
  reference?: string;

  @ApiPropertyOptional({
    description: 'New payment status',
    example: 'completed',
  })
  status?: string;
}

export class WebhookSimulationDto {
  @ApiProperty({
    description: 'Payment reference to update (from payment initialization)',
    example: 'PAY_1734024000_ABC123',
  })
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiPropertyOptional({
    description: 'New payment status (defaults to completed)',
    enum: ['completed', 'failed', 'cancelled'],
    default: 'completed',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Gateway transaction reference (auto-generated if not provided)',
  })
  @IsOptional()
  @IsString()
  gatewayReference?: string;

  @ApiPropertyOptional({
    description: 'Failure reason (only used when status is failed)',
  })
  @IsOptional()
  @IsString()
  failureReason?: string;
}