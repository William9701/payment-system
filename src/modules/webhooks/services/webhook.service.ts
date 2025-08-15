import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { PaymentMethod, PaymentMethodStatus } from '../../payment-methods/entities/payment-method.entity';
import { PaymentService } from '../../payments/services/payment.service';
import { ProcessWebhookDto } from '../dto/webhook.dto';
import { PaymentGateway, PaymentStatus } from '../../payments/entities/payment.entity';

@Injectable()
export class WebhookService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    private readonly paymentService: PaymentService,
  ) {}

  async processWebhook(webhookDto: ProcessWebhookDto): Promise<{ success: boolean; message: string }> {
    try {
      const paymentMethod = await this.paymentMethodRepository.findOne({
        where: { type: webhookDto.gateway as any, status: PaymentMethodStatus.ACTIVE },
      });

      if (!paymentMethod) {
        throw new NotFoundException(`Payment method not found for gateway: ${webhookDto.gateway}`);
      }

      const isValidSignature = this.verifyWebhookSignature(
        webhookDto.payload,
        webhookDto.signature,
        (paymentMethod as any).webhookSecret,
        webhookDto.gateway,
      );

      if (!isValidSignature) {
        throw new BadRequestException('Invalid webhook signature');
      }

      const paymentData = this.extractPaymentDataFromWebhook(webhookDto.payload, webhookDto.gateway);

      await this.paymentService.updatePaymentStatus(paymentData.reference, {
        status: paymentData.status,
        gatewayReference: paymentData.externalId,
      });

      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      return {
        success: false,
        message: `Failed to process webhook: ${error.message}`,
      };
    }
  }

  async processStripeWebhook(payload: any, signature: string): Promise<{ success: boolean; message?: string }> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { type: PaymentGateway.STRIPE as any, status: PaymentMethodStatus.ACTIVE },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Stripe payment method not found');
    }

    const isValidSignature = this.verifyWebhookSignature(
      payload,
      signature,
      (paymentMethod as any).webhookSecret,
      PaymentGateway.STRIPE,
    );

    if (!isValidSignature) {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    const eventType = payload.type;
    
    if (!['payment_intent.succeeded', 'payment_intent.payment_failed'].includes(eventType)) {
      return {
        success: true,
        message: `Unsupported event type: ${eventType}`,
      };
    }

    const paymentObject = payload.data.object;
    const reference = paymentObject.metadata?.payment_reference;

    if (!reference) {
      throw new BadRequestException('Payment reference not found in webhook payload');
    }

    const status = eventType === 'payment_intent.succeeded' 
      ? PaymentStatus.COMPLETED 
      : PaymentStatus.FAILED;

    await this.paymentService.updatePaymentStatus(reference, {
      status,
      gatewayReference: paymentObject.id,
    });

    return { success: true };
  }

  async processPaystackWebhook(payload: any, signature: string): Promise<{ success: boolean; message?: string }> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { type: PaymentGateway.PAYSTACK as any, status: PaymentMethodStatus.ACTIVE },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Paystack payment method not found');
    }

    const isValidSignature = this.verifyWebhookSignature(
      payload,
      signature,
      (paymentMethod as any).webhookSecret,
      PaymentGateway.PAYSTACK,
    );

    if (!isValidSignature) {
      throw new BadRequestException('Invalid Paystack webhook signature');
    }

    const event = payload.event;
    const data = payload.data;
    
    if (!['charge.success', 'charge.failed'].includes(event)) {
      return {
        success: true,
        message: `Unsupported event type: ${event}`,
      };
    }

    const status = event === 'charge.success' 
      ? PaymentStatus.COMPLETED 
      : PaymentStatus.FAILED;

    await this.paymentService.updatePaymentStatus(data.reference, {
      status,
      gatewayReference: data.id,
    });

    return { success: true };
  }

  private verifyWebhookSignature(
    payload: any,
    signature: string,
    secret: string,
    gateway: PaymentGateway,
  ): boolean {
    const rawBody = JSON.stringify(payload);

    switch (gateway) {
      case PaymentGateway.STRIPE:
        return this.verifyStripeSignature(rawBody, signature, secret);
      case PaymentGateway.PAYSTACK:
        return this.verifyPaystackSignature(rawBody, signature, secret);
      case PaymentGateway.FLUTTERWAVE:
        return this.verifyFlutterwaveSignature(rawBody, signature, secret);
      default:
        return true; // No verification for unsupported gateways
    }
  }

  private verifyStripeSignature(rawBody: string, signature: string, secret: string): boolean {
    try {
      const elements = signature.split(',');
      const signatureObj: { [key: string]: string } = {};

      for (const element of elements) {
        const [key, value] = element.split('=');
        signatureObj[key] = value;
      }

      const timestamp = signatureObj.t;
      const v1 = signatureObj.v1;

      if (!timestamp || !v1) return false;

      // Check timestamp tolerance (5 minutes)
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp)) > 300) {
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`, 'utf8')
        .digest('hex');

      return expectedSignature === v1;
    } catch {
      return false;
    }
  }

  private verifyPaystackSignature(rawBody: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha512', secret)
      .update(rawBody, 'utf8')
      .digest('hex');

    return expectedSignature === signature;
  }

  private verifyFlutterwaveSignature(rawBody: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');

    return expectedSignature === signature;
  }

  private extractPaymentDataFromWebhook(payload: any, gateway: PaymentGateway): {
    reference: string;
    status: PaymentStatus;
    externalId: string;
  } {
    switch (gateway) {
      case PaymentGateway.STRIPE:
        return this.extractStripeData(payload);
      case PaymentGateway.PAYSTACK:
        return this.extractPaystackData(payload);
      case PaymentGateway.FLUTTERWAVE:
        return this.extractFlutterwaveData(payload);
      default:
        throw new Error(`Unsupported gateway: ${gateway}`);
    }
  }

  private extractStripeData(payload: any): {
    reference: string;
    status: PaymentStatus;
    externalId: string;
  } {
    const paymentObject = payload.data.object;
    const reference = paymentObject.metadata?.payment_reference;

    if (!reference) {
      throw new Error('Payment reference not found in webhook payload');
    }

    const status = payload.type === 'payment_intent.succeeded' 
      ? PaymentStatus.COMPLETED 
      : PaymentStatus.FAILED;

    return {
      reference,
      status,
      externalId: paymentObject.id,
    };
  }

  private extractPaystackData(payload: any): {
    reference: string;
    status: PaymentStatus;
    externalId: string;
  } {
    const data = payload.data;
    const status = payload.event === 'charge.success' 
      ? PaymentStatus.COMPLETED 
      : PaymentStatus.FAILED;

    return {
      reference: data.reference,
      status,
      externalId: data.id,
    };
  }

  private extractFlutterwaveData(payload: any): {
    reference: string;
    status: PaymentStatus;
    externalId: string;
  } {
    const data = payload.data;
    const status = payload.event === 'charge.completed' 
      ? PaymentStatus.COMPLETED 
      : PaymentStatus.FAILED;

    return {
      reference: data.tx_ref,
      status,
      externalId: data.id.toString(),
    };
  }
}