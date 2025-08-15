import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';

import { WebhookService } from './webhook.service';
import { PaymentService } from '../../payments/services/payment.service';
import { PaymentMethod, PaymentMethodType, PaymentMethodStatus } from '../../payment-methods/entities/payment-method.entity';
import { ProcessWebhookDto } from '../dto/webhook.dto';
import { PaymentGateway, PaymentStatus, Currency, PaymentType } from '../../payments/entities/payment.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { MerchantType, MerchantStatus } from '../../merchants/entities/merchant.entity';

describe('WebhookService', () => {
  let service: WebhookService;
  let paymentMethodRepository: jest.Mocked<Repository<PaymentMethod>>;
  let paymentService: jest.Mocked<PaymentService>;

  const mockMerchant: Merchant = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    name: 'Test Merchant',
    password: '$2b$10$hashedpassword',
    merchantType: MerchantType.INDIVIDUAL,
    status: MerchantStatus.ACTIVE,
    phone: '+1234567890',
    businessId: undefined,
    totalProcessedAmount: 0,
    totalTransactions: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    updatedBy: 'system',
    payments: [],
    paymentMethods: [],
  } as Merchant;

  const mockPaymentMethod = {
    id: '660e8400-e29b-41d4-a716-446655440000',
    name: 'Test Stripe Payment Method',
    type: PaymentMethodType.STRIPE,
    status: PaymentMethodStatus.ACTIVE,
    isDefault: true,
    merchant: mockMerchant,
    merchantId: mockMerchant.id,
    encryptedData: 'encrypted_stripe_data',
    externalId: 'stripe_account_123',
    externalProvider: 'stripe',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    updatedBy: 'system',
    payments: [],
    setSecureData: jest.fn(),
    getSecureData: jest.fn(),
    webhookSecret: 'test_webhook_secret',
    gateway: PaymentGateway.STRIPE,
    isActive: true,
  } as PaymentMethod & { webhookSecret: string; gateway: PaymentGateway; isActive: boolean };

  const mockPayment = {
    id: '770e8400-e29b-41d4-a716-446655440000',
    reference: 'PAY_12345678',
    amount: 100.50,
    currency: Currency.USD,
    gateway: PaymentGateway.STRIPE,
    status: PaymentStatus.PENDING,
    paymentType: PaymentType.PAYMENT,
    description: 'Test payment',
    customerEmail: 'customer@example.com',
    externalId: 'pi_1234567890',
    gatewayReference: undefined,
    gatewayResponse: undefined,
    gatewayFee: 0,
    platformFee: 0,
    merchant: mockMerchant,
    merchantId: mockMerchant.id,
    paymentMethod: mockPaymentMethod,
    paymentMethodId: mockPaymentMethod.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    updatedBy: 'system',
    webhookAttempts: 0,
    webhookDelivered: false,
    generateReference: jest.fn(),
    isSuccessful: jest.fn(),
    isFailed: jest.fn(),
    isPending: jest.fn(),
    canBeRefunded: jest.fn(),
    calculateNetAmount: jest.fn(),
  } as Payment;

  beforeEach(async () => {
    const mockPaymentMethodRepository = {
      findOne: jest.fn(),
    };

    const mockPaymentService = {
      updatePaymentStatus: jest.fn(),
      getPaymentByReference: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: getRepositoryToken(PaymentMethod),
          useValue: mockPaymentMethodRepository,
        },
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    paymentMethodRepository = module.get(getRepositoryToken(PaymentMethod));
    paymentService = module.get(PaymentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processWebhook', () => {
    const webhookDto: ProcessWebhookDto = {
      gateway: PaymentGateway.STRIPE,
      payload: {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1234567890',
            status: 'succeeded',
            amount: 10050,
            metadata: {
              payment_reference: 'PAY_12345678',
            },
          },
        },
      },
      signature: 'valid_signature',
    };

    it('should successfully process a webhook', async () => {
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      jest.spyOn(service as any, 'verifyWebhookSignature').mockReturnValue(true);
      jest.spyOn(service as any, 'extractPaymentDataFromWebhook').mockReturnValue({
        reference: 'PAY_12345678',
        status: PaymentStatus.COMPLETED,
        externalId: 'pi_1234567890',
      });
      paymentService.updatePaymentStatus.mockResolvedValue(mockPayment);

      const result = await service.processWebhook(webhookDto);

      expect(paymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: { type: PaymentGateway.STRIPE, status: PaymentMethodStatus.ACTIVE },
      });
      expect(service['verifyWebhookSignature']).toHaveBeenCalledWith(
        webhookDto.payload,
        webhookDto.signature,
        mockPaymentMethod.webhookSecret,
        PaymentGateway.STRIPE,
      );
      expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith('PAY_12345678', {
        status: PaymentStatus.COMPLETED,
        gatewayReference: 'pi_1234567890',
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Webhook processed successfully');
    });

    it('should throw NotFoundException if payment method not found', async () => {
      paymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(service.processWebhook(webhookDto)).rejects.toThrow(NotFoundException);
      expect(paymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: { type: PaymentGateway.STRIPE, status: PaymentMethodStatus.ACTIVE },
      });
    });

    it('should throw BadRequestException for invalid signature', async () => {
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      jest.spyOn(service as any, 'verifyWebhookSignature').mockReturnValue(false);

      await expect(service.processWebhook(webhookDto)).rejects.toThrow(BadRequestException);
      expect(service['verifyWebhookSignature']).toHaveBeenCalled();
    });

    it('should handle webhook processing errors gracefully', async () => {
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      jest.spyOn(service as any, 'verifyWebhookSignature').mockReturnValue(true);
      jest.spyOn(service as any, 'extractPaymentDataFromWebhook').mockImplementation(() => {
        throw new Error('Invalid webhook payload');
      });

      const result = await service.processWebhook(webhookDto);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to process webhook');
    });
  });

  describe('processStripeWebhook', () => {
    const stripePayload = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_1234567890',
          status: 'succeeded',
          amount: 10050,
          metadata: {
            payment_reference: 'PAY_12345678',
          },
        },
      },
    };

    it('should process Stripe webhook successfully', async () => {
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      jest.spyOn(service as any, 'verifyWebhookSignature').mockReturnValue(true);
      paymentService.updatePaymentStatus.mockResolvedValue(mockPayment);

      const result = await service.processStripeWebhook(stripePayload, 'valid_signature');

      expect(paymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: { type: PaymentGateway.STRIPE, status: PaymentMethodStatus.ACTIVE },
      });
      expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith('PAY_12345678', {
        status: PaymentStatus.COMPLETED,
        gatewayReference: 'pi_1234567890',
      });
      expect(result.success).toBe(true);
    });

    it('should handle payment_intent.payment_failed events', async () => {
      const failedPayload = {
        ...stripePayload,
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            ...stripePayload.data.object,
            status: 'failed',
          },
        },
      };

      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      jest.spyOn(service as any, 'verifyWebhookSignature').mockReturnValue(true);
      paymentService.updatePaymentStatus.mockResolvedValue({ ...mockPayment, status: PaymentStatus.FAILED });

      const result = await service.processStripeWebhook(failedPayload, 'valid_signature');

      expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith('PAY_12345678', {
        status: PaymentStatus.FAILED,
        gatewayReference: 'pi_1234567890',
      });
      expect(result.success).toBe(true);
    });

    it('should ignore unsupported Stripe event types', async () => {
      const unsupportedPayload = {
        ...stripePayload,
        type: 'customer.created',
      };

      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      jest.spyOn(service as any, 'verifyWebhookSignature').mockReturnValue(true);

      const result = await service.processStripeWebhook(unsupportedPayload, 'valid_signature');

      expect(paymentService.updatePaymentStatus).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Unsupported event type');
    });
  });

  describe('processPaystackWebhook', () => {
    const paystackPayload = {
      event: 'charge.success',
      data: {
        id: 'trx_123456',
        status: 'success',
        amount: 10050,
        reference: 'PAY_12345678',
      },
    };

    it('should process Paystack webhook successfully', async () => {
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      jest.spyOn(service as any, 'verifyWebhookSignature').mockReturnValue(true);
      paymentService.updatePaymentStatus.mockResolvedValue(mockPayment);

      const result = await service.processPaystackWebhook(paystackPayload, 'valid_signature');

      expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith('PAY_12345678', {
        status: PaymentStatus.COMPLETED,
        gatewayReference: 'trx_123456',
      });
      expect(result.success).toBe(true);
    });

    it('should handle failed Paystack events', async () => {
      const failedPayload = {
        ...paystackPayload,
        event: 'charge.failed',
        data: {
          ...paystackPayload.data,
          status: 'failed',
        },
      };

      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      jest.spyOn(service as any, 'verifyWebhookSignature').mockReturnValue(true);
      paymentService.updatePaymentStatus.mockResolvedValue({ ...mockPayment, status: PaymentStatus.FAILED });

      const result = await service.processPaystackWebhook(failedPayload, 'valid_signature');

      expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith('PAY_12345678', {
        status: PaymentStatus.FAILED,
        gatewayReference: 'trx_123456',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('verifyWebhookSignature', () => {
    const payload = { test: 'data' };
    const secret = 'webhook_secret';

    it('should verify Stripe webhook signature correctly', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const rawBody = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`, 'utf8')
        .digest('hex');
      const signature = `t=${timestamp},v1=${expectedSignature}`;

      const result = service['verifyWebhookSignature'](payload, signature, secret, PaymentGateway.STRIPE);

      expect(result).toBe(true);
    });

    it('should verify Paystack webhook signature correctly', () => {
      const rawBody = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha512', secret)
        .update(rawBody, 'utf8')
        .digest('hex');

      const result = service['verifyWebhookSignature'](payload, expectedSignature, secret, PaymentGateway.PAYSTACK);

      expect(result).toBe(true);
    });

    it('should verify Flutterwave webhook signature correctly', () => {
      const rawBody = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('hex');

      const result = service['verifyWebhookSignature'](payload, expectedSignature, secret, PaymentGateway.FLUTTERWAVE);

      expect(result).toBe(true);
    });

    it('should return false for invalid Stripe signature', () => {
      const result = service['verifyWebhookSignature'](payload, 'invalid_signature', secret, PaymentGateway.STRIPE);

      expect(result).toBe(false);
    });

    it('should return false for expired Stripe signature', () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 1000; // 1000 seconds ago
      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${oldTimestamp}.${rawBody}`, 'utf8')
        .digest('hex');
      const stripeSignature = `t=${oldTimestamp},v1=${signature}`;

      const result = service['verifyWebhookSignature'](payload, stripeSignature, secret, PaymentGateway.STRIPE);

      expect(result).toBe(false);
    });

    it('should return true for unsupported gateway (no verification)', () => {
      const result = service['verifyWebhookSignature'](payload, 'any_signature', secret, 'UNSUPPORTED' as PaymentGateway);

      expect(result).toBe(true);
    });
  });

  describe('extractPaymentDataFromWebhook', () => {
    it('should extract data from Stripe webhook', () => {
      const stripePayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1234567890',
            status: 'succeeded',
            metadata: {
              payment_reference: 'PAY_12345678',
            },
          },
        },
      };

      const result = service['extractPaymentDataFromWebhook'](stripePayload, PaymentGateway.STRIPE);

      expect(result).toEqual({
        reference: 'PAY_12345678',
        status: PaymentStatus.COMPLETED,
        externalId: 'pi_1234567890',
      });
    });

    it('should extract data from Paystack webhook', () => {
      const paystackPayload = {
        event: 'charge.success',
        data: {
          id: 'trx_123456',
          status: 'success',
          reference: 'PAY_12345678',
        },
      };

      const result = service['extractPaymentDataFromWebhook'](paystackPayload, PaymentGateway.PAYSTACK);

      expect(result).toEqual({
        reference: 'PAY_12345678',
        status: PaymentStatus.COMPLETED,
        externalId: 'trx_123456',
      });
    });

    it('should throw error for missing payment reference', () => {
      const invalidPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1234567890',
            status: 'succeeded',
            metadata: {},
          },
        },
      };

      expect(() => {
        service['extractPaymentDataFromWebhook'](invalidPayload, PaymentGateway.STRIPE);
      }).toThrow('Payment reference not found in webhook payload');
    });
  });
});