import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { SQS } from 'aws-sdk';

import { SqsProducerService } from './sqs-producer.service';
import { PaymentEventType, PaymentEventData, PaymentEvent } from '../interfaces/payment-event.interface';
import { PaymentGateway, Currency } from '../../payments/entities/payment.entity';

jest.mock('aws-sdk');

describe('SqsProducerService', () => {
  let service: SqsProducerService;
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

  const mockSqsResponse = {
    MessageId: 'msg-123456',
    MD5OfBody: 'abc123',
    promise: jest.fn().mockResolvedValue({
      MessageId: 'msg-123456',
      MD5OfBody: 'abc123',
    }),
  };

  beforeEach(async () => {
    const mockSqs = {
      sendMessage: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqsProducerService,
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

    service = module.get<SqsProducerService>(SqsProducerService);
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
  });

  describe('publishPaymentInitiated', () => {
    it('should successfully publish payment initiated event', async () => {
      sqsClient.sendMessage.mockReturnValue(mockSqsResponse as any);

      const result = await service.publishPaymentInitiated(mockPaymentEventData);

      expect(sqsClient.sendMessage).toHaveBeenCalledWith({
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/payment-events',
        MessageBody: expect.stringContaining('PAYMENT_INITIATED'),
        MessageAttributes: {
          eventType: {
            DataType: 'String',
            StringValue: PaymentEventType.PAYMENT_INITIATED,
          },
          paymentId: {
            DataType: 'String',
            StringValue: mockPaymentEventData.paymentId,
          },
          merchantId: {
            DataType: 'String',
            StringValue: mockPaymentEventData.merchantId,
          },
        },
        MessageGroupId: mockPaymentEventData.paymentId,
        MessageDeduplicationId: expect.stringMatching(/.+/),
      });
      expect(result).toBe('msg-123456');
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Published payment initiated event'),
        expect.any(Object),
      );
    });

    it('should handle and log SQS errors', async () => {
      const error = new Error('SQS service unavailable');
      sqsClient.sendMessage.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error),
      } as any);

      await expect(service.publishPaymentInitiated(mockPaymentEventData)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to publish payment initiated event'),
        expect.any(Object),
      );
    });
  });

  describe('publishPaymentCompleted', () => {
    it('should successfully publish payment completed event', async () => {
      sqsClient.sendMessage.mockReturnValue(mockSqsResponse as any);

      const result = await service.publishPaymentCompleted(mockPaymentEventData);

      expect(sqsClient.sendMessage).toHaveBeenCalledWith({
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/payment-events',
        MessageBody: expect.stringContaining('PAYMENT_COMPLETED'),
        MessageAttributes: {
          eventType: {
            DataType: 'String',
            StringValue: PaymentEventType.PAYMENT_COMPLETED,
          },
          paymentId: {
            DataType: 'String',
            StringValue: mockPaymentEventData.paymentId,
          },
          merchantId: {
            DataType: 'String',
            StringValue: mockPaymentEventData.merchantId,
          },
        },
        MessageGroupId: mockPaymentEventData.paymentId,
        MessageDeduplicationId: expect.stringMatching(/.+/),
      });
      expect(result).toBe('msg-123456');
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Published payment completed event'),
        expect.any(Object),
      );
    });
  });

  describe('publishPaymentFailed', () => {
    it('should successfully publish payment failed event', async () => {
      sqsClient.sendMessage.mockReturnValue(mockSqsResponse as any);

      const result = await service.publishPaymentFailed(mockPaymentEventData);

      expect(sqsClient.sendMessage).toHaveBeenCalledWith({
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/payment-events',
        MessageBody: expect.stringContaining('PAYMENT_FAILED'),
        MessageAttributes: {
          eventType: {
            DataType: 'String',
            StringValue: PaymentEventType.PAYMENT_FAILED,
          },
          paymentId: {
            DataType: 'String',
            StringValue: mockPaymentEventData.paymentId,
          },
          merchantId: {
            DataType: 'String',
            StringValue: mockPaymentEventData.merchantId,
          },
        },
        MessageGroupId: mockPaymentEventData.paymentId,
        MessageDeduplicationId: expect.stringMatching(/.+/),
      });
      expect(result).toBe('msg-123456');
    });
  });

  describe('publishPaymentEvent', () => {
    it('should successfully publish a generic payment event', async () => {
      sqsClient.sendMessage.mockReturnValue(mockSqsResponse as any);

      const result = await service.publishPaymentEvent(
        PaymentEventType.PAYMENT_INITIATED,
        mockPaymentEventData,
      );

      expect(sqsClient.sendMessage).toHaveBeenCalledWith({
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/payment-events',
        MessageBody: expect.stringContaining(PaymentEventType.PAYMENT_INITIATED),
        MessageAttributes: {
          eventType: {
            DataType: 'String',
            StringValue: PaymentEventType.PAYMENT_INITIATED,
          },
          paymentId: {
            DataType: 'String',
            StringValue: mockPaymentEventData.paymentId,
          },
          merchantId: {
            DataType: 'String',
            StringValue: mockPaymentEventData.merchantId,
          },
        },
        MessageGroupId: mockPaymentEventData.paymentId,
        MessageDeduplicationId: expect.stringMatching(/.+/),
      });
      expect(result).toBe('msg-123456');
    });

    it('should retry on failure and eventually succeed', async () => {
      sqsClient.sendMessage
        .mockReturnValueOnce({
          promise: jest.fn().mockRejectedValue(new Error('Network error')),
        } as any)
        .mockReturnValueOnce({
          promise: jest.fn().mockRejectedValue(new Error('Network error')),
        } as any)
        .mockReturnValueOnce(mockSqsResponse as any);

      const result = await service.publishPaymentEvent(
        PaymentEventType.PAYMENT_INITIATED,
        mockPaymentEventData,
      );

      expect(sqsClient.sendMessage).toHaveBeenCalledTimes(3);
      expect(result).toBe('msg-123456');
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('should fail after maximum retry attempts', async () => {
      const error = new Error('Persistent network error');
      sqsClient.sendMessage.mockReturnValue({
        promise: jest.fn().mockRejectedValue(error),
      } as any);

      await expect(
        service.publishPaymentEvent(PaymentEventType.PAYMENT_INITIATED, mockPaymentEventData),
      ).rejects.toThrow(error);

      expect(sqsClient.sendMessage).toHaveBeenCalledTimes(3); // Default max retries
      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to publish payment event after all retries'),
        expect.any(Object),
      );
    });
  });

  describe('private methods', () => {
    describe('sendMessage', () => {
      it('should send message with correct parameters', async () => {
        sqsClient.sendMessage.mockReturnValue(mockSqsResponse as any);

        const mockEvent: PaymentEvent = {
          eventType: PaymentEventType.PAYMENT_INITIATED,
          eventId: 'evt-123',
          timestamp: new Date(),
          version: '1.0',
          source: 'payment-service',
          data: mockPaymentEventData,
        };

        const result = await service['sendMessage'](mockEvent);

        expect(sqsClient.sendMessage).toHaveBeenCalledWith({
          QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/payment-events',
          MessageBody: JSON.stringify(mockEvent),
          MessageAttributes: {
            eventType: {
              DataType: 'String',
              StringValue: PaymentEventType.PAYMENT_INITIATED,
            },
            paymentId: {
              DataType: 'String',
              StringValue: mockPaymentEventData.paymentId,
            },
            merchantId: {
              DataType: 'String',
              StringValue: mockPaymentEventData.merchantId,
            },
          },
          MessageGroupId: mockPaymentEventData.paymentId,
          MessageDeduplicationId: expect.stringMatching(/.+/),
        });
        expect(result).toBe('msg-123456');
      });
    });

    describe('generateDeduplicationId', () => {
      it('should generate unique deduplication IDs', () => {
        const id1 = service['generateDeduplicationId']('event1', mockPaymentEventData.paymentId);
        const id2 = service['generateDeduplicationId']('event2', mockPaymentEventData.paymentId);
        const id3 = service['generateDeduplicationId']('event1', 'different-payment-id');

        expect(id1).not.toBe(id2);
        expect(id1).not.toBe(id3);
        expect(id2).not.toBe(id3);
        expect(id1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
      });

      it('should generate consistent IDs for same input', () => {
        const id1 = service['generateDeduplicationId']('event1', mockPaymentEventData.paymentId);
        const id2 = service['generateDeduplicationId']('event1', mockPaymentEventData.paymentId);

        expect(id1).toBe(id2);
      });
    });
  });
});