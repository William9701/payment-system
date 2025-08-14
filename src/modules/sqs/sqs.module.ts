import { Module, Global } from '@nestjs/common';
import { SqsProducerService } from './services/sqs-producer.service';
import { SqsConsumerService } from './services/sqs-consumer.service';

@Global()
@Module({
  providers: [SqsProducerService, SqsConsumerService],
  exports: [SqsProducerService, SqsConsumerService],
})
export class SqsModule {}