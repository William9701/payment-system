import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';

import { PaymentService } from './payment.service';
import { SqsProducerService } from '../../sqs/services/sqs-producer.service';
import { Payment } from '../entities/payment.entity';
import { PaymentMethod, PaymentMethodType, PaymentMethodStatus } from '../../payment-methods/entities/payment-method.entity';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { InitializePaymentDto, UpdatePaymentStatusDto } from '../dto/payment.dto';
import { PaymentStatus, PaymentGateway, Currency, PaymentType } from '../entities/payment.entity';
import { MerchantStatus, MerchantType } from '../../merchants/entities/merchant.entity';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: jest.Mocked<Repository<Payment>>;
  let paymentMethodRepository: jest.Mocked<Repository<PaymentMethod>>;
  let merchantRepository: jest.Mocked<Repository<Merchant>>;
  let sqsProducerService: jest.Mocked<SqsProducerService>;

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

  const mockPaymentMethod: PaymentMethod = {
    id: '660e8400-e29b-41d4-a716-446655440000',
    name: 'Test Stripe Payment Method',
    type: PaymentMethodType.STRIPE,
    status: PaymentMethodStatus.ACTIVE,
    isDefault: true,
    merchant: mockMerchant,
    merchantId: mockMerchant.id,
    encryptedData: 'encrypted_payment_data',
    externalId: 'stripe_account_123',
    externalProvider: 'stripe',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    updatedBy: 'system',
    payments: [],
    setSecureData: jest.fn(),
    getSecureData: jest.fn(),
  } as PaymentMethod;

  const mockPayment: Payment = {
    id: '770e8400-e29b-41d4-a716-446655440000',
    reference: 'PAY_12345678',
    amount: 100.50,
    currency: Currency.USD,
    gateway: PaymentGateway.STRIPE,
    status: PaymentStatus.PENDING,
    paymentType: PaymentType.PAYMENT,
    description: 'Test payment',
    customerEmail: 'customer@example.com',
    externalId: undefined,
    gatewayReference: undefined,
    gatewayResponse: undefined,
    gatewayFee: 0,
    platformFee: 0,
    netAmount: 100.50,
    webhookAttempts: 0,
    webhookDelivered: false,
    merchant: mockMerchant,
    merchantId: mockMerchant.id,
    paymentMethod: mockPaymentMethod,
    paymentMethodId: mockPaymentMethod.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    updatedBy: 'system',
    generateReference: jest.fn(),
    isSuccessful: jest.fn().mockReturnValue(false),
    isFailed: jest.fn().mockReturnValue(false),
    isPending: jest.fn().mockReturnValue(true),
    canBeRefunded: jest.fn().mockReturnValue(false),
    calculateNetAmount: jest.fn().mockReturnValue(100.50),
  } as Payment;

  beforeEach(async () => {
    const mockPaymentRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
      }),
    };

    const mockPaymentMethodRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const mockMerchantRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      }),
    };

    const mockSqsProducerService = {
      publishPaymentInitiated: jest.fn(),
      publishPaymentCompleted: jest.fn(),
      publishPaymentFailed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(PaymentMethod),
          useValue: mockPaymentMethodRepository,
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: mockMerchantRepository,
        },
        {
          provide: SqsProducerService,
          useValue: mockSqsProducerService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRepository = module.get(getRepositoryToken(Payment));
    paymentMethodRepository = module.get(getRepositoryToken(PaymentMethod));
    merchantRepository = module.get(getRepositoryToken(Merchant));
    sqsProducerService = module.get(SqsProducerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializePayment', () => {
    const initializeDto: InitializePaymentDto = {
      amount: 100.50,
      currency: Currency.USD,
      gateway: PaymentGateway.STRIPE,
      description: 'Test payment',
      customerEmail: 'customer@example.com',
      paymentMethodId: mockPaymentMethod.id,
    };

    it('should successfully initialize a payment', async () => {
      merchantRepository.findOne.mockResolvedValue(mockMerchant);
      paymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      paymentRepository.create.mockReturnValue(mockPayment);
      paymentRepository.save.mockResolvedValue(mockPayment);
      sqsProducerService.publishPaymentInitiated.mockResolvedValue('message-id');

      const result = await service.initializePayment(mockMerchant.id, initializeDto);

      expect(merchantRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockMerchant.id },
      });
      expect(paymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: initializeDto.paymentMethodId,
          merchantId: mockMerchant.id,
        },
      });
      expect(paymentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        amount: initializeDto.amount,
        currency: initializeDto.currency,
        description: initializeDto.description,
        customerEmail: initializeDto.customerEmail,
        gateway: initializeDto.gateway,
        merchantId: mockMerchant.id,
        paymentMethodId: mockPaymentMethod.id,
        status: PaymentStatus.PENDING,
        paymentType: PaymentType.PAYMENT,
        createdBy: mockMerchant.id,
        updatedBy: mockMerchant.id,
      }));
      expect(paymentRepository.save).toHaveBeenCalledWith(mockPayment);
      expect(sqsProducerService.publishPaymentInitiated).toHaveBeenCalledWith(expect.objectContaining({
        paymentId: mockPayment.id,
        reference: mockPayment.reference,
        amount: mockPayment.amount,
        currency: mockPayment.currency,
        gateway: mockPayment.gateway,
        merchantId: mockMerchant.id,
        customerEmail: mockPayment.customerEmail,
        status: PaymentStatus.PENDING,
      }));
      expect(result.reference).toBe(mockPayment.reference);
      expect(result.amount).toBe(mockPayment.amount);
      expect(result.status).toBe(PaymentStatus.PENDING);
    });

    it('should throw NotFoundException if merchant not found', async () => {
      merchantRepository.findOne.mockResolvedValue(null);

      await expect(service.initializePayment('invalid-id', initializeDto)).rejects.toThrow(NotFoundException);
      expect(paymentMethodRepository.findOne).not.toHaveBeenCalled();
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if merchant is not active', async () => {
      const inactiveMerchant = { ...mockMerchant, status: MerchantStatus.SUSPENDED };
      merchantRepository.findOne.mockResolvedValue(inactiveMerchant);

      await expect(service.initializePayment(mockMerchant.id, initializeDto)).rejects.toThrow(ForbiddenException);
      expect(paymentMethodRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if payment method not found', async () => {
      merchantRepository.findOne.mockResolvedValue(mockMerchant);
      paymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(service.initializePayment(mockMerchant.id, initializeDto)).rejects.toThrow(NotFoundException);
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent merchant', async () => {
      merchantRepository.findOne.mockResolvedValue(null);

      await expect(service.initializePayment('invalid-id', initializeDto)).rejects.toThrow(NotFoundException);
      expect(merchantRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'invalid-id' },
      });
    });
  });

  describe('getPaymentByReference', () => {
    it('should return payment by reference for merchant', async () => {
      paymentRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.getPayment(mockPayment.reference, mockMerchant.id);

      expect(paymentRepository.findOne).toHaveBeenCalledWith({
        where: {
          reference: mockPayment.reference,
          merchantId: mockMerchant.id,
        },
        relations: ['paymentMethod'],
      });
      expect(result.reference).toBe(mockPayment.reference);
    });

    it('should throw NotFoundException if payment not found', async () => {
      paymentRepository.findOne.mockResolvedValue(null);

      await expect(service.getPayment('invalid-ref', mockMerchant.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePaymentStatus', () => {
    const updateDto: UpdatePaymentStatusDto = {
      status: PaymentStatus.COMPLETED,
      gatewayReference: 'txn_123456',
    };

    it('should successfully update payment status to completed', async () => {
      paymentRepository.findOne.mockResolvedValue(mockPayment);
      const updatedPayment = { ...mockPayment, status: updateDto.status, gatewayReference: updateDto.gatewayReference };
      paymentRepository.save.mockResolvedValue(updatedPayment as Payment);
      sqsProducerService.publishPaymentCompleted.mockResolvedValue('message-id');

      const result = await service.updatePaymentStatus(mockPayment.reference, updateDto);

      expect(paymentRepository.findOne).toHaveBeenCalled();
      expect(paymentRepository.update).toHaveBeenCalled();
      expect(sqsProducerService.publishPaymentCompleted).toHaveBeenCalled();
      expect(result.status).toBe(PaymentStatus.COMPLETED);
    });

    it('should publish failed event for failed payment', async () => {
      const failedDto = { ...updateDto, status: PaymentStatus.FAILED };
      paymentRepository.findOne.mockResolvedValue(mockPayment);
      const updatedPayment = { ...mockPayment, status: failedDto.status, gatewayReference: failedDto.gatewayReference };
      paymentRepository.save.mockResolvedValue(updatedPayment as Payment);
      sqsProducerService.publishPaymentFailed.mockResolvedValue('message-id');

      await service.updatePaymentStatus(mockPayment.reference, failedDto);

      expect(sqsProducerService.publishPaymentFailed).toHaveBeenCalled();
      expect(sqsProducerService.publishPaymentCompleted).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if payment not found', async () => {
      paymentRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePaymentStatus('invalid-ref', updateDto)).rejects.toThrow(NotFoundException);
      expect(paymentRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if payment already completed', async () => {
      const completedPayment = { ...mockPayment, status: PaymentStatus.COMPLETED };
      paymentRepository.findOne.mockResolvedValue(completedPayment as Payment);

      await expect(service.updatePaymentStatus(mockPayment.reference, updateDto)).rejects.toThrow(BadRequestException);
      expect(paymentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getMerchantPayments', () => {
    it('should return paginated merchant payments', async () => {
      const mockPayments = [mockPayment];
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockPayments, 1]),
      };
      paymentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getPaymentsByMerchant(mockMerchant.id, 1, 10, PaymentStatus.PENDING);

      expect(paymentRepository.createQueryBuilder).toHaveBeenCalledWith('payment');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('payment.merchantId = :merchantId', {
        merchantId: mockMerchant.id,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('payment.status = :status', {
        status: PaymentStatus.PENDING,
      });
      expect(result.payments).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should return payments without status filter', async () => {
      const mockPayments = [mockPayment];
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockPayments, 1]),
      };
      paymentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getPaymentsByMerchant(mockMerchant.id, 1, 10);

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(result.payments).toHaveLength(1);
    });
  });

  describe('getMerchantPaymentStatistics', () => {
    it('should return merchant payment statistics', async () => {
      const mockStats = [
        { status: PaymentStatus.COMPLETED, count: '5', sum: '500.00' },
        { status: PaymentStatus.PENDING, count: '2', sum: '200.00' },
        { status: PaymentStatus.FAILED, count: '1', sum: '100.00' },
      ];
      
      paymentRepository.count.mockResolvedValue(8);
      
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockStats),
        getRawOne: jest.fn().mockResolvedValue({ sum: '800.00' }),
      };
      paymentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getPaymentStatistics(mockMerchant.id);

      expect(paymentRepository.createQueryBuilder).toHaveBeenCalledWith('payment');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'payment.status',
        'COUNT(payment.id) as count',
        'COALESCE(SUM(payment.amount), 0) as sum',
      ]);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('payment.merchantId = :merchantId', {
        merchantId: mockMerchant.id,
      });
      expect(result.totalPayments).toBe(8);
      expect(result.totalAmount).toBe(800);
      expect(result.successfulPayments).toBe(5);
      expect(result.pendingPayments).toBe(2);
      expect(result.failedPayments).toBe(1);
    });
  });

  describe('private methods', () => {

    describe('toPaymentResponse', () => {
      it('should convert payment entity to response DTO', () => {
        const result = service['toPaymentResponse'](mockPayment);

        expect(result.id).toBe(mockPayment.id);
        expect(result.reference).toBe(mockPayment.reference);
        expect(result.amount).toBe(mockPayment.amount);
        expect(result.currency).toBe(mockPayment.currency);
        expect(result.gateway).toBe(mockPayment.gateway);
        expect(result.status).toBe(mockPayment.status);
        expect(result.description).toBe(mockPayment.description);
        expect(result.customerEmail).toBe(mockPayment.customerEmail);
        expect(result.createdAt).toBe(mockPayment.createdAt);
      });
    });
  });
});