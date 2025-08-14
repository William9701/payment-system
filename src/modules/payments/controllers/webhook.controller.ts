import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhookService } from '../services/webhook.service';
import { WebhookPayloadDto, WebhookResponseDto, WebhookSimulationDto } from '../dto/webhook.dto';
import { Public } from '../../../shared/decorators/auth.decorators';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('payment')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generic payment webhook endpoint',
    description: 'Handle payment status updates from various payment gateways with signature verification',
  })
  @ApiBody({
    description: 'Webhook payload from payment gateway',
    type: WebhookPayloadDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    type: WebhookResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async handlePaymentWebhook(
    @Body() payload: WebhookPayloadDto,
    @Headers('x-signature') signature: string,
    @Headers('x-timestamp') timestamp: string,
    @Req() req: Request,
  ): Promise<WebhookResponseDto> {
    const rawBody = JSON.stringify(payload);
    return this.webhookService.processWebhook(payload, rawBody, signature, timestamp);
  }

  @Post('stripe')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stripe webhook endpoint',
    description: 'Handle Stripe payment events with signature verification',
  })
  @ApiResponse({
    status: 200,
    description: 'Stripe webhook processed successfully',
    type: WebhookResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid Stripe webhook' })
  @ApiResponse({ status: 401, description: 'Invalid Stripe signature' })
  async handleStripeWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ): Promise<WebhookResponseDto> {
    const rawBody = (req as any).rawBody || JSON.stringify(payload);
    return this.webhookService.processGatewaySpecificWebhook('stripe', payload, rawBody, headers);
  }

  @Post('paystack')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Paystack webhook endpoint',
    description: 'Handle Paystack payment events with signature verification',
  })
  @ApiResponse({
    status: 200,
    description: 'Paystack webhook processed successfully',
    type: WebhookResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid Paystack webhook' })
  @ApiResponse({ status: 401, description: 'Invalid Paystack signature' })
  async handlePaystackWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ): Promise<WebhookResponseDto> {
    const rawBody = (req as any).rawBody || JSON.stringify(payload);
    return this.webhookService.processGatewaySpecificWebhook('paystack', payload, rawBody, headers);
  }

  @Post('flutterwave')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Flutterwave webhook endpoint',
    description: 'Handle Flutterwave payment events with signature verification',
  })
  @ApiResponse({
    status: 200,
    description: 'Flutterwave webhook processed successfully',
    type: WebhookResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid Flutterwave webhook' })
  @ApiResponse({ status: 401, description: 'Invalid Flutterwave signature' })
  async handleFlutterwaveWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ): Promise<WebhookResponseDto> {
    const rawBody = (req as any).rawBody || JSON.stringify(payload);
    return this.webhookService.processGatewaySpecificWebhook('flutterwave', payload, rawBody, headers);
  }

  @Post('simulate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simulate webhook for testing',
    description: `Simulate a payment webhook for testing purposes. 
    
**Usage:**
1. First initialize a payment using POST /payments/initialize
2. Copy the payment reference from the response
3. Use this endpoint to simulate the webhook and update payment status
4. The payment must be in 'pending' status to be updated

**Example Success Payload:**
\`\`\`json
{
  "reference": "PAY_1734024000_ABC123",
  "status": "completed",
  "gatewayReference": "stripe_pi_1234567890"
}
\`\`\`

**Minimal Success Payload:**
\`\`\`json
{
  "reference": "PAY_1734024000_ABC123"
}
\`\`\`

**Common Status Values:**
- completed (default)
- failed 
- cancelled`,
  })
  @ApiBody({
    description: 'Webhook simulation payload',
    type: WebhookSimulationDto,
    examples: {
      success: {
        summary: 'Simple Success (Recommended)',
        value: {
          reference: 'PAY_1734024000_ABC123'
        }
      },
      successWithGateway: {
        summary: 'Success with Gateway Reference',
        value: {
          reference: 'PAY_1734024000_ABC123',
          status: 'completed',
          gatewayReference: 'stripe_pi_1234567890'
        }
      },
      failure: {
        summary: 'Payment Failure',
        value: {
          reference: 'PAY_1734024000_ABC123',
          status: 'failed',
          failureReason: 'Insufficient funds'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook simulation processed successfully',
    type: WebhookResponseDto,
    examples: {
      success: {
        summary: 'Successful payment completion',
        value: {
          message: 'Webhook simulation completed successfully',
          success: true,
          reference: 'PAY_1734024000_ABC123',
          status: 'completed'
        }
      },
      failed: {
        summary: 'Payment failure simulation',
        value: {
          message: 'Webhook simulation completed successfully',
          success: true,
          reference: 'PAY_1734024000_ABC123',
          status: 'failed'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid payload or payment not in pending status' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async simulateWebhook(
    @Body() simulationDto: WebhookSimulationDto,
  ): Promise<WebhookResponseDto> {
    return this.webhookService.simulateWebhook(simulationDto);
  }

  @Post(':gateway')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gateway-specific webhook endpoint',
    description: 'Handle webhooks for specific payment gateways',
  })
  @ApiParam({
    name: 'gateway',
    description: 'Payment gateway name (e.g., stripe, paystack, flutterwave)',
    example: 'stripe',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    type: WebhookResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid webhook or unsupported gateway' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async handleGatewayWebhook(
    @Param('gateway') gateway: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ): Promise<WebhookResponseDto> {
    const rawBody = (req as any).rawBody || JSON.stringify(payload);
    return this.webhookService.processGatewaySpecificWebhook(gateway, payload, rawBody, headers);
  }
}