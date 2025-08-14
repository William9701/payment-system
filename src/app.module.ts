import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './shared/config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PaymentMethodsModule } from './modules/payment-methods/payment-methods.module';
import { SqsModule } from './modules/sqs/sqs.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    SqsModule,
    AuthModule,
    PaymentMethodsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
