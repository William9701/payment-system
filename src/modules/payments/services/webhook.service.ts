import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { WebhookPayloadDto, WebhookResponseDto, WebhookSimulationDto } from '../dto/webhook.dto';
import { PaymentService } from './payment.service';

export interface WebhookSignature {
  signature: string;
  timestamp: string;
  tolerance?: number; // seconds
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly webhookSecret: string;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get<string>('app.webhookSecret') || 'default-webhook-secret';
  }

  async processWebhook(
    payload: WebhookPayloadDto,
    rawBody: string,
    signature: string,
    timestamp?: string,
  ): Promise<WebhookResponseDto> {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(rawBody, signature, timestamp)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }

      // Find payment by reference or gateway reference
      const payment = await this.findPaymentByReference(payload.reference, payload.gatewayReference);

      if (!payment) {
        this.logger.warn(`Payment not found for reference: ${payload.reference}`);
        throw new NotFoundException('Payment not found');
      }

      // Map gateway status to internal status
      const internalStatus = this.mapGatewayStatusToInternal(payload.status, payload.event);

      // Update payment status
      const updateData = {
        status: internalStatus,
        gatewayReference: payload.gatewayReference || payment.gatewayReference,
        gatewayResponse: payload.data,
        failureCode: payload.failureCode,
        failureReason: payload.failureMessage,
        gatewayFee: payload.gatewayFee || payment.gatewayFee,
      };

      await this.paymentService.updatePaymentStatus(payment.reference, updateData);

      // Update webhook delivery tracking
      await this.updateWebhookDelivery(payment.id);

      // Log successful webhook processing
      this.logger.log(`Webhook processed successfully for payment: ${payment.reference}`);

      return {
        message: 'Webhook processed successfully',
        success: true,
        reference: payment.reference,
        status: internalStatus,
      };
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`, error.stack);
      
      if (error instanceof UnauthorizedException || error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException(`Webhook processing failed: ${error.message}`);
    }
  }

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

  private async findPaymentByReference(
    reference: string,
    gatewayReference?: string,
  ): Promise<Payment | null> {
    const whereConditions: any[] = [
      { reference },
    ];

    if (gatewayReference) {
      whereConditions.push({ gatewayReference });
      whereConditions.push({ externalId: gatewayReference });
    }

    return this.paymentRepository.findOne({
      where: whereConditions,
    });
  }

  private mapGatewayStatusToInternal(gatewayStatus: string, event?: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      // Generic status mappings
      'succeeded': PaymentStatus.COMPLETED,
      'completed': PaymentStatus.COMPLETED,
      'success': PaymentStatus.COMPLETED,
      'successful': PaymentStatus.COMPLETED,
      'paid': PaymentStatus.COMPLETED,
      
      'failed': PaymentStatus.FAILED,
      'declined': PaymentStatus.FAILED,
      'error': PaymentStatus.FAILED,
      
      'pending': PaymentStatus.PENDING,
      'processing': PaymentStatus.PROCESSING,
      'in_progress': PaymentStatus.PROCESSING,
      
      'cancelled': PaymentStatus.CANCELLED,
      'canceled': PaymentStatus.CANCELLED,
      
      'refunded': PaymentStatus.REFUNDED,
      'partially_refunded': PaymentStatus.PARTIALLY_REFUNDED,
      
      'disputed': PaymentStatus.DISPUTED,
      'chargeback': PaymentStatus.DISPUTED,
      
      'expired': PaymentStatus.EXPIRED,
    };

    // Event-based mapping for more specific status determination
    if (event) {
      const eventMap: Record<string, PaymentStatus> = {
        'payment.succeeded': PaymentStatus.COMPLETED,
        'payment.completed': PaymentStatus.COMPLETED,
        'payment.failed': PaymentStatus.FAILED,
        'payment.cancelled': PaymentStatus.CANCELLED,
        'payment.refunded': PaymentStatus.REFUNDED,
        'charge.succeeded': PaymentStatus.COMPLETED,
        'charge.failed': PaymentStatus.FAILED,
        'charge.dispute.created': PaymentStatus.DISPUTED,
      };

      if (eventMap[event.toLowerCase()]) {
        return eventMap[event.toLowerCase()];
      }
    }

    const mappedStatus = statusMap[gatewayStatus.toLowerCase()];
    
    if (!mappedStatus) {
      this.logger.warn(`Unknown gateway status: ${gatewayStatus}, defaulting to PROCESSING`);
      return PaymentStatus.PROCESSING;
    }

    return mappedStatus;
  }

  private async updateWebhookDelivery(paymentId: string): Promise<void> {
    await this.paymentRepository.update(paymentId, {
      webhookAttempts: () => 'webhook_attempts + 1',
      lastWebhookAt: new Date(),
      webhookDelivered: true,
    });
  }

  private async processStripeWebhook(
    payload: any,
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<WebhookResponseDto> {
    const signature = headers['stripe-signature'];
    
    if (!signature) {
      throw new UnauthorizedException('Missing Stripe signature');
    }

    // Extract Stripe-specific data
    const webhookPayload: WebhookPayloadDto = {
      event: payload.type,
      reference: payload.data?.object?.metadata?.reference || payload.data?.object?.id,
      status: payload.data?.object?.status,
      gatewayReference: payload.data?.object?.id,
      data: payload.data?.object,
      failureCode: payload.data?.object?.last_payment_error?.code,
      failureMessage: payload.data?.object?.last_payment_error?.message,
    };

    return this.processWebhook(webhookPayload, rawBody, signature);
  }

  private async processPaystackWebhook(
    payload: any,
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<WebhookResponseDto> {
    const signature = headers['x-paystack-signature'];
    
    if (!signature) {
      throw new UnauthorizedException('Missing Paystack signature');
    }

    // Extract Paystack-specific data
    const webhookPayload: WebhookPayloadDto = {
      event: payload.event,
      reference: payload.data?.reference,
      status: payload.data?.status,
      gatewayReference: payload.data?.id?.toString(),
      data: payload.data,
      gatewayFee: payload.data?.fees ? payload.data.fees / 100 : undefined, // Convert kobo to naira
    };

    return this.processWebhook(webhookPayload, rawBody, signature);
  }

  private async processFlutterwaveWebhook(
    payload: any,
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<WebhookResponseDto> {
    const signature = headers['verif-hash'];
    
    if (!signature) {
      throw new UnauthorizedException('Missing Flutterwave signature');
    }

    // Extract Flutterwave-specific data
    const webhookPayload: WebhookPayloadDto = {
      event: payload.event,
      reference: payload.data?.tx_ref,
      status: payload.data?.status,
      gatewayReference: payload.data?.id?.toString(),
      data: payload.data,
      gatewayFee: payload.data?.app_fee,
    };

    return this.processWebhook(webhookPayload, rawBody, signature);
  }

  async simulateWebhook(simulationDto: WebhookSimulationDto): Promise<WebhookResponseDto> {
    try {
      // Find payment by reference (payment references are strings, not UUIDs)
      const payment = await this.paymentRepository.findOne({
        where: { reference: simulationDto.reference },
      });

      if (!payment) {
        throw new NotFoundException(`Payment not found with reference: ${simulationDto.reference}`);
      }

      // Check if payment is pending
      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException(
          `Payment status is ${payment.status}. Only pending payments can be updated via simulation.`
        );
      }

      // Default to completed status
      const targetStatus = simulationDto.status || 'completed';
      const internalStatus = this.mapGatewayStatusToInternal(targetStatus);

      // Prepare update data
      const updateData = {
        status: internalStatus,
        gatewayReference: simulationDto.gatewayReference || `sim_${Date.now()}`,
        failureReason: simulationDto.failureReason,
        gatewayResponse: {
          simulated: true,
          timestamp: new Date().toISOString(),
          status: targetStatus,
        },
      };

      // Update payment status using the payment service
      const updatedPayment = await this.paymentService.updatePaymentStatus(
        payment.reference,
        updateData,
      );

      // Update webhook delivery tracking
      await this.updateWebhookDelivery(payment.id);

      this.logger.log(`Webhook simulated successfully for payment: ${payment.reference} -> ${internalStatus}`);

      return {
        message: 'Webhook simulation completed successfully',
        success: true,
        reference: payment.reference,
        status: internalStatus,
      };
    } catch (error) {
      this.logger.error(`Webhook simulation failed: ${error.message}`, error.stack);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Webhook simulation failed: ${error.message}`);
    }
  }
}