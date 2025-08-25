# Payment System - Interview Study Guide 🚀

## Project Overview

This is an enterprise-grade payment processing system built with NestJS, PostgreSQL, and AWS SQS. The system provides secure merchant onboarding, payment method management, transaction processing, and webhook handling with comprehensive API documentation.

---

## 🏗️ Architecture & Design Decisions

### **Q: How did you approach this payment system assessment?**

**My Approach:**

1. **Modular Architecture**: I designed the system using NestJS modules to ensure separation of concerns and maintainability
2. **Security-First**: Implemented JWT authentication, password hashing with bcrypt, and webhook signature verification
3. **Scalability**: Used TypeORM for database management with migrations, and AWS SQS for event-driven architecture
4. **Documentation**: Comprehensive Swagger API documentation for easy integration
5. **Testing**: E2E tests for critical flows and unit tests for services

### **Q: Why did you choose NestJS over other frameworks?**

**Reasons:**
- **TypeScript Native**: Strong typing reduces runtime errors
- **Decorator Pattern**: Clean, readable code with decorators for validation, authentication
- **Dependency Injection**: Easy testing and loose coupling
- **Built-in Guards & Interceptors**: Perfect for authentication and logging
- **Swagger Integration**: Automatic API documentation

---

## 📋 Line-by-Line Code Explanation

## 1. Application Bootstrap (`src/main.ts`)

### **Lines 1-7: Imports and Dependencies**
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
```
- **NestFactory**: Creates the NestJS application instance
- **ValidationPipe**: Validates incoming requests using class-validator decorators
- **SwaggerModule**: Generates API documentation
- **Custom filters/interceptors**: For error handling and request logging

### **Lines 8-12: Application Creation**
```typescript
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
```
- Creates the main application instance using the root `AppModule`
- Initializes a logger specifically for the bootstrap process

### **Lines 13-23: Global Validation Setup**
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validateCustomDecorators: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```
**Each Property Explained:**
- `whitelist: true`: Strips properties not decorated with validation decorators
- `forbidNonWhitelisted: true`: Throws error if non-whitelisted properties are found
- `transform: true`: Automatically transforms payloads to DTO instances
- `validateCustomDecorators: true`: Validates custom decorators
- `enableImplicitConversion: true`: Converts string numbers to actual numbers

### **Lines 25-29: Global Middleware**
```typescript
app.useGlobalFilters(new HttpExceptionFilter());
app.useGlobalInterceptors(new LoggingInterceptor());
app.setGlobalPrefix('api/v1');
```
- **Exception Filter**: Catches and formats all HTTP exceptions
- **Logging Interceptor**: Logs all incoming requests and responses
- **Global Prefix**: All routes prefixed with `/api/v1`

### **Lines 34-42: CORS Configuration**
```typescript
app.enableCors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
  credentials: true,
});
```
- Environment-specific CORS: Strict in production, permissive in development
- Allows standard HTTP methods and required headers
- `credentials: true`: Allows cookies and authorization headers

## 2. Database Configuration (`src/database/data-source.ts`)

### **Lines 1-8: Imports and Environment Setup**
```typescript
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

config();

const configService = new ConfigService();
```
- Loads environment variables using dotenv
- Creates ConfigService for environment variable access

### **Lines 9-23: Database Connection Configuration**
```typescript
export const AppDataSource = new DataSource({
  type: process.env.DATABASE_TYPE as any || 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'root',
  database: process.env.DATABASE_NAME || 'payment_system_dev',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  subscribers: [__dirname + '/subscribers/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === 'true',
  migrationsTableName: 'migrations_history',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
```
**Key Configuration Points:**
- **Environment-driven**: All settings configurable via environment variables
- **Type safety**: Explicit type casting and default values
- **Entity auto-discovery**: Automatically loads all `.entity.ts` files
- **Migrations**: Structured database changes with history tracking
- **Production SSL**: Secure connections in production environment
- **Logging**: Database query logging for development debugging

