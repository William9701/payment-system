# 🚀 iRecharge Payment Processing System

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazon-aws&logoColor=white" alt="AWS" />
</p>

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [Testing](#-testing)
- [Database Management](#-database-management)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

## 🎯 Overview

A comprehensive, enterprise-grade payment processing system built with NestJS, TypeScript, and AWS SQS. This system provides secure payment initialization, multi-gateway webhook handling, and event-driven architecture for scalable payment processing.

### 🏗️ Built for iRecharge Tech-Innovations

This project demonstrates senior backend engineering skills including:
- **Clean Architecture** with SOLID principles
- **Enterprise Security** with JWT authentication and role-based authorization
- **Event-Driven Design** using AWS SQS for reliable messaging
- **Multi-Gateway Integration** supporting Stripe, Paystack, Flutterwave
- **Production-Ready Code** with comprehensive error handling and monitoring

## ✨ Features

### 🔐 Authentication & Security
- **JWT-based Authentication** with refresh token support
- **Role-Based Access Control** (Individual, Business, Enterprise)
- **Merchant Status Management** with verification requirements
- **Input Validation** with comprehensive DTO validation
- **API Security** with rate limiting and CORS protection

### 💳 Payment Processing
- **Payment Initialization** with comprehensive validation
- **Multi-Gateway Support** (Stripe, Paystack, Flutterwave, PayPal)
- **Webhook Handling** with signature verification
- **Payment Lifecycle Management** with status tracking
- **Multi-Currency Support** (USD, EUR, GBP, NGN, GHS, KES, ZAR, BTC, ETH)

### ☁️ Event-Driven Architecture
- **AWS SQS Integration** for reliable messaging
- **Event Publishing** for payment lifecycle events
- **Message Processing** with error handling and retry mechanisms
- **Business Logic Decoupling** through events

### 🗄️ Database Design
- **Professional Entity Design** with proper relationships
- **Data Encryption** for sensitive payment information
- **Audit Trails** with created/updated tracking
- **Migration Management** with TypeORM

### 📊 Monitoring & Observability
- **Comprehensive Logging** with correlation IDs
- **Error Tracking** with detailed error context
- **Request/Response Logging** for debugging
- **Health Checks** and monitoring endpoints

## 🏛️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │    │  Load Balancer  │    │   Web Client    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         │              NestJS Application                 │
         ├─────────────────────────────────────────────────┤
         │  Controllers │  Services  │  Guards │ Filters   │
         ├─────────────────────────────────────────────────┤
         │         Authentication & Authorization          │
         ├─────────────────────────────────────────────────┤
         │    Payment APIs    │    Webhook Handlers        │
         └─────────────────────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                       │                        │
    ┌─────────┐         ┌─────────────┐         ┌─────────────┐
    │PostgreSQL│         │  AWS SQS    │         │   Payment   │
    │Database │         │   Queue     │         │  Gateways   │
    └─────────┘         └─────────────┘         └─────────────┘
```

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- **PostgreSQL** >= 13.0
- **AWS Account** with SQS access (optional for local development)
- **Git** for version control

## ⚡ Quick Start

Get the payment system running in under 5 minutes with our automated setup scripts!

### 🖥️ Windows Users

**Option 1: PowerShell (Recommended)**
```powershell
# Clone the repository
git clone https://github.com/William9701/iRecharge.git
cd iRecharge/payment-system

# Install dependencies
npm install

# Run the automated setup script
.\scripts\setup-database.ps1
```

**Option 2: Command Prompt**
```cmd
# Clone the repository
git clone https://github.com/William9701/iRecharge.git
cd iRecharge/payment-system

# Install dependencies
npm install

# Run the setup script
scripts\setup-database.bat
```

### 🐧 Linux/macOS Users

```bash
# Clone the repository
git clone https://github.com/William9701/iRecharge.git
cd iRecharge/payment-system

# Install dependencies
npm install

# Make script executable and run setup
chmod +x scripts/setup-database.sh
./scripts/setup-database.sh
```

### 🚀 Start the Application

After running the setup script:

```bash
# Start the development server
npm run start:dev

# The API will be available at:
# http://localhost:3000
# API Documentation: http://localhost:3000/api/docs
```

### 📋 What the Setup Script Does

- ✅ Checks PostgreSQL installation and service
- ✅ Creates database and user with proper permissions
- ✅ Generates secure JWT and encryption keys
- ✅ Creates `.env` file with all necessary configuration
- ✅ Runs database migrations
- ✅ Verifies the setup with connection testing

Need help? Check the [scripts/README.md](scripts/README.md) for detailed troubleshooting.

---

## 🚀 Manual Installation

If you prefer manual setup or need custom configuration:

### 1. Clone the Repository

```bash
git clone https://github.com/William9701/iRecharge.git
cd iRecharge/payment-system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

```bash
# Copy environment example
cp .env.example .env.development

# Edit the environment file with your configuration
nano .env.development
```

## ⚙️ Configuration

### Environment Variables

Create environment files for different stages:

**`.env.development`** (Development)
```env
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database Configuration
DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=payment_user
DATABASE_PASSWORD=your_secure_password
DATABASE_NAME=payment_system_dev
DATABASE_SYNC=true
DATABASE_LOGGING=true

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_minimum_32_characters
JWT_REFRESH_EXPIRES_IN=7d

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/payment-events

# Security Configuration
ENCRYPTION_KEY=your_32_character_encryption_key_here
BCRYPT_ROUNDS=10
WEBHOOK_SECRET=your_webhook_secret_for_signature_verification
```

**`.env.production`** (Production)
```env
NODE_ENV=production
PORT=3000
DATABASE_SYNC=false
DATABASE_LOGGING=false
# ... other production-specific configurations
```

### Database Setup

1. **Create Database**:
```sql
CREATE DATABASE payment_system_dev;
CREATE USER payment_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE payment_system_dev TO payment_user;
```

2. **Run Migrations**:
```bash
npm run migration:run
```

### AWS SQS Setup

1. **Create SQS Queue**:
```bash
aws sqs create-queue --queue-name payment-events --region us-east-1
```

2. **Configure Permissions**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage"
      ],
      "Resource": "arn:aws:sqs:us-east-1:123456789:payment-events"
    }
  ]
}
```

## 🏃‍♂️ Running the Application

### Development Mode

```bash
# Start in development mode with hot reload
npm run start:dev

