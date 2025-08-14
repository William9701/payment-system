import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQS } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  PaymentEvent,
  PaymentEventType,
  PaymentEventData,
  SQSMessageAttributes,
} from '../interfaces/payment-event.interface';

@Injectable()
export class SqsProducerService {
  private readonly logger = new Logger(SqsProducerService.name);
  private readonly sqs: SQS | null;
  private readonly queueUrl: string | null;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second base delay

  constructor(private readonly configService: ConfigService) {
    const awsConfig = this.configService.get('app.aws');
    
    // Check if AWS credentials are configured (check for empty strings and undefined/null)
    if (!awsConfig.region || awsConfig.region.trim() === '' || 
        !awsConfig.accessKeyId || awsConfig.accessKeyId.trim() === '' ||
        !awsConfig.secretAccessKey || awsConfig.secretAccessKey.trim() === '' ||
        !awsConfig.sqsQueueUrl || awsConfig.sqsQueueUrl.trim() === '') {
      this.logger.warn('AWS credentials not configured. SQS producer will be disabled.');
      this.sqs = null;
      this.queueUrl = null;
      return;
    }
    
    this.sqs = new SQS({
      region: awsConfig.region,
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey,
    });

    this.queueUrl = awsConfig.sqsQueueUrl;
  }

  async publishPaymentEvent(
    eventType: PaymentEventType,
    paymentData: PaymentEventData,
    correlationId?: string,
  ): Promise<string> {
    if (!this.sqs || !this.queueUrl) {
      this.logger.log(`SQS disabled - skipping event: ${eventType}`);
      return 'sqs-disabled';
    }

    const event: PaymentEvent = {
      eventType,
      eventId: uuidv4(),
      timestamp: new Date(),
      version: '1.0',
      source: 'payment-service',
      data: paymentData,
      correlationId: correlationId || uuidv4(),
      retryCount: 0,
    };

    return this.sendMessage(event);
  }

  async publishPaymentInitiated(paymentData: PaymentEventData): Promise<string> {
    this.logger.log(`Publishing payment initiated event for payment: ${paymentData.reference}`);
    return this.publishPaymentEvent(PaymentEventType.PAYMENT_INITIATED, paymentData);
  }

  async publishPaymentCompleted(paymentData: PaymentEventData): Promise<string> {
    this.logger.log(`Publishing payment completed event for payment: ${paymentData.reference}`);
    return this.publishPaymentEvent(PaymentEventType.PAYMENT_COMPLETED, paymentData);
  }

  async publishPaymentFailed(paymentData: PaymentEventData): Promise<string> {
    this.logger.log(`Publishing payment failed event for payment: ${paymentData.reference}`);
    return this.publishPaymentEvent(PaymentEventType.PAYMENT_FAILED, paymentData);
  }

  async publishPaymentCancelled(paymentData: PaymentEventData): Promise<string> {
    this.logger.log(`Publishing payment cancelled event for payment: ${paymentData.reference}`);
    return this.publishPaymentEvent(PaymentEventType.PAYMENT_CANCELLED, paymentData);
  }

  async publishPaymentRefunded(paymentData: PaymentEventData): Promise<string> {
    this.logger.log(`Publishing payment refunded event for payment: ${paymentData.reference}`);
    return this.publishPaymentEvent(PaymentEventType.PAYMENT_REFUNDED, paymentData);
  }