## 3. Configuration Management (`src/shared/config/configuration.ts`)

### **Lines 5-32: Database Configuration Class**
```typescript
class DatabaseConfig {
  @IsString()
  type: string;

  @IsString()
  host: string;

  @IsNumber()
  @Type(() => Number)
  port: number;
  // ... more fields
}
```
- **Class-validator decorators**: Ensures configuration validity
- **Type transformers**: Converts environment strings to appropriate types
- **Validation**: Fails fast if configuration is invalid

### **Lines 122-159: Configuration Factory**
```typescript
export default registerAs('app', (): AppConfig => {
  const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    // ... all environment mappings
  };
  
  return validateConfig(config);
});
```
- **Namespace registration**: Groups related config under 'app' namespace
- **Type conversion**: Converts strings to numbers where needed
- **Validation**: Validates entire configuration before app starts

## 4. Authentication System (`src/modules/auth/`)

### **Auth Module (`auth.module.ts`) Lines 14-30:**
```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Merchant]),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const jwtConfig = configService.get('app.jwt');
        return {
          secret: jwtConfig.secret,
          signOptions: {
            expiresIn: jwtConfig.expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
    MerchantsModule,
  ],
```
**Module Structure Explained:**
- **TypeOrmModule.forFeature**: Registers Merchant entity for this module
- **PassportModule**: Provides authentication strategies
- **JwtModule.registerAsync**: Configures JWT with dynamic configuration
- **useFactory pattern**: Allows dependency injection into module configuration

### **Auth Service (`services/auth.service.ts`) Key Methods:**

#### **User Registration (Lines 36-87):**
```typescript
async register(registerDto: RegisterDto): Promise<{ merchant: AuthenticatedMerchant; tokens: JwtTokens }> {
  // Check if merchant already exists
  const existingMerchant = await this.merchantRepository.findOne({
    where: { email: registerDto.email },
  });

  if (existingMerchant) {
    throw new ConflictException('Merchant with this email already exists');
  }
```
**Registration Flow:**
1. **Duplicate Check**: Prevents duplicate email registrations
2. **Business ID Validation**: Ensures unique business identifiers
3. **Password Hashing**: Uses bcrypt with configurable rounds
4. **Token Generation**: Creates access and refresh tokens
5. **Response Sanitization**: Removes password from response

#### **Password Hashing (Lines 57-59):**
```typescript
const saltRounds = this.configService.get<number>('app.bcryptRounds') || 10;
const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);
```
- **Configurable salt rounds**: Allows security tuning
- **Async hashing**: Prevents blocking the event loop

#### **Token Generation (Lines 236-258):**
```typescript
private async generateTokens(merchant: Merchant): Promise<JwtTokens> {
  const payload: JwtPayload = {
    sub: merchant.id,
    email: merchant.email,
    merchantType: merchant.merchantType,
    status: merchant.status,
  };

  const jwtConfig = this.configService.get('app.jwt');

  const [accessToken, refreshToken] = await Promise.all([
    this.jwtService.signAsync(payload, {
      secret: jwtConfig.secret,
      expiresIn: jwtConfig.expiresIn,
    }),
    this.jwtService.signAsync(payload, {
      secret: jwtConfig.refreshSecret,
      expiresIn: jwtConfig.refreshExpiresIn,
    }),
  ]);

  return { accessToken, refreshToken };
}
```
**Token Strategy:**
- **Parallel Generation**: Creates both tokens simultaneously for performance
- **Different Secrets**: Access and refresh tokens use different secrets
- **Configurable Expiration**: Different lifespans for different token types

## 5. Database Schema & Migrations

### **Initial Migration (`1734024000000-InitialPaymentSchema.ts`):**

