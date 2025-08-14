import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../src/modules/payments/entities/payment.entity';
import { PaymentMethod, PaymentMethodType, PaymentMethodStatus } from '../src/modules/payment-methods/entities/payment-method.entity';
import { Merchant } from '../src/modules/merchants/entities/merchant.entity';
import { PaymentStatus, PaymentGateway, Currency, PaymentType } from '../src/modules/payments/entities/payment.entity';
import { MerchantType, MerchantStatus } from '../src/modules/merchants/entities/merchant.entity';
import * as bcrypt from 'bcrypt';

describe('Webhooks (e2e)', () => {
  let app: INestApplication;
  let paymentRepository: Repository<Payment>;
  let paymentMethodRepository: Repository<PaymentMethod>;
  let merchantRepository: Repository<Merchant>;
  let testMerchant: Merchant;
  let stripePaymentMethod: PaymentMethod;
  let paystackPaymentMethod: PaymentMethod;
  let testPayment: Payment;

  const STRIPE_WEBHOOK_SECRET = 'whsec_test_stripe_secret';
  const PAYSTACK_WEBHOOK_SECRET = 'paystack_test_secret';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    paymentRepository = moduleFixture.get<Repository<Payment>>(getRepositoryToken(Payment));
    paymentMethodRepository = moduleFixture.get<Repository<PaymentMethod>>(getRepositoryToken(PaymentMethod));
    merchantRepository = moduleFixture.get<Repository<Merchant>>(getRepositoryToken(Merchant));
    
    await app.init();

    // Create test merchant
    testMerchant = merchantRepository.create({
      name: 'Test Merchant',
      email: 'merchant@example.com',
      password: await bcrypt.hash('password123', 10),
      merchantType: MerchantType.BUSINESS,
      status: MerchantStatus.ACTIVE,
      totalProcessedAmount: 0,
      totalTransactions: 0,
      createdBy: 'test',
      updatedBy: 'test',
    });
    testMerchant = await merchantRepository.save(testMerchant);

    // Create Stripe payment method
    stripePaymentMethod = paymentMethodRepository.create({
      merchant: testMerchant,
      merchantId: testMerchant.id,
      name: 'Stripe Account',
      type: PaymentMethodType.STRIPE,
      status: PaymentMethodStatus.ACTIVE,
      isDefault: true,
      encryptedData: 'encrypted_stripe_data',
      externalId: 'stripe_account_123',
      externalProvider: 'stripe',
      createdBy: 'test',
      updatedBy: 'test',
    });
    stripePaymentMethod = await paymentMethodRepository.save(stripePaymentMethod);

    // Create Paystack payment method
    paystackPaymentMethod = paymentMethodRepository.create({
      merchant: testMerchant,
      merchantId: testMerchant.id,
      name: 'Paystack Account',
      type: PaymentMethodType.STRIPE,
      status: PaymentMethodStatus.ACTIVE,
      isDefault: false,
      encryptedData: 'encrypted_paystack_data',
      externalId: 'paystack_account_123',
      externalProvider: 'paystack',
      createdBy: 'test',
      updatedBy: 'test',
    });
    paystackPaymentMethod = await paymentMethodRepository.save(paystackPaymentMethod);

    // Create test payment
    testPayment = paymentRepository.create({
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
      merchant: testMerchant,
      merchantId: testMerchant.id,
      paymentMethod: stripePaymentMethod,
      paymentMethodId: stripePaymentMethod.id,
      createdBy: 'test',
      updatedBy: 'test',
    });
    testPayment = await paymentRepository.save(testPayment);
  });

  afterEach(async () => {
    await paymentRepository.clear();
    await paymentMethodRepository.clear();
    await merchantRepository.clear();
    await app.close();
  });

  describe('/webhooks/stripe (POST)', () => {
    it('should process successful Stripe payment webhook', async () => {
      const stripePayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1234567890',
            status: 'succeeded',
            amount: 10050, // Stripe amounts are in cents
            metadata: {
              payment_reference: testPayment.reference,
            },
          },
        },
      };

      const timestamp = Math.floor(Date.now() / 1000);
      const rawBody = JSON.stringify(stripePayload);
      const signature = crypto
        .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
        .update(`${timestamp}.${rawBody}`, 'utf8')
        .digest('hex');
      const stripeSignature = `t=${timestamp},v1=${signature}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', stripeSignature)
        .send(stripePayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('successfully');

      // Verify payment status was updated
      const updatedPayment = await paymentRepository.findOne({
        where: { reference: testPayment.reference },
      });
      expect(updatedPayment!.status).toBe(PaymentStatus.COMPLETED);
      expect(updatedPayment!.externalId).toBe('pi_1234567890');
    });

    it('should process failed Stripe payment webhook', async () => {
      const stripePayload = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_1234567890',
            status: 'failed',
            metadata: {
              payment_reference: testPayment.reference,
            },
          },
        },
      };

      const timestamp = Math.floor(Date.now() / 1000);
      const rawBody = JSON.stringify(stripePayload);
      const signature = crypto
        .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
        .update(`${timestamp}.${rawBody}`, 'utf8')
        .digest('hex');
      const stripeSignature = `t=${timestamp},v1=${signature}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', stripeSignature)
        .send(stripePayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify payment status was updated
      const updatedPayment = await paymentRepository.findOne({
        where: { reference: testPayment.reference },
      });
      expect(updatedPayment!.status).toBe(PaymentStatus.FAILED);
    });

    it('should return 400 for invalid Stripe signature', async () => {
      const stripePayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1234567890',
            status: 'succeeded',
            metadata: {
              payment_reference: testPayment.reference,
            },
          },
        },
      };

      const invalidSignature = 't=1234567890,v1=invalid_signature';

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', invalidSignature)
        .send(stripePayload)
        .expect(400);

      expect(response.body.message).toContain('Invalid signature');
    });

    it('should return 404 for non-existent payment reference', async () => {
      const stripePayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1234567890',
            status: 'succeeded',
            metadata: {
              payment_reference: 'PAY_NONEXISTENT',
            },
          },
        },
      };

      const timestamp = Math.floor(Date.now() / 1000);
      const rawBody = JSON.stringify(stripePayload);
      const signature = crypto
        .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
        .update(`${timestamp}.${rawBody}`, 'utf8')
        .digest('hex');
      const stripeSignature = `t=${timestamp},v1=${signature}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', stripeSignature)
        .send(stripePayload)
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to process webhook');
    });

    it('should ignore unsupported Stripe event types', async () => {
      const stripePayload = {
        type: 'customer.created',
        data: {
          object: {
            id: 'cus_1234567890',
            email: 'customer@example.com',
          },
        },
      };

      const timestamp = Math.floor(Date.now() / 1000);
      const rawBody = JSON.stringify(stripePayload);
      const signature = crypto
        .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
        .update(`${timestamp}.${rawBody}`, 'utf8')
        .digest('hex');
      const stripeSignature = `t=${timestamp},v1=${signature}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', stripeSignature)
        .send(stripePayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Unsupported event type');
    });
  });

  describe('/webhooks/paystack (POST)', () => {
    beforeEach(async () => {
      // Update test payment to use Paystack
      await paymentRepository.update(testPayment.id, {
        gateway: PaymentGateway.PAYSTACK,
        paymentMethodId: paystackPaymentMethod.id,
      });
    });

    it('should process successful Paystack payment webhook', async () => {
      const paystackPayload = {
        event: 'charge.success',
        data: {
          id: 'trx_1234567890',
          status: 'success',
          amount: 10050, // Paystack amounts are in kobo/cents
          reference: testPayment.reference,
          customer: {
            email: 'customer@example.com',
          },
        },
      };

      const rawBody = JSON.stringify(paystackPayload);
      const signature = crypto
        .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
        .update(rawBody, 'utf8')
        .digest('hex');

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/paystack')
        .set('x-paystack-signature', signature)
        .send(paystackPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify payment status was updated
      const updatedPayment = await paymentRepository.findOne({
        where: { reference: testPayment.reference },
      });
      expect(updatedPayment!.status).toBe(PaymentStatus.COMPLETED);
      expect(updatedPayment!.externalId).toBe('trx_1234567890');
    });

    it('should process failed Paystack payment webhook', async () => {
      const paystackPayload = {
        event: 'charge.failed',
        data: {
          id: 'trx_1234567890',
          status: 'failed',
          reference: testPayment.reference,
          customer: {
            email: 'customer@example.com',
          },
        },
      };

      const rawBody = JSON.stringify(paystackPayload);
      const signature = crypto
        .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
        .update(rawBody, 'utf8')
        .digest('hex');

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/paystack')
        .set('x-paystack-signature', signature)
        .send(paystackPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify payment status was updated
      const updatedPayment = await paymentRepository.findOne({
        where: { reference: testPayment.reference },
      });
      expect(updatedPayment!.status).toBe(PaymentStatus.FAILED);
    });

    it('should return 400 for invalid Paystack signature', async () => {
      const paystackPayload = {
        event: 'charge.success',
        data: {
          id: 'trx_1234567890',
          status: 'success',
          reference: testPayment.reference,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/paystack')
        .set('x-paystack-signature', 'invalid_signature')
        .send(paystackPayload)
        .expect(400);

      expect(response.body.message).toContain('Invalid signature');
    });
  });

  describe('/webhooks/flutterwave (POST)', () => {
    beforeEach(async () => {
      // Create Flutterwave payment method
      const flutterwavePaymentMethod = paymentMethodRepository.create({
        merchant: testMerchant,
        merchantId: testMerchant.id,
        name: 'Flutterwave Account',
        type: PaymentMethodType.STRIPE,
        status: PaymentMethodStatus.ACTIVE,
        isDefault: false,
        encryptedData: 'encrypted_flutterwave_data',
        externalId: 'flutterwave_account_123',
        externalProvider: 'flutterwave',
        createdBy: 'test',
        updatedBy: 'test',
      });
      await paymentMethodRepository.save(flutterwavePaymentMethod);

      // Update test payment to use Flutterwave
      await paymentRepository.update(testPayment.id, {
        gateway: PaymentGateway.FLUTTERWAVE,
        paymentMethodId: flutterwavePaymentMethod.id,
      });
    });

    it('should process successful Flutterwave payment webhook', async () => {
      const flutterwavePayload = {
        event: 'charge.completed',
        data: {
          id: 'flw_tx_1234567890',
          status: 'successful',
          amount: 100.50,
          tx_ref: testPayment.reference,
          customer: {
            email: 'customer@example.com',
          },
        },
      };

      const rawBody = JSON.stringify(flutterwavePayload);
      const signature = crypto
        .createHmac('sha256', 'flutterwave_test_secret')
        .update(rawBody, 'utf8')
        .digest('hex');

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/flutterwave')
        .set('verif-hash', signature)
        .send(flutterwavePayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify payment status was updated
      const updatedPayment = await paymentRepository.findOne({
        where: { reference: testPayment.reference },
      });
      expect(updatedPayment!.status).toBe(PaymentStatus.COMPLETED);
      expect(updatedPayment!.externalId).toBe('flw_tx_1234567890');
    });
  });

  describe('/webhooks/payment (POST)', () => {
    it('should process generic payment webhook', async () => {
      const webhookPayload = {
        gateway: PaymentGateway.STRIPE,
        payload: {
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_generic_1234567890',
              status: 'succeeded',
              metadata: {
                payment_reference: testPayment.reference,
              },
            },
          },
        },
        signature: 'valid_signature',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 for unsupported gateway', async () => {
      const webhookPayload = {
        gateway: 'UNSUPPORTED_GATEWAY',
        payload: {
          type: 'payment.completed',
          data: {
            reference: testPayment.reference,
          },
        },
        signature: 'signature',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment')
        .send(webhookPayload)
        .expect(400);

      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('Webhook Security', () => {
    it('should reject webhook with expired timestamp', async () => {
      const stripePayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1234567890',
            status: 'succeeded',
            metadata: {
              payment_reference: testPayment.reference,
            },
          },
        },
      };

      // Use a timestamp from 1 hour ago
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 3600;
      const rawBody = JSON.stringify(stripePayload);
      const signature = crypto
        .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
        .update(`${expiredTimestamp}.${rawBody}`, 'utf8')
        .digest('hex');
      const stripeSignature = `t=${expiredTimestamp},v1=${signature}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', stripeSignature)
        .send(stripePayload)
        .expect(400);

      expect(response.body.message).toContain('Invalid signature');
    });

    it('should reject webhook without signature header', async () => {
      const stripePayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_1234567890',
            status: 'succeeded',
            metadata: {
              payment_reference: testPayment.reference,
            },
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/stripe')
        .send(stripePayload)
        .expect(400);

      expect(response.body.message).toContain('signature');
    });
  });
});