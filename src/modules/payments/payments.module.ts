import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { Merchant } from '../merchants/entities/merchant.entity';
import { PaymentService } from './services/payment.service';
import { WebhookService } from './services/webhook.service';
import { PaymentController } from './controllers/payment.controller';
import { WebhookController } from './controllers/webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentMethod, Merchant]),
  ],
  providers: [PaymentService, WebhookService],
  controllers: [PaymentController, WebhookController],
  exports: [PaymentService, WebhookService],
})
export class PaymentsModule {}