#### **Lines 7-20: Database Extensions and Enums**
```typescript
await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

// Create enums first
await queryRunner.query(`CREATE TYPE "public"."merchants_merchanttype_enum" AS ENUM('individual', 'business', 'enterprise')`);
await queryRunner.query(`CREATE TYPE "public"."merchants_status_enum" AS ENUM('active', 'inactive', 'suspended', 'pending')`);
await queryRunner.query(`CREATE TYPE "public"."payment_methods_type_enum" AS ENUM('card', 'bank_account', 'mobile_money', 'crypto', 'paypal', 'stripe')`);
// ... more enums
```
**Schema Design Decisions:**
- **UUID Extension**: Uses PostgreSQL's uuid-ossp for UUID generation
- **Strong Typing**: Enums enforce data consistency at database level
- **Extensible Status System**: Easy to add new statuses without schema changes

#### **Lines 22-48: Merchants Table**
```typescript
CREATE TABLE "merchants" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP,
  "created_by" character varying(50) NOT NULL DEFAULT 'system',
  "updated_by" character varying(50) NOT NULL DEFAULT 'system',
  "name" character varying(100) NOT NULL,
  "email" character varying(150) NOT NULL,
  // ... more fields
```
**Table Design Features:**
- **Soft Deletes**: `deleted_at` allows data recovery
- **Audit Trail**: `created_by`, `updated_by`, timestamps for tracking
- **UUID Primary Keys**: Distributed system friendly
- **Appropriate Field Lengths**: Optimized for typical use cases

#### **Lines 130-138: Strategic Indexes**
```typescript
await queryRunner.query(`CREATE UNIQUE INDEX "IDX_merchants_email" ON "merchants" ("email")`);
await queryRunner.query(`CREATE UNIQUE INDEX "IDX_merchants_business_id" ON "merchants" ("business_id") WHERE "business_id" IS NOT NULL`);
await queryRunner.query(`CREATE INDEX "IDX_payment_methods_merchant_default" ON "payment_methods" ("merchant_id", "is_default")`);
// ... more indexes
```
**Indexing Strategy:**
- **Unique Constraints**: Enforces business rules at database level
- **Composite Indexes**: Optimizes common query patterns
- **Partial Indexes**: Only indexes non-null values where appropriate

## 6. Payment Processing Logic (`src/modules/payments/services/payment.service.ts`)

### **Payment Initialization (Lines 30-123):**
```typescript
async initializePayment(
  merchantId: string,
  initializePaymentDto: InitializePaymentDto,
): Promise<PaymentResponseDto> {
  // Validate merchant
  const merchant = await this.merchantRepository.findOne({
    where: { id: merchantId },
  });

  if (!merchant) {
    throw new NotFoundException('Merchant not found');
  }

  if (merchant.status !== MerchantStatus.ACTIVE) {
    throw new ForbiddenException('Merchant account must be active to process payments');
  }
```
**Validation Flow:**
1. **Merchant Validation**: Ensures merchant exists and is active
2. **Payment Method Validation**: Checks method ownership and status
3. **Expiration Check**: Validates payment method hasn't expired
4. **Payment Creation**: Creates payment with proper defaults

### **Status Transition Logic (Lines 324-352):**
```typescript
private isValidStatusTransition(currentStatus: PaymentStatus, newStatus: PaymentStatus): boolean {
  const validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
    [PaymentStatus.PENDING]: [
      PaymentStatus.PROCESSING,
      PaymentStatus.COMPLETED,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
      PaymentStatus.EXPIRED,
    ],
    [PaymentStatus.PROCESSING]: [
      PaymentStatus.COMPLETED,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
    ],
    // ... more transitions
  };

  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}
```
**State Machine Benefits:**
- **Data Integrity**: Prevents invalid status changes
- **Business Logic Enforcement**: Encodes payment lifecycle rules
- **Error Prevention**: Catches logical errors early

