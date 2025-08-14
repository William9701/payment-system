import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { InitializePaymentDto, PaymentResponseDto, UpdatePaymentStatusDto } from '../dto/payment.dto';
import { PaymentStatus } from '../entities/payment.entity';
import { Auth, AuthActive } from '../../../shared/decorators/auth.decorators';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('initialize')
  @AuthActive()
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initialize a new payment',
    description: 'Create a new payment request with the specified amount and currency. Requires active merchant account.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment successfully initialized',
    type: PaymentResponseDto,
    examples: {
      success: {
        summary: 'Successful payment initialization',
        value: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          reference: 'PAY_1734024000_ABC123',
          amount: 100.50,
          currency: 'USD',
          status: 'pending',
          gateway: 'stripe',
          description: 'Payment for order #12345',
          customerEmail: 'customer@example.com',
          customerName: 'John Doe',
          createdAt: '2023-12-31T23:59:59.000Z',
          metadata: {
            orderId: 'ORDER_123',
            source: 'web'
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid payment data' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Account must be active' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async initializePayment(
    @CurrentUser('id') merchantId: string,
    @Body() initializePaymentDto: InitializePaymentDto,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.initializePayment(merchantId, initializePaymentDto);
  }

  @Get(':reference')
  @Auth()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get payment details',
    description: 'Retrieve payment information by reference or ID',
  })
  @ApiParam({
    name: 'reference',
    description: 'Payment reference or ID',
    example: 'PAY_1640995200_A1B2C3D4',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment details retrieved successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPayment(
    @Param('reference') reference: string,
    @CurrentUser('id') merchantId: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.getPayment(reference, merchantId);
  }

  @Get()
  @Auth()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get merchant payments',
    description: 'Retrieve paginated list of payments for the authenticated merchant',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (default: 10, max: 100)',
    example: 10,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by payment status',
    enum: PaymentStatus,
  })
  @ApiResponse({
    status: 200,
    description: 'Payments retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        payments: {
          type: 'array',
          items: { $ref: '#/components/schemas/PaymentResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async getPayments(
    @CurrentUser('id') merchantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Query('status') status?: PaymentStatus,
  ): Promise<{ payments: PaymentResponseDto[]; total: number; page: number; limit: number }> {
    // Ensure limit doesn't exceed 100
    const maxLimit = Math.min(limit, 100);
    return this.paymentService.getPaymentsByMerchant(merchantId, page, maxLimit, status);
  }

  @Put(':reference/status')
  @AuthActive()
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update payment status',
    description: 'Update the status of a payment (typically used by payment gateways or internal processes)',
  })
  @ApiParam({
    name: 'reference',
    description: 'Payment reference or ID',
    example: 'PAY_1640995200_A1B2C3D4',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment status updated successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Account must be active' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async updatePaymentStatus(
    @Param('reference') reference: string,
    @CurrentUser('id') merchantId: string,
    @Body() updatePaymentStatusDto: UpdatePaymentStatusDto,
  ): Promise<PaymentResponseDto> {
    return this.paymentService.updatePaymentStatus(reference, updatePaymentStatusDto, merchantId);
  }

  @Get('statistics/summary')
  @Auth()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get payment statistics',
    description: 'Retrieve payment statistics for the authenticated merchant',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalPayments: { type: 'number', description: 'Total number of payments' },
        totalAmount: { type: 'number', description: 'Total amount of completed payments' },
        successfulPayments: { type: 'number', description: 'Number of successful payments' },
        failedPayments: { type: 'number', description: 'Number of failed payments' },
        pendingPayments: { type: 'number', description: 'Number of pending payments' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async getPaymentStatistics(
    @CurrentUser('id') merchantId: string,
  ): Promise<{
    totalPayments: number;
    totalAmount: number;
    successfulPayments: number;
    failedPayments: number;
    pendingPayments: number;
  }> {
    return this.paymentService.getPaymentStatistics(merchantId);
  }
}