  private async sendMessage(event: PaymentEvent, retryCount = 0): Promise<string> {
    if (!this.sqs || !this.queueUrl) {
      this.logger.log('SQS disabled - message not sent');
      return 'sqs-disabled';
    }

    try {
      const messageAttributes: SQSMessageAttributes = {
        eventType: {
          DataType: 'String',
          StringValue: event.eventType,
        },
        merchantId: {
          DataType: 'String',
          StringValue: event.data.merchantId,
        },
        paymentId: {
          DataType: 'String',
          StringValue: event.data.paymentId,
        },
        timestamp: {
          DataType: 'String',
          StringValue: event.timestamp.toISOString(),
        },
      };

      const params: SQS.SendMessageRequest = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(event),
        MessageAttributes: messageAttributes as unknown as SQS.MessageBodyAttributeMap,
        MessageGroupId: `merchant-${event.data.merchantId}`, // For FIFO queues
        MessageDeduplicationId: event.eventId,
      };

      const result = await this.sqs.sendMessage(params).promise();

      this.logger.log(
        `Successfully sent SQS message for event ${event.eventType} with MessageId: ${result.MessageId}`,
      );

      return result.MessageId!;
    } catch (error) {
      this.logger.error(
        `Failed to send SQS message for event ${event.eventType}: ${error.message}`,
        error.stack,
      );

      // Retry logic with exponential backoff
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        this.logger.warn(`Retrying SQS message send in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        
        await this.sleep(delay);
        return this.sendMessage({ ...event, retryCount: retryCount + 1 }, retryCount + 1);
      }

      // If all retries failed, throw the error
      throw new Error(`Failed to send SQS message after ${this.maxRetries} retries: ${error.message}`);
    }
  }

  async sendBatchMessages(events: PaymentEvent[]): Promise<void> {
    if (events.length === 0) return;

    // SQS batch size limit is 10 messages
    const batchSize = 10;
    const batches = this.chunkArray(events, batchSize);

    for (const batch of batches) {
      await this.sendMessageBatch(batch);
    }
  }

  private async sendMessageBatch(events: PaymentEvent[]): Promise<void> {
    if (!this.sqs || !this.queueUrl) {
      this.logger.log('SQS disabled - batch messages not sent');
      return;
    }

    try {
      const entries: SQS.SendMessageBatchRequestEntry[] = events.map((event, index) => ({
        Id: `msg-${index}`,
        MessageBody: JSON.stringify(event),
        MessageAttributes: {
          eventType: {
            DataType: 'String',
            StringValue: event.eventType,
          },
          merchantId: {
            DataType: 'String',
            StringValue: event.data.merchantId,
          },
          paymentId: {
            DataType: 'String',
            StringValue: event.data.paymentId,
          },
          timestamp: {
            DataType: 'String',
            StringValue: event.timestamp.toISOString(),
          },
        },
        MessageGroupId: `merchant-${event.data.merchantId}`,
        MessageDeduplicationId: event.eventId,
      }));

      const params: SQS.SendMessageBatchRequest = {
        QueueUrl: this.queueUrl,
        Entries: entries,
      };

      const result = await this.sqs.sendMessageBatch(params).promise();

      this.logger.log(`Successfully sent batch of ${entries.length} messages to SQS`);

      // Handle any failed messages
      if (result.Failed && result.Failed.length > 0) {
        this.logger.error(`Failed to send ${result.Failed.length} messages in batch:`, result.Failed);
        
        // Retry failed messages individually
        const failedEvents = result.Failed.map(failed => {
          const index = parseInt(failed.Id.split('-')[1]);
          return events[index];
        });

        for (const failedEvent of failedEvents) {
          await this.sendMessage(failedEvent);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send batch messages to SQS: ${error.message}`, error.stack);
      
      // Fallback to individual message sending
      for (const event of events) {
        await this.sendMessage(event);
      }
    }
  }

  async getQueueAttributes(): Promise<SQS.GetQueueAttributesResult | null> {
    if (!this.sqs || !this.queueUrl) {
      return null;
    }

    try {
      const params: SQS.GetQueueAttributesRequest = {
        QueueUrl: this.queueUrl,
        AttributeNames: ['All'],
      };

      return await this.sqs.getQueueAttributes(params).promise();
    } catch (error) {
      this.logger.error(`Failed to get queue attributes: ${error.message}`);
      throw error;
    }
  }

  async purgeQueue(): Promise<void> {
    if (!this.sqs || !this.queueUrl) {
      this.logger.log('SQS disabled - queue not purged');
      return;
    }

    try {
      const params: SQS.PurgeQueueRequest = {
        QueueUrl: this.queueUrl,
      };

      await this.sqs.purgeQueue(params).promise();
      this.logger.log('Successfully purged SQS queue');
    } catch (error) {
      this.logger.error(`Failed to purge queue: ${error.message}`);
      throw error;
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}