### **SQS Event Publishing (Lines 100-120):**
```typescript
try {
  const eventData: PaymentEventData = {
    paymentId: savedPayment.id,
    reference: savedPayment.reference,
    merchantId: savedPayment.merchantId,
    // ... event data
  };

  await this.sqsProducerService.publishPaymentInitiated(eventData);
} catch (error) {
  // Log error but don't fail the payment initialization
  console.error('Failed to publish payment initiated event to SQS:', error);
}
```
**Event-Driven Design:**
- **Async Processing**: Events don't block payment flow
- **Resilient**: Payment succeeds even if event publishing fails
- **Decoupled**: Other services can react to payment events

## 7. Webhook System (`src/modules/payments/services/webhook.service.ts`)

### **Signature Verification (Lines 115-154):**
```typescript
private verifyWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp?: string,
  tolerance: number = 300, // 5 minutes
): boolean {
  try {
    // Basic HMAC signature verification
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    // For signature format like "sha256=abc123..."
    const receivedSignature = signature.startsWith('sha256=') 
      ? signature.substring(7) 
      : signature;

    const isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex'),
    );

    // Verify timestamp if provided (prevents replay attacks)
    if (timestamp) {
      const webhookTimestamp = parseInt(timestamp, 10);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      if (Math.abs(currentTimestamp - webhookTimestamp) > tolerance) {
        this.logger.warn('Webhook timestamp outside tolerance');
        return false;
      }
    }

    return isSignatureValid;
  } catch (error) {
    this.logger.error('Signature verification failed:', error.message);
    return false;
  }
}
```
**Security Measures:**
- **HMAC Verification**: Ensures webhook authenticity
- **Timing Safe Comparison**: Prevents timing attacks
- **Replay Attack Prevention**: Timestamp validation
- **Flexible Format Support**: Handles different signature formats

### **Gateway-Specific Processing (Lines 103-113):**
```typescript
async processGatewaySpecificWebhook(
  gateway: string,
  payload: any,
  rawBody: string,
  headers: Record<string, string>,
): Promise<WebhookResponseDto> {
  switch (gateway.toLowerCase()) {
    case 'stripe':
      return this.processStripeWebhook(payload, rawBody, headers);
    case 'paystack':
      return this.processPaystackWebhook(payload, rawBody, headers);
    case 'flutterwave':
      return this.processFlutterwaveWebhook(payload, rawBody, headers);
    default:
      throw new BadRequestException(`Unsupported gateway: ${gateway}`);
  }
}
```
**Multi-Gateway Support:**
- **Extensible Design**: Easy to add new payment gateways
- **Gateway-Specific Logic**: Each gateway has unique webhook format
- **Unified Response**: Consistent response format regardless of gateway

## 8. AWS SQS Integration (`src/modules/sqs/services/sqs-producer.service.ts`)

### **Service Initialization (Lines 20-42):**
```typescript
constructor(private readonly configService: ConfigService) {
  const awsConfig = this.configService.get('app.aws');
  
  // Check if AWS credentials are configured
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
}
```
**Graceful Degradation:**
- **Configuration Check**: Validates all required AWS credentials
- **Disabled Mode**: System works without SQS if not configured
- **Environment Specific**: Different credentials per environment