# Start with debug mode
npm run start:debug
```

### Production Mode

```bash
# Build the application
npm run build

# Start in production mode
npm run start:prod
```

### Using Docker (Optional)

```bash
# Build Docker image
docker build -t irecharge-payment-api .

# Run with docker-compose
docker-compose up -d
```

## 📖 API Documentation

### Swagger Documentation

Once the application is running, access the interactive API documentation:

- **Development**: http://localhost:3000/api/docs
- **Production**: https://api.irecharge.com/api/docs

### Authentication

All protected endpoints require a JWT token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

### API Endpoints

#### Authentication
- `POST /api/v1/auth/register` - Register new merchant
- `POST /api/v1/auth/login` - Login merchant
- `POST /api/v1/auth/refresh` - Refresh tokens
- `GET /api/v1/auth/profile` - Get merchant profile

#### Payments
- `POST /api/v1/payments/initialize` - Initialize new payment
- `GET /api/v1/payments/:reference` - Get payment details
- `GET /api/v1/payments` - List merchant payments
- `PUT /api/v1/payments/:reference/status` - Update payment status
- `GET /api/v1/payments/statistics/summary` - Get payment statistics

#### Webhooks
- `POST /api/v1/webhooks/payment` - Generic payment webhook
- `POST /api/v1/webhooks/stripe` - Stripe-specific webhook
- `POST /api/v1/webhooks/paystack` - Paystack-specific webhook
- `POST /api/v1/webhooks/flutterwave` - Flutterwave-specific webhook

### Example Requests

#### Initialize Payment
```bash
curl -X POST http://localhost:3000/api/v1/payments/initialize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "amount": 100.50,
    "currency": "USD",
    "gateway": "stripe",
    "description": "Test payment",
    "customerEmail": "customer@example.com"
  }'
