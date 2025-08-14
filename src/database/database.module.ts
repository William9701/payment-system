import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get('app.database');
        
        return {
          type: dbConfig.type as any,
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          synchronize: dbConfig.synchronize,
          logging: dbConfig.logging,
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          subscribers: [__dirname + '/subscribers/*{.ts,.js}'],
          migrationsRun: false,
          migrationsTableName: 'migrations_history',
          autoLoadEntities: true,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
          extra: {
            connectionLimit: 10,
            acquireTimeout: 60000,
            timeout: 60000,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}