### **Message Publishing (Lines 92-151):**
```typescript
private async sendMessage(event: PaymentEvent, retryCount = 0): Promise<string> {
  try {
    const messageAttributes: SQSMessageAttributes = {
      eventType: { DataType: 'String', StringValue: event.eventType },
      merchantId: { DataType: 'String', StringValue: event.data.merchantId },
      paymentId: { DataType: 'String', StringValue: event.data.paymentId },
      timestamp: { DataType: 'String', StringValue: event.timestamp.toISOString() },
    };

    const params: SQS.SendMessageRequest = {
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(event),
      MessageAttributes: messageAttributes,
      MessageGroupId: `merchant-${event.data.merchantId}`, // For FIFO queues
      MessageDeduplicationId: event.eventId,
    };

    const result = await this.sqs.sendMessage(params).promise();
    return result.MessageId!;
  } catch (error) {
    // Retry logic with exponential backoff
    if (retryCount < this.maxRetries) {
      const delay = this.retryDelay * Math.pow(2, retryCount);
      await this.sleep(delay);
      return this.sendMessage({ ...event, retryCount: retryCount + 1 }, retryCount + 1);
    }
    throw new Error(`Failed to send SQS message after ${this.maxRetries} retries: ${error.message}`);
  }
}
```
**Reliability Features:**
- **Message Attributes**: Allows filtering without parsing body
- **FIFO Queue Support**: Ordered processing per merchant
- **Deduplication**: Prevents duplicate messages
- **Exponential Backoff**: Intelligent retry strategy
- **Error Handling**: Fails gracefully after max retries

---

## 🔒 Security Implementation

### **JWT Strategy (`src/modules/auth/strategies/jwt.strategy.ts`):**
- **HS256 Algorithm**: Symmetric key signing
- **Token Validation**: Verifies signature, expiration, and payload
- **User Context**: Attaches merchant info to request

### **Password Security:**
- **Bcrypt Hashing**: Industry standard password hashing
- **Configurable Rounds**: Tunable security vs performance
- **Salt Generation**: Automatic unique salt per password

### **Webhook Security:**
- **HMAC Signature Verification**: Prevents tampering
- **Timestamp Validation**: Prevents replay attacks
- **Multiple Gateway Support**: Different security schemes per gateway

### **Input Validation:**
- **Class Validator**: Decorative validation on DTOs
- **Whitelist Mode**: Strips unknown properties
- **Type Transformation**: Automatic type conversion

---

## 🚀 API Endpoints Overview

### **Authentication Endpoints:**
- `POST /api/v1/auth/register` - Merchant registration
- `POST /api/v1/auth/login` - Merchant login
- `POST /api/v1/auth/refresh` - Token refresh
- `GET /api/v1/auth/profile` - Get merchant profile

### **Payment Method Endpoints:**
- `POST /api/v1/payment-methods` - Create payment method
- `GET /api/v1/payment-methods` - List payment methods
- `PUT /api/v1/payment-methods/:id` - Update payment method

### **Payment Endpoints:**
- `POST /api/v1/payments/initialize` - Initialize payment
- `GET /api/v1/payments/:reference` - Get payment details
- `GET /api/v1/payments` - List payments (paginated)
- `PUT /api/v1/payments/:reference/status` - Update payment status

### **Webhook Endpoints:**
- `POST /api/v1/webhooks/payment` - Generic webhook
- `POST /api/v1/webhooks/stripe` - Stripe-specific webhook
- `POST /api/v1/webhooks/paystack` - Paystack-specific webhook
- `POST /api/v1/webhooks/simulate` - Test webhook simulation

---

## 🧪 Testing Strategy

### **E2E Tests:**
```typescript
// test/auth.e2e-spec.ts
describe('/auth (e2e)', () => {
  it('/auth/register (POST)', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send(registerData)
      .expect(201)
      .expect((res) => {
        expect(res.body.merchant).toBeDefined();
        expect(res.body.tokens).toBeDefined();
      });
  });
});
```

### **Unit Tests:**
```typescript
// src/modules/auth/services/auth.service.spec.ts
describe('AuthService', () => {
  it('should register a new merchant', async () => {
    const result = await service.register(mockRegisterDto);
    expect(result.merchant.email).toBe(mockRegisterDto.email);
    expect(result.tokens.accessToken).toBeDefined();
  });
});
```

---

## 🔧 Environment Configuration

### **Required Environment Variables:**
```bash
# Database
DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=payment_system_dev

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

# AWS (Optional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_SQS_QUEUE_URL=your_queue_url

# Security
ENCRYPTION_KEY=your_encryption_key
WEBHOOK_SECRET=your_webhook_secret
BCRYPT_ROUNDS=10
```