```

#### Webhook Processing
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=1234567890,v1=abcdef..." \
  -d '{
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_1234567890",
        "status": "succeeded",
        "amount": 10050
      }
    }
  }'
```

## 🧪 Testing

### Unit Tests

```bash
# Run unit tests
npm run test

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch
```

### Integration Tests

```bash
# Run end-to-end tests
npm run test:e2e
```

### Load Testing

```bash
# Install artillery for load testing
npm install -g artillery

# Run load tests
artillery run load-tests/payment-flow.yml
```

## 🗄️ Database Management

### Migrations

```bash
# Generate new migration
npm run migration:generate -- AddNewField

# Create empty migration
npm run migration:create -- AddIndexes

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Drop database schema
npm run schema:drop
```

### Seeds (Optional)

```bash
# Create sample data for development
npm run seed:run
```

## 🌍 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_HOST` | Database host | `localhost` |
| `DATABASE_PASSWORD` | Database password | `secure_password` |
| `JWT_SECRET` | JWT signing secret | `your_32_char_secret` |
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_SQS_QUEUE_URL` | SQS queue URL | `https://sqs.us-east-1.amazonaws.com/123456789/payment-events` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Application port | `3000` |
| `API_PREFIX` | API prefix | `api/v1` |
| `BCRYPT_ROUNDS` | Password hashing rounds | `10` |
| `RATE_LIMIT_MAX_REQUESTS` | Rate limit | `100` |

## 🚀 Deployment

### Production Deployment

1. **Build Application**:
```bash
npm run build
```

2. **Environment Setup**:
```bash
export NODE_ENV=production
export DATABASE_SYNC=false
# ... other production variables
```

3. **Start Application**:
```bash
npm run start:prod
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
```

### AWS Deployment

1. **Using AWS ECS**:
```bash
# Build and push Docker image
docker build -t irecharge-payment-api .
docker tag irecharge-payment-api:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/irecharge-payment-api:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/irecharge-payment-api:latest
```

2. **Using AWS Lambda** (with Serverless Framework):
```bash
npm install -g serverless
serverless deploy
```

### Health Checks

The application provides health check endpoints:

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health information

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database connection
npm run typeorm -- query "SELECT 1"
```

#### SQS Permission Issues
```bash
# Test SQS connectivity
aws sqs get-queue-attributes --queue-url <your-queue-url> --region <your-region>
```

#### JWT Token Issues
- Ensure JWT_SECRET is at least 32 characters
- Check token expiration times
- Verify token format in Authorization header

### Debugging

Enable debug mode for detailed logging:

```bash
NODE_ENV=development DEBUG=* npm run start:dev
```

## 🤝 Contributing

### Development Workflow

1. **Fork and Clone**:
```bash
git fork https://github.com/William9701/iRecharge.git
git clone <your-fork-url>
```

2. **Create Feature Branch**:
```bash
git checkout -b feature/your-feature-name
```

3. **Make Changes and Test**:
```bash
npm run test
npm run lint
```

4. **Commit with Conventional Commits**:
```bash
git commit -m "feat: add payment refund functionality"
```

5. **Submit Pull Request**:
- Include detailed description
- Add tests for new features
- Update documentation

### Code Style

- **ESLint**: Automated linting with Prettier
- **TypeScript**: Strict type checking
- **Conventional Commits**: Structured commit messages
- **SOLID Principles**: Clean architecture

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **NestJS Framework** for the excellent TypeScript framework
- **TypeORM** for robust database management
- **AWS** for reliable cloud services
- **iRecharge Tech-Innovations** for the assessment opportunity

---

<p align="center">
  Built with ❤️ for iRecharge Tech-Innovations Senior Backend Engineer Assessment
</p>

<p align="center">
  <strong>🎯 Demonstrating Enterprise-Level Backend Engineering Excellence</strong>
</p>