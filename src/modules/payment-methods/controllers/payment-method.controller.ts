import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentMethodService } from '../services/payment-method.service';
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
  PaymentMethodResponseDto,
} from '../dto/payment-method.dto';
import { AuthActive } from '../../../shared/decorators/auth.decorators';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@ApiTags('Payment Methods')
@Controller('payment-methods')
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Post()
  @AuthActive()
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new payment method',
    description: 'Create a new payment method for the authenticated merchant. Requires active merchant account.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment method created successfully',
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data or merchant not active' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Account must be active' })
  async createPaymentMethod(
    @CurrentUser('id') merchantId: string,
    @Body() createPaymentMethodDto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    return this.paymentMethodService.createPaymentMethod(merchantId, createPaymentMethodDto);
  }

  @Get()
  @AuthActive()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get merchant payment methods',
    description: 'Retrieve all payment methods for the authenticated merchant',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment methods retrieved successfully',
    type: [PaymentMethodResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Account must be active' })
  async getPaymentMethods(
    @CurrentUser('id') merchantId: string,
  ): Promise<PaymentMethodResponseDto[]> {
    return this.paymentMethodService.getPaymentMethods(merchantId);
  }

  @Get(':id')
  @AuthActive()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get payment method details',
    description: 'Retrieve details of a specific payment method',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment method ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method details retrieved successfully',
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Account must be active' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async getPaymentMethod(
    @CurrentUser('id') merchantId: string,
    @Param('id') paymentMethodId: string,
  ): Promise<PaymentMethodResponseDto> {
    return this.paymentMethodService.getPaymentMethod(merchantId, paymentMethodId);
  }

  @Put(':id')
  @AuthActive()
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update payment method',
    description: 'Update details of a specific payment method',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment method ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method updated successfully',
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Account must be active' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async updatePaymentMethod(
    @CurrentUser('id') merchantId: string,
    @Param('id') paymentMethodId: string,
    @Body() updatePaymentMethodDto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    return this.paymentMethodService.updatePaymentMethod(
      merchantId,
      paymentMethodId,
      updatePaymentMethodDto,
    );
  }

  @Delete(':id')
  @AuthActive()
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete payment method',
    description: 'Delete a payment method (soft delete). Cannot delete payment methods with active payments.',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment method ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 204, description: 'Payment method deleted successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Account must be active' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete payment method with active payments' })
  async deletePaymentMethod(
    @CurrentUser('id') merchantId: string,
    @Param('id') paymentMethodId: string,
  ): Promise<void> {
    return this.paymentMethodService.deletePaymentMethod(merchantId, paymentMethodId);
  }

  @Put(':id/default')
  @AuthActive()
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set default payment method',
    description: 'Set a payment method as the default for the merchant',
  })
  @ApiParam({
    name: 'id',
    description: 'Payment method ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Default payment method set successfully',
    type: PaymentMethodResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Payment method must be active' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Account must be active' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async setDefaultPaymentMethod(
    @CurrentUser('id') merchantId: string,
    @Param('id') paymentMethodId: string,
  ): Promise<PaymentMethodResponseDto> {
    return this.paymentMethodService.setDefaultPaymentMethod(merchantId, paymentMethodId);
  }
}