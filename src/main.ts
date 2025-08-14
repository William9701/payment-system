import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
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

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // API prefix
  app.setGlobalPrefix('api/v1');

  // CORS configuration
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] // Configure your production domains
      : true, // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('iRecharge Payment Processing API')
    .setDescription(`
## Enterprise Payment Processing System

### Quick Start Guide:
1. **Register/Login** to get your JWT token
2. **Create Payment Method** using the Payment Methods endpoints
3. **Initialize Payments** using the payment method ID from step 2
4. **Test Webhooks** to simulate payment status updates

### Authentication:
- All protected endpoints require JWT token in Authorization header
- Use the 'Authorize' button above to set your token globally

### Complete Testing Flow:
1. **POST /auth/register** - Create merchant account & get JWT token
2. **POST /payment-methods** - Create a payment method (copy the returned ID)
3. **POST /payments/initialize** - Initialize payment with your payment method ID (copy the reference)
4. **POST /webhooks/simulate** - Simulate webhook using payment reference to update status
5. **GET /payments/{reference}** - Verify payment status was updated

### Alternative Testing:
- Use **PUT /payments/{reference}/status** for manual status updates (requires auth)
- Use **POST /webhooks/simulate** for webhook simulation (no auth needed)
    `)
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token (without "Bearer" prefix)',
        name: 'Authorization',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer('http://localhost:3000', 'Development server')
    .addServer('https://api.irecharge.com', 'Production server')
    .addTag('Authentication', 'Merchant registration, login and profile management')
    .addTag('Payment Methods', 'Manage payment methods for processing transactions')
    .addTag('Payments', 'Initialize, track and update payment transactions')
    .addTag('Webhooks', 'Payment gateway webhook endpoints for status updates')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 iRecharge Payment API is running on: http://localhost:${port}`);
  logger.log(`📖 Swagger documentation available at: http://localhost:${port}/api/docs`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', error);
  process.exit(1);
});
