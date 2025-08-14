import { registerAs } from '@nestjs/config';
import { IsString, IsNumber, IsBoolean, IsOptional, validateSync } from 'class-validator';
import { plainToClass, Type, Transform } from 'class-transformer';

class DatabaseConfig {
  @IsString()
  type: string;

  @IsString()
  host: string;

  @IsNumber()
  @Type(() => Number)
  port: number;

  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsString()
  database: string;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  synchronize: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  logging: boolean;
}

class JwtConfig {
  @IsString()
  secret: string;

  @IsString()
  expiresIn: string;

  @IsString()
  refreshSecret: string;

  @IsString()
  refreshExpiresIn: string;
}

class AwsConfig {
  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  accessKeyId?: string;

  @IsString()
  @IsOptional()
  secretAccessKey?: string;

  @IsString()
  @IsOptional()
  sqsQueueUrl?: string;
}

class AppConfig {
  @IsString()
  nodeEnv: string;

  @IsNumber()
  @Type(() => Number)
  port: number;

  @IsString()
  @IsOptional()
  apiPrefix?: string;

  @Type(() => DatabaseConfig)
  database: DatabaseConfig;

  @Type(() => JwtConfig)
  jwt: JwtConfig;

  @Type(() => AwsConfig)
  aws: AwsConfig;

  @IsString()
  encryptionKey: string;

  @IsNumber()
  @Type(() => Number)
  bcryptRounds: number;

  @IsString()
  webhookSecret: string;

  @IsNumber()
  @Type(() => Number)
  rateLimitWindowMs: number;

  @IsNumber()
  @Type(() => Number)
  rateLimitMaxRequests: number;

  @IsString()
  logLevel: string;

  @IsString()
  logFormat: string;
}

function validateConfig(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(AppConfig, config);
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Configuration validation error: ${errors.toString()}`);
  }
  return validatedConfig;
}

export default registerAs('app', (): AppConfig => {
  const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    database: {
      type: process.env.DATABASE_TYPE || 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME || 'payment_system_dev',
      synchronize: process.env.DATABASE_SYNC === 'true',
      logging: process.env.DATABASE_LOGGING === 'true',
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    aws: {
      region: process.env.AWS_REGION?.trim() || undefined,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() || undefined,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() || undefined,
      sqsQueueUrl: process.env.AWS_SQS_QUEUE_URL?.trim() || undefined,
    },
    encryptionKey: process.env.ENCRYPTION_KEY,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
    webhookSecret: process.env.WEBHOOK_SECRET,
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    logFormat: process.env.LOG_FORMAT || 'combined',
  };

  return validateConfig(config);
});