import { IsEnum, IsObject, IsString } from 'class-validator';
import { PaymentGateway } from '../../payments/entities/payment.entity';

export class ProcessWebhookDto {
  @IsEnum(PaymentGateway)
  gateway: PaymentGateway;

  @IsObject()
  payload: any;

  @IsString()
  signature: string;
}