---

## 📊 Database Design Highlights

### **Entity Relationships:**
- **Merchants** → **PaymentMethods** (One-to-Many)
- **Merchants** → **Payments** (One-to-Many)
- **PaymentMethods** → **Payments** (One-to-Many)

### **Key Design Patterns:**
- **Base Entity**: Common fields (id, timestamps, audit fields)
- **Soft Deletes**: Data preservation with deleted_at
- **Enum Types**: Database-level constraints
- **Composite Indexes**: Query optimization
- **UUID Primary Keys**: Distributed system ready

---

## 🎯 Key Features Implemented

### ✅ **Authentication System**
- JWT-based authentication
- Refresh token support
- Password hashing and validation
- Profile management

### ✅ **Payment Processing**
- Payment initialization
- Status management with state machine
- Multiple gateway support
- Comprehensive validation

### ✅ **Webhook Handling**
- Signature verification
- Multiple payment gateway support
- Webhook simulation for testing
- Event-driven updates

### ✅ **Event-Driven Architecture**
- AWS SQS integration
- Async event processing
- Retry mechanisms
- Graceful degradation

### ✅ **Data Management**
- TypeORM with migrations
- Soft deletes
- Audit trails
- Optimized queries

### ✅ **Security**
- Input validation
- Authentication guards
- CORS configuration
- Secure headers

### ✅ **Documentation**
- Comprehensive Swagger docs
- Interactive API testing
- Example payloads
- Error response documentation

---

## 💡 Interview Questions & Answers

### **Q: How would you scale this system for high volume?**
**A:** 
1. **Database**: Read replicas, connection pooling, database sharding
2. **Caching**: Redis for frequently accessed data
3. **Load Balancing**: Multiple application instances
4. **Event Processing**: Separate SQS consumers for different event types
5. **Rate Limiting**: Implement rate limiting per merchant

### **Q: How do you handle payment failures?**
**A:**
1. **Status Tracking**: Clear failure states with reasons
2. **Webhook Retries**: Exponential backoff for webhook delivery
3. **Dead Letter Queues**: Handle permanently failed messages
4. **Monitoring**: Alerting on failure rates
5. **Recovery**: Manual intervention capabilities

### **Q: What security measures did you implement?**
**A:**
1. **Authentication**: JWT with refresh tokens
2. **Input Validation**: Comprehensive DTO validation
3. **Webhook Security**: HMAC signature verification
4. **Password Security**: Bcrypt with configurable rounds
5. **SQL Injection Prevention**: TypeORM query builders

### **Q: How would you add a new payment gateway?**
**A:**
1. **Extend Enums**: Add gateway to PaymentGateway enum
2. **Webhook Handler**: Add gateway-specific webhook processor
3. **Configuration**: Add gateway settings to config
4. **Tests**: Add comprehensive test coverage
5. **Documentation**: Update API documentation

---

## 🚀 Next Steps & Improvements

### **Production Readiness:**
1. **Monitoring**: Add Prometheus metrics and Grafana dashboards
2. **Logging**: Structured logging with correlation IDs
3. **Health Checks**: Comprehensive health endpoints
4. **Rate Limiting**: Implement request rate limiting
5. **Database**: Add database connection pooling

### **Feature Enhancements:**
1. **Merchant Dashboard**: Web interface for merchants
2. **Analytics**: Payment analytics and reporting
3. **Multi-currency**: Enhanced currency support
4. **Subscription Payments**: Recurring payment support
5. **Fraud Detection**: Basic fraud prevention rules

---

This comprehensive study guide covers every aspect of the payment system implementation. Each section provides detailed explanations that will help you confidently discuss the technical decisions, architecture choices, and implementation details during your interview. The line-by-line code explanations ensure you understand every part of the system you've built.

**Good luck with your interview! 🎯**