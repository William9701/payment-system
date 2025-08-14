import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.getErrorResponse(exception, request);
    
    // Log error details
    this.logError(exception, request, errorResponse);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private getErrorResponse(exception: unknown, request: Request) {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = null;
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        details = (exceptionResponse as any).details;
        errorCode = (exceptionResponse as any).errorCode || this.getErrorCodeFromStatus(status);
      }
    } else if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Database operation failed';
      errorCode = 'DATABASE_ERROR';
      
      // Handle specific database errors
      if (exception.message.includes('duplicate key')) {
        message = 'Resource already exists';
        errorCode = 'DUPLICATE_RESOURCE';
        status = HttpStatus.CONFLICT;
      } else if (exception.message.includes('foreign key constraint')) {
        message = 'Related resource not found';
        errorCode = 'FOREIGN_KEY_CONSTRAINT';
        status = HttpStatus.BAD_REQUEST;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      
      // Handle specific error types
      if (exception.name === 'ValidationError') {
        status = HttpStatus.BAD_REQUEST;
        errorCode = 'VALIDATION_ERROR';
      } else if (exception.name === 'UnauthorizedError') {
        status = HttpStatus.UNAUTHORIZED;
        errorCode = 'UNAUTHORIZED';
      } else if (exception.name === 'ForbiddenError') {
        status = HttpStatus.FORBIDDEN;
        errorCode = 'FORBIDDEN';
      }
    }

    return {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: {
        code: errorCode,
        message,
        details,
      },
      // Only include stack trace in development
      ...(process.env.NODE_ENV === 'development' && {
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    };
  }

  private getErrorCodeFromStatus(status: number): string {
    const statusCodes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };

    return statusCodes[status] || 'UNKNOWN_ERROR';
  }

  private logError(exception: unknown, request: Request, errorResponse: any): void {
    const { statusCode, error } = errorResponse;
    const { method, url, ip, headers } = request;

    // Sanitize headers for logging (remove sensitive data)
    const sanitizedHeaders = { ...headers };
    delete sanitizedHeaders.authorization;
    delete sanitizedHeaders.cookie;

    const logContext = {
      timestamp: new Date().toISOString(),
      statusCode,
      method,
      url,
      ip,
      userAgent: headers['user-agent'],
      errorCode: error.code,
      message: error.message,
      correlationId: headers['x-correlation-id'] || 'unknown',
    };

    if (statusCode >= 500) {
      this.logger.error(
        `Server Error: ${error.message}`,
        {
          ...logContext,
          stack: exception instanceof Error ? exception.stack : undefined,
        },
      );
    } else if (statusCode >= 400) {
      this.logger.warn(`Client Error: ${error.message}`, logContext);
    } else {
      this.logger.log(`Request processed: ${error.message}`, logContext);
    }
  }
}