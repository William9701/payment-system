import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQS } from 'aws-sdk';
import {
  PaymentEvent,
  PaymentEventType,
} from '../interfaces/payment-event.interface';

@Injectable()
export class SqsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsConsumerService.name);
  private readonly sqs: SQS | null;
  private readonly queueUrl: string | null;
  private isRunning = false;
  private pollingTimeout: NodeJS.Timeout | null = null;
  private readonly maxMessages = 10; // Maximum messages to receive per poll
  private readonly waitTimeSeconds = 20; // Long polling wait time
  private readonly visibilityTimeoutSeconds = 60; // Message visibility timeout

  constructor(private readonly configService: ConfigService) {
    const awsConfig = this.configService.get('app.aws');
    
    // Check if AWS credentials are configured (check for empty strings and undefined/null)
    if (!awsConfig || !awsConfig.region || awsConfig.region.trim() === '' || 
        !awsConfig.accessKeyId || awsConfig.accessKeyId.trim() === '' ||
        !awsConfig.secretAccessKey || awsConfig.secretAccessKey.trim() === '' ||
        !awsConfig.sqsQueueUrl || awsConfig.sqsQueueUrl.trim() === '') {
      this.logger.warn('AWS credentials not configured. SQS consumer will be disabled.');
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

  async onModuleInit() {
    this.logger.log('SQS Consumer Service initialized');
    if (this.sqs && this.queueUrl) {
      await this.startPolling();
    } else {
      this.logger.log('SQS Consumer Service disabled - no AWS credentials configured');
    }
  }

  async onModuleDestroy() {
    this.logger.log('SQS Consumer Service shutting down');
    await this.stopPolling();
  }

  async startPolling(): Promise<void> {
    if (!this.sqs || !this.queueUrl) {
      this.logger.log('SQS Consumer Service is disabled');
      return;
    }

    if (this.isRunning) {
      this.logger.warn('SQS polling already running');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting SQS message polling');
    this.poll();
  }

  async stopPolling(): Promise<void> {
    this.isRunning = false;
    
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }

    this.logger.log('SQS message polling stopped');
  }

  private async poll(): Promise<void> {
    if (!this.isRunning || !this.sqs || !this.queueUrl) {
      return;
    }

    try {
      const messages = await this.receiveMessages();
      
      if (messages && messages.length > 0) {
        this.logger.log(`Received ${messages.length} messages from SQS`);
        await this.processMessages(messages);
      }
    } catch (error) {
      this.logger.error(`Error polling SQS: ${error.message}`, error.stack);
    }

    // Schedule next poll
    this.pollingTimeout = setTimeout(() => this.poll(), 1000);
  }

  private async receiveMessages(): Promise<SQS.Message[]> {
    if (!this.sqs || !this.queueUrl) {
      return [];
    }

    try {
      const params: SQS.ReceiveMessageRequest = {
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: this.maxMessages,
        WaitTimeSeconds: this.waitTimeSeconds,
        VisibilityTimeout: this.visibilityTimeoutSeconds,
        MessageAttributeNames: ['All'],
      };

      const result = await this.sqs.receiveMessage(params).promise();
      return result.Messages || [];
    } catch (error) {
      this.logger.error(`Failed to receive messages from SQS: ${error.message}`);
      throw error;
    }
  }

  private async processMessages(messages: SQS.Message[]): Promise<void> {
    const processPromises = messages.map(message => this.processMessage(message));
    await Promise.allSettled(processPromises);
  }

  private async processMessage(message: SQS.Message): Promise<void> {
    try {
      if (!message.Body) {
        this.logger.warn('Received message without body');
        await this.deleteMessage(message.ReceiptHandle!);
        return;
      }

      // Parse the payment event
      const paymentEvent: PaymentEvent = JSON.parse(message.Body);
      
      // Log event details
      this.logEventDetails(paymentEvent, message);

      // Process the event based on type
      await this.handlePaymentEvent(paymentEvent);

      // Delete the message after successful processing
      await this.deleteMessage(message.ReceiptHandle!);
      
      this.logger.log(`Successfully processed message for event ${paymentEvent.eventType}`);
    } catch (error) {
      this.logger.error(
        `Failed to process SQS message: ${error.message}`,
        error.stack,
      );

      // Check if message should be retried or sent to DLQ
      await this.handleFailedMessage(message, error);
    }
  }

  private logEventDetails(paymentEvent: PaymentEvent, message: SQS.Message): void {
    const eventDetails = {
      eventId: paymentEvent.eventId,
      eventType: paymentEvent.eventType,
      timestamp: paymentEvent.timestamp,
      paymentId: paymentEvent.data.paymentId,
      reference: paymentEvent.data.reference,
      merchantId: paymentEvent.data.merchantId,
      amount: paymentEvent.data.amount,
      currency: paymentEvent.data.currency,
      status: paymentEvent.data.status,
      gateway: paymentEvent.data.gateway,
      correlationId: paymentEvent.correlationId,
      retryCount: paymentEvent.retryCount || 0,
    };

    this.logger.log(`Processing payment event: ${JSON.stringify(eventDetails, null, 2)}`);

    // Log message attributes
    if (message.MessageAttributes) {
      const attributes = Object.keys(message.MessageAttributes).reduce((acc, key) => {
        const stringValue = message.MessageAttributes![key].StringValue;
        if (stringValue) {
          acc[key] = stringValue;
        }
        return acc;
      }, {} as Record<string, string>);
      
      this.logger.debug(`Message attributes: ${JSON.stringify(attributes, null, 2)}`);
    }
  }

  private async handlePaymentEvent(paymentEvent: PaymentEvent): Promise<void> {
    switch (paymentEvent.eventType) {
      case PaymentEventType.PAYMENT_INITIATED:
        await this.handlePaymentInitiated(paymentEvent);
        break;
      case PaymentEventType.PAYMENT_PROCESSING:
        await this.handlePaymentProcessing(paymentEvent);
        break;
      case PaymentEventType.PAYMENT_COMPLETED:
        await this.handlePaymentCompleted(paymentEvent);
        break;
      case PaymentEventType.PAYMENT_FAILED:
        await this.handlePaymentFailed(paymentEvent);
        break;
      case PaymentEventType.PAYMENT_CANCELLED:
        await this.handlePaymentCancelled(paymentEvent);
        break;
      case PaymentEventType.PAYMENT_REFUNDED:
        await this.handlePaymentRefunded(paymentEvent);
        break;
      case PaymentEventType.PAYMENT_DISPUTED:
        await this.handlePaymentDisputed(paymentEvent);
        break;
      default:
        this.logger.warn(`Unknown payment event type: ${paymentEvent.eventType}`);
    }
  }

  private async handlePaymentInitiated(paymentEvent: PaymentEvent): Promise<void> {
    this.logger.log(`Payment initiated: ${paymentEvent.data.reference} for merchant ${paymentEvent.data.merchantId}`);
    
    // In a real application, you might:
    // 1. Send notification to merchant
    // 2. Log to analytics/monitoring system
    // 3. Trigger business workflows
    // 4. Update external systems
    
    this.logBusinessEvent('Payment Initiated', paymentEvent);
  }

  private async handlePaymentProcessing(paymentEvent: PaymentEvent): Promise<void> {
    this.logger.log(`Payment processing: ${paymentEvent.data.reference}`);
    this.logBusinessEvent('Payment Processing', paymentEvent);
  }

  private async handlePaymentCompleted(paymentEvent: PaymentEvent): Promise<void> {
    this.logger.log(`Payment completed: ${paymentEvent.data.reference} - Amount: ${paymentEvent.data.amount} ${paymentEvent.data.currency}`);
    
    // In a real application, you might:
    // 1. Send confirmation email to customer
    // 2. Update inventory systems
    // 3. Trigger fulfillment processes
    // 4. Update merchant analytics
    // 5. Send webhook to merchant's system
    
    this.logBusinessEvent('Payment Completed', paymentEvent);
  }

  private async handlePaymentFailed(paymentEvent: PaymentEvent): Promise<void> {
    this.logger.log(`Payment failed: ${paymentEvent.data.reference} - Reason: ${paymentEvent.data.failureReason}`);
    
    // In a real application, you might:
    // 1. Send failure notification to customer
    // 2. Retry payment with different method
    // 3. Log failure analytics
    // 4. Alert merchant of failed payment
    
    this.logBusinessEvent('Payment Failed', paymentEvent);
  }

  private async handlePaymentCancelled(paymentEvent: PaymentEvent): Promise<void> {
    this.logger.log(`Payment cancelled: ${paymentEvent.data.reference}`);
    this.logBusinessEvent('Payment Cancelled', paymentEvent);
  }

  private async handlePaymentRefunded(paymentEvent: PaymentEvent): Promise<void> {
    this.logger.log(`Payment refunded: ${paymentEvent.data.reference} - Amount: ${paymentEvent.data.amount} ${paymentEvent.data.currency}`);
    
    // In a real application, you might:
    // 1. Send refund confirmation to customer
    // 2. Update accounting systems
    // 3. Reverse inventory allocations
    // 4. Update merchant balance
    
    this.logBusinessEvent('Payment Refunded', paymentEvent);
  }

  private async handlePaymentDisputed(paymentEvent: PaymentEvent): Promise<void> {
    this.logger.log(`Payment disputed: ${paymentEvent.data.reference}`);
    
    // In a real application, you might:
    // 1. Alert merchant of dispute
    // 2. Gather evidence for dispute response
    // 3. Update risk scoring
    // 4. Notify legal/compliance team
    
    this.logBusinessEvent('Payment Disputed', paymentEvent);
  }

  private logBusinessEvent(action: string, paymentEvent: PaymentEvent): void {
    const businessLog = {
      timestamp: new Date().toISOString(),
      action,
      eventId: paymentEvent.eventId,
      correlationId: paymentEvent.correlationId,
      payment: {
        id: paymentEvent.data.paymentId,
        reference: paymentEvent.data.reference,
        merchantId: paymentEvent.data.merchantId,
        amount: paymentEvent.data.amount,
        currency: paymentEvent.data.currency,
        gateway: paymentEvent.data.gateway,
        status: paymentEvent.data.status,
      },
      customer: {
        email: paymentEvent.data.customerEmail,
        name: paymentEvent.data.customerName,
      },
      metadata: paymentEvent.data.metadata,
    };

    // In production, you would send this to your logging/analytics system
    this.logger.log(`Business Event: ${JSON.stringify(businessLog, null, 2)}`);
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    if (!this.sqs || !this.queueUrl) {
      return;
    }

    try {
      const params: SQS.DeleteMessageRequest = {
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      };

      await this.sqs.deleteMessage(params).promise();
    } catch (error) {
      this.logger.error(`Failed to delete message: ${error.message}`);
      throw error;
    }
  }

  private async handleFailedMessage(message: SQS.Message, error: Error): Promise<void> {
    // Get message attributes to check retry count
    const retryCount = this.getRetryCount(message);
    const maxRetries = 3;

    if (retryCount < maxRetries) {
      this.logger.warn(`Message processing failed, will retry (${retryCount + 1}/${maxRetries})`);
      // Message will be retried automatically due to visibility timeout
      return;
    }

    this.logger.error(`Message processing failed after ${maxRetries} retries, moving to DLQ or deleting`);
    
    // In production, you might want to send to a Dead Letter Queue (DLQ)
    // For now, we'll delete the message to prevent infinite retries
    await this.deleteMessage(message.ReceiptHandle!);
  }

  private getRetryCount(message: SQS.Message): number {
    // In a real implementation, you might track retry count differently
    // This is a simplified version
    const approximateReceiveCount = message.Attributes?.ApproximateReceiveCount;
    return approximateReceiveCount ? parseInt(approximateReceiveCount) - 1 : 0;
  }

  async getQueueInfo(): Promise<any> {
    if (!this.sqs || !this.queueUrl) {
      return null;
    }

    try {
      const params: SQS.GetQueueAttributesRequest = {
        QueueUrl: this.queueUrl,
        AttributeNames: ['All'],
      };

      const result = await this.sqs.getQueueAttributes(params).promise();
      return result.Attributes;
    } catch (error) {
      this.logger.error(`Failed to get queue info: ${error.message}`);
      throw error;
    }
  }

  private validateMessage(message: SQS.Message): boolean {
    try {
      if (!message.Body) {
        this.logger.error('Message has no body');
        return false;
      }

      const paymentEvent: PaymentEvent = JSON.parse(message.Body);

      if (!paymentEvent.eventId || !paymentEvent.eventType || !paymentEvent.data) {
        this.logger.error('Message missing required fields');
        return false;
      }

      if (!paymentEvent.data.paymentId || !paymentEvent.data.reference || !paymentEvent.data.merchantId) {
        this.logger.error('Message data missing required fields');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to parse message: ${error.message}`);
      return false;
    }
  }
}