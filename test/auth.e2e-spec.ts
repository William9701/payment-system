import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from '../src/modules/merchants/entities/merchant.entity';
import { MerchantType, MerchantStatus } from '../src/modules/merchants/entities/merchant.entity';
import * as bcrypt from 'bcrypt';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let merchantRepository: Repository<Merchant>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    merchantRepository = moduleFixture.get<Repository<Merchant>>(getRepositoryToken(Merchant));
    
    await app.init();
  });

  afterEach(async () => {
    // Clean up test data
    await merchantRepository.clear();
    await app.close();
  });

  describe('/auth/register (POST)', () => {
    it('should register a new merchant successfully', async () => {
      const registerDto = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePassword123!',
        merchantType: MerchantType.INDIVIDUAL,
        phone: '+1234567890',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toHaveProperty('merchant');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.merchant.email).toBe(registerDto.email);
      expect(response.body.merchant.name).toBe(registerDto.name);
      expect(response.body.merchant).not.toHaveProperty('password');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');

      // Verify merchant was saved to database
      const savedMerchant = await merchantRepository.findOne({
        where: { email: registerDto.email },
      });
      expect(savedMerchant).toBeDefined();
      expect(savedMerchant!.status).toBe(MerchantStatus.PENDING);
    });

    it('should return 409 when email already exists', async () => {
      // Create a merchant first
      const existingMerchant = merchantRepository.create({
        name: 'Existing User',
        email: 'existing@example.com',
        password: await bcrypt.hash('password123', 10),
        merchantType: MerchantType.INDIVIDUAL,
        status: MerchantStatus.ACTIVE,
        totalProcessedAmount: 0,
        totalTransactions: 0,
        createdBy: 'test',
        updatedBy: 'test',
      });
      await merchantRepository.save(existingMerchant);

      const registerDto = {
        name: 'John Doe',
        email: 'existing@example.com',
        password: 'SecurePassword123!',
        merchantType: MerchantType.INDIVIDUAL,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerDto)
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });

    it('should return 400 for invalid email format', async () => {
      const registerDto = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'SecurePassword123!',
        merchantType: MerchantType.INDIVIDUAL,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerDto)
        .expect(400);

      expect(response.body.message).toContain('Validation failed');
    });

    it('should return 400 for weak password', async () => {
      const registerDto = {
        name: 'John Doe',
        email: 'john@example.com',
        password: '123',
        merchantType: MerchantType.INDIVIDUAL,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerDto)
        .expect(400);

      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('/auth/login (POST)', () => {
    let testMerchant: Merchant;

    beforeEach(async () => {
      // Create a test merchant
      testMerchant = merchantRepository.create({
        name: 'Test User',
        email: 'test@example.com',
        password: await bcrypt.hash('SecurePassword123!', 10),
        merchantType: MerchantType.INDIVIDUAL,
        status: MerchantStatus.ACTIVE,
        totalProcessedAmount: 0,
        totalTransactions: 0,
        createdBy: 'test',
        updatedBy: 'test',
      });
      await merchantRepository.save(testMerchant);
    });

    it('should login successfully with correct credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginDto)
        .expect(200);

      expect(response.body).toHaveProperty('merchant');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.merchant.email).toBe(loginDto.email);
      expect(response.body.merchant).not.toHaveProperty('password');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    it('should return 401 for incorrect password', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'WrongPassword!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginDto)
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should return 401 for non-existent email', async () => {
      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'SecurePassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginDto)
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should return 401 for suspended merchant', async () => {
      // Update merchant status to suspended
      await merchantRepository.update(testMerchant.id, {
        status: MerchantStatus.SUSPENDED,
      });

      const loginDto = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginDto)
        .expect(401);

      expect(response.body.message).toContain('suspended');
    });
  });

  describe('/auth/refresh (POST)', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Register a merchant and get tokens
      const registerDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePassword123!',
        merchantType: MerchantType.INDIVIDUAL,
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerDto);

      accessToken = registerResponse.body.tokens.accessToken;
      refreshToken = registerResponse.body.tokens.refreshToken;
    });

    it('should refresh tokens successfully', async () => {
      const refreshDto = {
        refreshToken,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send(refreshDto)
        .expect(200);

      expect(response.body).toHaveProperty('merchant');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
      expect(response.body.tokens.accessToken).not.toBe(accessToken);
    });

    it('should return 401 for invalid refresh token', async () => {
      const refreshDto = {
        refreshToken: 'invalid.refresh.token',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send(refreshDto)
        .expect(401);

      expect(response.body.message).toContain('token');
    });
  });

  describe('/auth/profile (GET)', () => {
    let accessToken: string;
    let merchantId: string;

    beforeEach(async () => {
      // Register a merchant and get tokens
      const registerDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePassword123!',
        merchantType: MerchantType.INDIVIDUAL,
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerDto);

      accessToken = registerResponse.body.tokens.accessToken;
      merchantId = registerResponse.body.merchant.id;
    });

    it('should get merchant profile successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(merchantId);
      expect(response.body.email).toBe('test@example.com');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .expect(401);

      expect(response.body.message).toContain('Authentication failed');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.message).toContain('Authentication failed');
    });
  });
});