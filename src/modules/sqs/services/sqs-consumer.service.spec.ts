import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { SQS } from 'aws-sdk';

import { SqsConsumerService } from './sqs-consumer.service';
import { PaymentEventType, PaymentEvent, PaymentEventData } from '../interfaces/payment-event.interface';
import { PaymentGateway, Currency } from '../../payments/entities/payment.entity';

jest.mock('aws-sdk');

describe('SqsConsumerService', () => {
  let service: SqsConsumerService;
  let sqsClient: jest.Mocked<SQS>;
  let configService: jest.Mocked<ConfigService>;
  let logger: jest.Mocked<Logger>;

  const mockPaymentEventData: PaymentEventData = {
    paymentId: '550e8400-e29b-41d4-a716-446655440000',
    reference: 'PAY_12345678',
    amount: 100.50,
    currency: Currency.USD,
    gateway: PaymentGateway.STRIPE,
    merchantId: '660e8400-e29b-41d4-a716-446655440000',
    customerEmail: 'customer@example.com',
    metadata: { orderId: 'ORD_123' },
    status: 'pending',
    timestamp: new Date(),
  };

  const mockPaymentEvent: PaymentEvent = {
    eventType: PaymentEventType.PAYMENT_INITIATED,
    eventId: 'evt-123456',
    timestamp: new Date(),
    version: '1.0',
    source: 'payment-service',
    data: mockPaymentEventData,
  };

  const mockSqsMessage = {
    MessageId: 'msg-123456',
    ReceiptHandle: 'receipt-handle-123',
    Body: JSON.stringify(mockPaymentEvent),
    Attributes: {},
    MessageAttributes: {
      eventType: {
        StringValue: PaymentEventType.PAYMENT_INITIATED,
        DataType: 'String',
      },
      paymentId: {
        StringValue: mockPaymentEventData.paymentId,
        DataType: 'String',
      },
    },
  };

  beforeEach(async () => {
    const mockSqs = {
      receiveMessage: jest.fn(),
      deleteMessage: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqsConsumerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<SqsConsumerService>(SqsConsumerService);
    configService = module.get(ConfigService);
    logger = module.get(Logger);

    // Mock the SQS client
    sqsClient = mockSqs as any;
    (service as any).sqsClient = sqsClient;

    // Setup config service mock
    configService.get.mockImplementation((key: string) => {
      const config = {
        'aws.sqsQueueUrl': 'https://sqs.us-east-1.amazonaws.com/123456789/payment-events',
        'aws.region': 'us-east-1',
      };
      return config[key];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Stop polling if it's running
    (service as any).isPolling = false;
  });

  describe('startPolling', () => {
    it('should start polling and process messages', async () => {
      const receiveResponse = {
        Messages: [mockSqsMessage],
        promise: jest.fn().mockResolvedValue({ Messages: [mockSqsMessage] }),
      };
      const deleteResponse = {
        promise: jest.fn().mockResolvedValue({}),
      };

      sqsClient.receiveMessage.mockReturnValue(receiveResponse as any);
      sqsClient.deleteMessage.mockReturnValue(deleteResponse as any);

      // Spy on private methods
      const handlePaymentEventSpy = jest.spyOn(service as any, 'handlePaymentEvent').mockResolvedValue(undefined);
      const validateMessageSpy = jest.spyOn(service as any, 'validateMessage').mockReturnValue(true);

      // Start polling
      service.startPolling();

      // Wait for the polling cycle to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Stop polling
      service.stopPolling();

      expect(sqsClient.receiveMessage).toHaveBeenCalledWith({
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/payment-events',
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        VisibilityTimeoutSeconds: 300,
        MessageAttributeNames: ['All'],
      });

      expect(validateMessageSpy).toHaveBeenCalledWith(mockSqsMessage);
      expect(handlePaymentEventSpy).toHaveBeenCalledWith(mockPaymentEvent);
      expect(sqsClient.deleteMessage).toHaveBeenCalledWith({
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/payment-events',
        ReceiptHandle: mockSqsMessage.ReceiptHandle,
      });

      expect(logger.log).toHaveBeenCalledWith('SQS Consumer started polling for messages');
    });

    it('should handle errors gracefully during polling', async () => {
      const error = new Error('SQS connection error');
      sqsClient.receiveMessage.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error),
      } as any);

      service.startPolling();

      // Wait for the error to be handled
      await new Promise(resolve => setTimeout(resolve, 100));

      service.stopPolling();

      expect(logger.error).toHaveBeenCalledWith(
        'Error during SQS polling',
        expect.objectContaining({ error: error.message }),
      );
    });

    it('should not start polling if already polling', () => {
      (service as any).isPolling = true;

      service.startPolling();

      expect(logger.warn).toHaveBeenCalledWith('SQS Consumer is already polling');
      expect(sqsClient.receiveMessage).not.toHaveBeenCalled();
    });
  });

  describe('stopPolling', () => {
    it('should stop polling', () => {
      (service as any).isPolling = true;

      service.stopPolling();

      expect((service as any).isPolling).toBe(false);
      expect(logger.log).toHaveBeenCalledWith('SQS Consumer stopped polling');
    });

    it('should handle stop polling when not polling', () => {
      (service as any).isPolling = false;

      service.stopPolling();

      expect(logger.warn).toHaveBeenCalledWith('SQS Consumer is not currently polling');
    });
  });

  describe('processMessage', () => {
    it('should successfully process a valid message', async () => {
      const validateMessageSpy = jest.spyOn(service as any, 'validateMessage').mockReturnValue(true);
      const handlePaymentEventSpy = jest.spyOn(service as any, 'handlePaymentEvent').mockResolvedValue(undefined);
      const deleteResponse = {
        promise: jest.fn().mockResolvedValue({}),
      };
      sqsClient.deleteMessage.mockReturnValue(deleteResponse as any);

      await service['processMessage'](mockSqsMessage);

      expect(validateMessageSpy).toHaveBeenCalledWith(mockSqsMessage);
      expect(handlePaymentEventSpy).toHaveBeenCalledWith(mockPaymentEvent);
      expect(sqsClient.deleteMessage).toHaveBeenCalledWith({
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/payment-events',
        ReceiptHandle: mockSqsMessage.ReceiptHandle,
      });
      expect(logger.log).toHaveBeenCalledWith(
        `Successfully processed message: ${mockSqsMessage.MessageId}`,
        expect.any(Object),
      );
    });

    it('should handle invalid message format', async () => {
      const invalidMessage = { ...mockSqsMessage, Body: 'invalid-json' };
      const validateMessageSpy = jest.spyOn(service as any, 'validateMessage').mockReturnValue(false);

      await service['processMessage'](invalidMessage);

      expect(validateMessageSpy).toHaveBeenCalledWith(invalidMessage);
      expect(logger.error).toHaveBeenCalledWith(
        `Invalid message format: ${invalidMessage.MessageId}`,
        expect.any(Object),
      );
      expect(sqsClient.deleteMessage).not.toHaveBeenCalled();
    });

    it('should handle processing errors and delete message', async () => {
      const validateMessageSpy = jest.spyOn(service as any, 'validateMessage').mockReturnValue(true);
      const handlePaymentEventSpy = jest.spyOn(service as any, 'handlePaymentEvent')
        .mockRejectedValue(new Error('Processing error'));
      const deleteResponse = {
        promise: jest.fn().mockResolvedValue({}),
      };
      sqsClient.deleteMessage.mockReturnValue(deleteResponse as any);

      await service['processMessage'](mockSqsMessage);

      expect(handlePaymentEventSpy).toHaveBeenCalledWith(mockPaymentEvent);
      expect(logger.error).toHaveBeenCalledWith(
        `Error processing message: ${mockSqsMessage.MessageId}`,
        expect.any(Object),
      );
      expect(sqsClient.deleteMessage).toHaveBeenCalled();
    });
  });

  describe('handlePaymentEvent', () => {
    it('should handle PAYMENT_INITIATED event', async () => {
      const handlePaymentInitiatedSpy = jest.spyOn(service as any, 'handlePaymentInitiated')
        .mockResolvedValue(undefined);

      await service['handlePaymentEvent'](mockPaymentEvent);

      expect(handlePaymentInitiatedSpy).toHaveBeenCalledWith(mockPaymentEvent);
      expect(logger.debug).toHaveBeenCalledWith(
        `Handling payment event: ${mockPaymentEvent.eventType}`,
        expect.any(Object),
      );
    });

    it('should handle PAYMENT_COMPLETED event', async () => {
      const completedEvent = { ...mockPaymentEvent, eventType: PaymentEventType.PAYMENT_COMPLETED };
      const handlePaymentCompletedSpy = jest.spyOn(service as any, 'handlePaymentCompleted')
        .mockResolvedValue(undefined);

      await service['handlePaymentEvent'](completedEvent);

      expect(handlePaymentCompletedSpy).toHaveBeenCalledWith(completedEvent);
    });

    it('should handle PAYMENT_FAILED event', async () => {
      const failedEvent = { ...mockPaymentEvent, eventType: PaymentEventType.PAYMENT_FAILED };
      const handlePaymentFailedSpy = jest.spyOn(service as any, 'handlePaymentFailed')
        .mockResolvedValue(undefined);

      await service['handlePaymentEvent'](failedEvent);

      expect(handlePaymentFailedSpy).toHaveBeenCalledWith(failedEvent);
    });

    it('should handle unknown event types', async () => {
      const unknownEvent = { ...mockPaymentEvent, eventType: 'UNKNOWN_EVENT' as PaymentEventType };

      await service['handlePaymentEvent'](unknownEvent);

      expect(logger.warn).toHaveBeenCalledWith(
        `Unknown payment event type: UNKNOWN_EVENT`,
        expect.any(Object),
      );
    });
  });

  describe('event handlers', () => {
    describe('handlePaymentInitiated', () => {
      it('should log payment initiated event', async () => {
        await service['handlePaymentInitiated'](mockPaymentEvent);

        expect(logger.log).toHaveBeenCalledWith(
          `Payment initiated: ${mockPaymentEvent.data.reference}`,
          expect.objectContaining({
            eventId: mockPaymentEvent.eventId,
            paymentId: mockPaymentEvent.data.paymentId,
            reference: mockPaymentEvent.data.reference,
            amount: mockPaymentEvent.data.amount,
            currency: mockPaymentEvent.data.currency,
            gateway: mockPaymentEvent.data.gateway,
            merchantId: mockPaymentEvent.data.merchantId,
          }),
        );
      });
    });

    describe('handlePaymentCompleted', () => {
      it('should log payment completed event', async () => {
        await service['handlePaymentCompleted'](mockPaymentEvent);

        expect(logger.log).toHaveBeenCalledWith(
          `Payment completed: ${mockPaymentEvent.data.reference}`,
          expect.objectContaining({
            eventId: mockPaymentEvent.eventId,
            paymentId: mockPaymentEvent.data.paymentId,
            reference: mockPaymentEvent.data.reference,
            amount: mockPaymentEvent.data.amount,
            merchantId: mockPaymentEvent.data.merchantId,
          }),
        );
      });
    });

    describe('handlePaymentFailed', () => {
      it('should log payment failed event', async () => {
        await service['handlePaymentFailed'](mockPaymentEvent);

        expect(logger.log).toHaveBeenCalledWith(
          `Payment failed: ${mockPaymentEvent.data.reference}`,
          expect.objectContaining({
            eventId: mockPaymentEvent.eventId,
            paymentId: mockPaymentEvent.data.paymentId,
            reference: mockPaymentEvent.data.reference,
            amount: mockPaymentEvent.data.amount,
            merchantId: mockPaymentEvent.data.merchantId,
          }),
        );
      });
    });
  });

  describe('validateMessage', () => {
    it('should validate a correct message', () => {
      const result = service['validateMessage'](mockSqsMessage);

      expect(result).toBe(true);
    });

    it('should reject message with invalid JSON body', () => {
      const invalidMessage = { ...mockSqsMessage, Body: 'invalid-json' };

      const result = service['validateMessage'](invalidMessage);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        `Invalid JSON in message body: ${invalidMessage.MessageId}`,
        expect.any(Object),
      );
    });

    it('should reject message without required fields', () => {
      const invalidEvent = { ...mockPaymentEvent };
      delete (invalidEvent as any).eventType;
      const invalidMessage = { ...mockSqsMessage, Body: JSON.stringify(invalidEvent) };

      const result = service['validateMessage'](invalidMessage);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        `Missing required fields in payment event: ${invalidMessage.MessageId}`,
        expect.any(Object),
      );
    });

    it('should reject message with invalid event data', () => {
      const invalidEventData = { ...mockPaymentEventData };
      delete (invalidEventData as any).paymentId;
      const invalidEvent = { ...mockPaymentEvent, data: invalidEventData };
      const invalidMessage = { ...mockSqsMessage, Body: JSON.stringify(invalidEvent) };

      const result = service['validateMessage'](invalidMessage);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        `Missing required fields in payment event data: ${invalidMessage.MessageId}`,
        expect.any(Object),
      );
    });
  });
});