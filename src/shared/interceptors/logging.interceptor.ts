import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const correlationId = headers['x-correlation-id'] || this.generateCorrelationId();

    // Add correlation ID to response headers
    response.setHeader('x-correlation-id', correlationId);

    const startTime = Date.now();

    this.logger.log(
      `Incoming Request: ${method} ${url}`,
      {
        method,
        url,
        ip,
        userAgent,
        correlationId,
        timestamp: new Date().toISOString(),
      },
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const endTime = Date.now();
          const duration = endTime - startTime;

          this.logger.log(
            `Outgoing Response: ${method} ${url} ${response.statusCode} - ${duration}ms`,
            {
              method,
              url,
              statusCode: response.statusCode,
              duration,
              correlationId,
              timestamp: new Date().toISOString(),
              responseSize: JSON.stringify(data).length,
            },
          );
        },
        error: (error) => {
          const endTime = Date.now();
          const duration = endTime - startTime;

          this.logger.error(
            `Request Failed: ${method} ${url} - ${duration}ms`,
            {
              method,
              url,
              duration,
              correlationId,
              error: error.message,
              timestamp: new Date().toISOString(),
            },
          );
        },
      }),
    );
  }

  private generateCorrelationId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}