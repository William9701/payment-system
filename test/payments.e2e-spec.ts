import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from '../src/modules/merchants/entities/merchant.entity';
import { Payment } from '../src/modules/payments/entities/payment.entity';
import { PaymentMethod, PaymentMethodType, PaymentMethodStatus } from '../src/modules/payment-methods/entities/payment-method.entity';
import { MerchantType, MerchantStatus } from '../src/modules/merchants/entities/merchant.entity';
import { PaymentStatus, PaymentGateway, Currency } from '../src/modules/payments/entities/payment.entity';
import * as bcrypt from 'bcrypt';

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let merchantRepository: Repository<Merchant>;
  let paymentRepository: Repository<Payment>;
  let paymentMethodRepository: Repository<PaymentMethod>;
  let accessToken: string;
  let merchantId: string;
  let paymentMethodId: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    merchantRepository = moduleFixture.get<Repository<Merchant>>(getRepositoryToken(Merchant));
    paymentRepository = moduleFixture.get<Repository<Payment>>(getRepositoryToken(Payment));
    paymentMethodRepository = moduleFixture.get<Repository<PaymentMethod>>(getRepositoryToken(PaymentMethod));
    
    await app.init();

    // Create test merchant and get access token
    const merchant = merchantRepository.create({
      name: 'Test Merchant',
      email: 'merchant@example.com',
      password: await bcrypt.hash('SecurePassword123!', 10),
      merchantType: MerchantType.BUSINESS,
      status: MerchantStatus.ACTIVE,
      totalProcessedAmount: 0,
      totalTransactions: 0,
      createdBy: 'test',
      updatedBy: 'test',
    });
    const savedMerchant = await merchantRepository.save(merchant);
    merchantId = savedMerchant.id;

    // Create payment method
    const paymentMethod = paymentMethodRepository.create({
      merchant: savedMerchant,
      merchantId: savedMerchant.id,
      name: 'Test Stripe Account',
      type: PaymentMethodType.STRIPE,
      status: PaymentMethodStatus.ACTIVE,
      isDefault: true,
      encryptedData: 'encrypted_test_data',
      externalId: 'stripe_test_account',
      externalProvider: 'stripe',
      createdBy: 'test',
      updatedBy: 'test',
    });
    const savedPaymentMethod = await paymentMethodRepository.save(paymentMethod);
    paymentMethodId = savedPaymentMethod.id;

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'merchant@example.com',
        password: 'SecurePassword123!',
      });

    accessToken = loginResponse.body.tokens.accessToken;
  });

  afterEach(async () => {
    // Clean up test data
    await paymentRepository.clear();
    await paymentMethodRepository.clear();
    await merchantRepository.clear();
    await app.close();
  });

  describe('/payments/initialize (POST)', () => {
    it('should initialize a payment successfully', async () => {
      const initializeDto = {
        amount: 100.50,
        currency: Currency.USD,
        gateway: PaymentGateway.STRIPE,
        description: 'Test payment for order #123',
        customerEmail: 'customer@example.com',
        metadata: {
          orderId: 'ORDER_123',
          customerId: 'CUST_456',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments/initialize')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(initializeDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('reference');
      expect(response.body.amount).toBe(initializeDto.amount);
      expect(response.body.currency).toBe(initializeDto.currency);
      expect(response.body.gateway).toBe(initializeDto.gateway);
      expect(response.body.status).toBe(PaymentStatus.PENDING);
      expect(response.body.description).toBe(initializeDto.description);
      expect(response.body.customerEmail).toBe(initializeDto.customerEmail);
      expect(response.body.reference).toMatch(/^PAY_\d{8}$/);

      // Verify payment was saved to database
      const savedPayment = await paymentRepository.findOne({
        where: { reference: response.body.reference },
      });
      expect(savedPayment).toBeDefined();
      expect(savedPayment!.merchantId).toBe(merchantId);
      expect(savedPayment!.paymentMethodId).toBe(paymentMethodId);
    });

    it('should return 400 for invalid amount', async () => {
      const initializeDto = {
        amount: -10,
        currency: Currency.USD,
        gateway: PaymentGateway.STRIPE,
        description: 'Test payment',
        customerEmail: 'customer@example.com',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments/initialize')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(initializeDto)
        .expect(400);

      expect(response.body.message).toContain('Invalid payment amount');
    });

    it('should return 400 for unsupported gateway', async () => {
      const initializeDto = {
        amount: 100.50,
        currency: Currency.USD,
        gateway: 'UNSUPPORTED_GATEWAY',
        description: 'Test payment',
        customerEmail: 'customer@example.com',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments/initialize')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(initializeDto)
        .expect(400);

      expect(response.body.message).toContain('Validation failed');
    });

    it('should return 401 without authorization', async () => {
      const initializeDto = {
        amount: 100.50,
        currency: Currency.USD,
        gateway: PaymentGateway.STRIPE,
        description: 'Test payment',
        customerEmail: 'customer@example.com',
      };

      await request(app.getHttpServer())
        .post('/api/v1/payments/initialize')
        .send(initializeDto)
        .expect(401);
    });

    it('should return 400 when payment method not configured', async () => {
      // Deactivate the payment method
      await paymentMethodRepository.update(paymentMethodId, { status: PaymentMethodStatus.INACTIVE });

      const initializeDto = {
        amount: 100.50,
        currency: Currency.USD,
        gateway: PaymentGateway.STRIPE,
        description: 'Test payment',
        customerEmail: 'customer@example.com',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments/initialize')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(initializeDto)
        .expect(400);

      expect(response.body.message).toContain('Payment method not configured');
    });
  });

  describe('/payments/:reference (GET)', () => {
    let paymentReference: string;

    beforeEach(async () => {
      // Create a test payment
      const payment = paymentRepository.create({
        reference: 'PAY_12345678',
        amount: 150.75,
        currency: Currency.USD,
        gateway: PaymentGateway.STRIPE,
        status: PaymentStatus.PENDING,
        description: 'Test payment',
        customerEmail: 'customer@example.com',
        merchant: { id: merchantId } as Merchant,
        merchantId,
        paymentMethod: { id: paymentMethodId } as PaymentMethod,
        paymentMethodId,
        metadata: { orderId: 'ORDER_123' },
        createdBy: 'test',
        updatedBy: 'test',
      });
      const savedPayment = await paymentRepository.save(payment);
      paymentReference = savedPayment.reference;
    });

    it('should get payment by reference successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentReference}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.reference).toBe(paymentReference);
      expect(response.body.amount).toBe(150.75);
      expect(response.body.currency).toBe(Currency.USD);
      expect(response.body.status).toBe(PaymentStatus.PENDING);
      expect(response.body).toHaveProperty('merchant');
      expect(response.body).toHaveProperty('paymentMethod');
    });

    it('should return 404 for non-existent payment', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/payments/PAY_NONEXISTENT')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.message).toContain('Payment not found');
    });

    it('should return 401 without authorization', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentReference}`)
        .expect(401);
    });
  });

  describe('/payments (GET)', () => {
    beforeEach(async () => {
      // Create multiple test payments
      const payments = [
        {
          reference: 'PAY_11111111',
          amount: 100,
          currency: Currency.USD,
          gateway: PaymentGateway.STRIPE,
          status: PaymentStatus.COMPLETED,
          description: 'Completed payment',
          customerEmail: 'customer1@example.com',
        },
        {
          reference: 'PAY_22222222',
          amount: 200,
          currency: Currency.USD,
          gateway: PaymentGateway.STRIPE,
          status: PaymentStatus.PENDING,
          description: 'Pending payment',
          customerEmail: 'customer2@example.com',
        },
        {
          reference: 'PAY_33333333',
          amount: 150,
          currency: Currency.USD,
          gateway: PaymentGateway.STRIPE,
          status: PaymentStatus.FAILED,
          description: 'Failed payment',
          customerEmail: 'customer3@example.com',
        },
      ];

      for (const paymentData of payments) {
        const payment = paymentRepository.create({
          ...paymentData,
          merchant: { id: merchantId } as Merchant,
          merchantId,
          paymentMethod: { id: paymentMethodId } as PaymentMethod,
          paymentMethodId,
          metadata: {},
          createdBy: 'test',
          updatedBy: 'test',
        });
        await paymentRepository.save(payment);
      }
    });

    it('should list merchant payments with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/payments')
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(3);
      expect(response.body.page).toBe(1);
      expect(response.body.totalPages).toBe(2);
    });

    it('should filter payments by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/payments')
        .query({ status: PaymentStatus.COMPLETED })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe(PaymentStatus.COMPLETED);
    });

    it('should return 401 without authorization', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/payments')
        .expect(401);
    });
  });

  describe('/payments/:reference/status (PUT)', () => {
    let paymentReference: string;

    beforeEach(async () => {
      // Create a test payment
      const payment = paymentRepository.create({
        reference: 'PAY_87654321',
        amount: 75.25,
        currency: Currency.USD,
        gateway: PaymentGateway.STRIPE,
        status: PaymentStatus.PENDING,
        description: 'Test payment for status update',
        customerEmail: 'customer@example.com',
        merchant: { id: merchantId } as Merchant,
        merchantId,
        paymentMethod: { id: paymentMethodId } as PaymentMethod,
        paymentMethodId,
        metadata: {},
        createdBy: 'test',
        updatedBy: 'test',
      });
      const savedPayment = await paymentRepository.save(payment);
      paymentReference = savedPayment.reference;
    });

    it('should update payment status successfully', async () => {
      const updateDto = {
        status: PaymentStatus.COMPLETED,
        externalId: 'txn_1234567890',
      };

      const response = await request(app.getHttpServer())
        .put(`/api/v1/payments/${paymentReference}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.status).toBe(PaymentStatus.COMPLETED);
      expect(response.body.externalId).toBe('txn_1234567890');

      // Verify update in database
      const updatedPayment = await paymentRepository.findOne({
        where: { reference: paymentReference },
      });
      expect(updatedPayment!.status).toBe(PaymentStatus.COMPLETED);
      expect(updatedPayment!.externalId).toBe('txn_1234567890');
    });

    it('should return 404 for non-existent payment', async () => {
      const updateDto = {
        status: PaymentStatus.COMPLETED,
        externalId: 'txn_1234567890',
      };

      const response = await request(app.getHttpServer())
        .put('/api/v1/payments/PAY_NONEXISTENT/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(404);

      expect(response.body.message).toContain('Payment not found');
    });

    it('should return 409 for already completed payment', async () => {
      // Update payment to completed first
      await paymentRepository.update(
        { reference: paymentReference },
        { status: PaymentStatus.COMPLETED },
      );

      const updateDto = {
        status: PaymentStatus.FAILED,
        externalId: 'txn_1234567890',
      };

      const response = await request(app.getHttpServer())
        .put(`/api/v1/payments/${paymentReference}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(409);

      expect(response.body.message).toContain('already been processed');
    });
  });

  describe('/payments/statistics/summary (GET)', () => {
    beforeEach(async () => {
      // Create payments with different statuses for statistics
      const payments = [
        { status: PaymentStatus.COMPLETED, amount: 100 },
        { status: PaymentStatus.COMPLETED, amount: 200 },
        { status: PaymentStatus.PENDING, amount: 50 },
        { status: PaymentStatus.FAILED, amount: 75 },
      ];

      for (const paymentData of payments) {
        const payment = paymentRepository.create({
          reference: `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          amount: paymentData.amount,
          currency: Currency.USD,
          gateway: PaymentGateway.STRIPE,
          status: paymentData.status,
          description: 'Test payment',
          customerEmail: 'customer@example.com',
          merchant: { id: merchantId } as Merchant,
          merchantId,
          paymentMethod: { id: paymentMethodId } as PaymentMethod,
          paymentMethodId,
          metadata: {},
          createdBy: 'test',
          updatedBy: 'test',
        });
        await paymentRepository.save(payment);
      }
    });

    it('should return payment statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/payments/statistics/summary')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalPayments');
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('successfulPayments');
      expect(response.body).toHaveProperty('failedPayments');
      expect(response.body).toHaveProperty('pendingPayments');
      expect(response.body.totalPayments).toBe(4);
      expect(response.body.totalAmount).toBe(425);
      expect(response.body.successfulPayments).toBe(2);
      expect(response.body.failedPayments).toBe(1);
      expect(response.body.pendingPayments).toBe(1);
    });

    it('should return 401 without authorization', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/payments/statistics/summary')
        .expect(401);
    });
  });
});