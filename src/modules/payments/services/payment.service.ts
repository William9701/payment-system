import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentType } from '../entities/payment.entity';
import { PaymentMethod, PaymentMethodStatus } from '../../payment-methods/entities/payment-method.entity';
import { Merchant, MerchantStatus } from '../../merchants/entities/merchant.entity';
import { InitializePaymentDto, PaymentResponseDto, UpdatePaymentStatusDto } from '../dto/payment.dto';
import { AuthenticatedMerchant } from '../../auth/interfaces/jwt-payload.interface';
import { SqsProducerService } from '../../sqs/services/sqs-producer.service';
import { PaymentEventData } from '../../sqs/interfaces/payment-event.interface';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    private readonly sqsProducerService: SqsProducerService,
  ) {}

  async initializePayment(
    merchantId: string,
    initializePaymentDto: InitializePaymentDto,
  ): Promise<PaymentResponseDto> {
    // Validate merchant
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    if (merchant.status !== MerchantStatus.ACTIVE) {
      throw new ForbiddenException('Merchant account must be active to process payments');
    }

    // Validate payment method if provided
    let paymentMethod: PaymentMethod | null = null;
    if (initializePaymentDto.paymentMethodId) {
      paymentMethod = await this.paymentMethodRepository.findOne({
        where: {
          id: initializePaymentDto.paymentMethodId,
          merchantId: merchantId,
        },
      });

      if (!paymentMethod) {
        throw new NotFoundException('Payment method not found or does not belong to merchant');
      }

      if (paymentMethod.status !== PaymentMethodStatus.ACTIVE) {
        throw new BadRequestException('Payment method is not active');
      }

      if (paymentMethod.expiresAt && paymentMethod.expiresAt < new Date()) {
        throw new BadRequestException('Payment method has expired');
      }
    }

    // Create payment
    const payment = this.paymentRepository.create({
      merchantId,
      paymentMethodId: paymentMethod?.id,
      amount: initializePaymentDto.amount,
      currency: initializePaymentDto.currency,
      gateway: initializePaymentDto.gateway,
      description: initializePaymentDto.description,
      customerEmail: initializePaymentDto.customerEmail,
      customerName: initializePaymentDto.customerName,
      customerPhone: initializePaymentDto.customerPhone,
      metadata: initializePaymentDto.metadata,
      status: PaymentStatus.PENDING,
      paymentType: PaymentType.PAYMENT,
      initiatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      createdBy: merchantId,
      updatedBy: merchantId,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Update payment method last used timestamp
    if (paymentMethod) {
      await this.paymentMethodRepository.update(paymentMethod.id, {
        lastUsedAt: new Date(),
        updatedBy: merchantId,
      });
    }

    // Publish 'payment-initiated' event to SQS
    try {
      const eventData: PaymentEventData = {
        paymentId: savedPayment.id,
        reference: savedPayment.reference,
        merchantId: savedPayment.merchantId,
        amount: savedPayment.amount,
        currency: savedPayment.currency,
        status: savedPayment.status,
        gateway: savedPayment.gateway,
        customerEmail: savedPayment.customerEmail,
        customerName: savedPayment.customerName,
        metadata: savedPayment.metadata,
        timestamp: savedPayment.createdAt,
      };

      await this.sqsProducerService.publishPaymentInitiated(eventData);
    } catch (error) {
      // Log error but don't fail the payment initialization
      console.error('Failed to publish payment initiated event to SQS:', error);
    }

    return this.toPaymentResponse(savedPayment);
  }

  async getPayment(reference: string, merchantId: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { reference, merchantId },
      relations: ['paymentMethod'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.toPaymentResponse(payment);
  }

  async getPaymentsByMerchant(
    merchantId: string,
    page: number = 1,
    limit: number = 10,
    status?: PaymentStatus,
  ): Promise<{ payments: PaymentResponseDto[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.merchantId = :merchantId', { merchantId })
      .leftJoinAndSelect('payment.paymentMethod', 'paymentMethod');

    if (status) {
      queryBuilder.andWhere('payment.status = :status', { status });
    }

    const [payments, total] = await queryBuilder
      .orderBy('payment.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      payments: payments.map(payment => this.toPaymentResponse(payment)),
      total,
      page,
      limit,
    };
  }

  async updatePaymentStatus(
    reference: string,
    updatePaymentStatusDto: UpdatePaymentStatusDto,
    merchantId?: string,
  ): Promise<PaymentResponseDto> {
    const whereCondition: any = [
      { reference },
    ];

    // If merchantId is provided, restrict to that merchant
    if (merchantId) {
      whereCondition[0].merchantId = merchantId;
    }

    const payment = await this.paymentRepository.findOne({
      where: whereCondition,
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Validate status transition
    if (!this.isValidStatusTransition(payment.status, updatePaymentStatusDto.status as PaymentStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${payment.status} to ${updatePaymentStatusDto.status}`,
      );
    }

    // Update payment
    const updateData: Partial<Payment> = {
      status: updatePaymentStatusDto.status as PaymentStatus,
      gatewayReference: updatePaymentStatusDto.gatewayReference,
      gatewayResponse: updatePaymentStatusDto.gatewayResponse,
      failureCode: updatePaymentStatusDto.failureCode,
      failureReason: updatePaymentStatusDto.failureReason,
      updatedBy: merchantId || 'system',
    };

    // Set timestamps based on status
    switch (updatePaymentStatusDto.status) {
      case PaymentStatus.PROCESSING:
        updateData.processedAt = new Date();
        break;
      case PaymentStatus.COMPLETED:
        updateData.completedAt = new Date();
        updateData.netAmount = this.calculateNetAmount(payment);
        break;
      case PaymentStatus.FAILED:
      case PaymentStatus.CANCELLED:
      case PaymentStatus.EXPIRED:
        updateData.failedAt = new Date();
        break;
    }

    await this.paymentRepository.update(payment.id, updateData);

    // Update merchant statistics if payment completed
    if (updatePaymentStatusDto.status === PaymentStatus.COMPLETED) {
      await this.updateMerchantStatistics(payment.merchantId, payment.amount);
    }

    // Publish payment status update event to SQS
    try {
      const eventData: PaymentEventData = {
        paymentId: payment.id,
        reference: payment.reference,
        merchantId: payment.merchantId,
        amount: payment.amount,
        currency: payment.currency,
        status: updatePaymentStatusDto.status,
        gateway: payment.gateway,
        customerEmail: payment.customerEmail,
        customerName: payment.customerName,
        metadata: payment.metadata,
        failureCode: updatePaymentStatusDto.failureCode,
        failureReason: updatePaymentStatusDto.failureReason,
        gatewayReference: updatePaymentStatusDto.gatewayReference,
        timestamp: new Date(),
      };

      // Publish appropriate event based on status
      switch (updatePaymentStatusDto.status) {
        case PaymentStatus.COMPLETED:
          await this.sqsProducerService.publishPaymentCompleted(eventData);
          break;
        case PaymentStatus.FAILED:
          await this.sqsProducerService.publishPaymentFailed(eventData);
          break;
        case PaymentStatus.CANCELLED:
          await this.sqsProducerService.publishPaymentCancelled(eventData);
          break;
        case PaymentStatus.REFUNDED:
        case PaymentStatus.PARTIALLY_REFUNDED:
          await this.sqsProducerService.publishPaymentRefunded(eventData);
          break;
        default:
          // For other statuses, publish a generic payment event
          await this.sqsProducerService.publishPaymentEvent(
            updatePaymentStatusDto.status as any,
            eventData,
          );
      }
    } catch (error) {
      // Log error but don't fail the payment update
      console.error('Failed to publish payment status update event to SQS:', error);
    }

    const updatedPayment = await this.paymentRepository.findOne({
      where: { id: payment.id },
    });

    return this.toPaymentResponse(updatedPayment!);
  }

  async getPaymentStatistics(merchantId: string): Promise<{
    totalPayments: number;
    totalAmount: number;
    successfulPayments: number;
    failedPayments: number;
    pendingPayments: number;
  }> {
    const [
      totalPayments,
      totalAmount,
      successfulPayments,
      failedPayments,
      pendingPayments,
    ] = await Promise.all([
      this.paymentRepository.count({ where: { merchantId } }),
      this.paymentRepository
        .createQueryBuilder('payment')
        .where('payment.merchantId = :merchantId', { merchantId })
        .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
        .select('SUM(payment.amount)', 'total')
        .getRawOne()
        .then(result => parseFloat(result.total) || 0),
      this.paymentRepository.count({
        where: { merchantId, status: PaymentStatus.COMPLETED },
      }),
      this.paymentRepository.count({
        where: { merchantId, status: PaymentStatus.FAILED },
      }),
      this.paymentRepository.count({
        where: { merchantId, status: PaymentStatus.PENDING },
      }),
    ]);

    return {
      totalPayments,
      totalAmount,
      successfulPayments,
      failedPayments,
      pendingPayments,
    };
  }

  private isValidStatusTransition(currentStatus: PaymentStatus, newStatus: PaymentStatus): boolean {
    const validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
      [PaymentStatus.PENDING]: [
        PaymentStatus.PROCESSING,
        PaymentStatus.COMPLETED,
        PaymentStatus.FAILED,
        PaymentStatus.CANCELLED,
        PaymentStatus.EXPIRED,
      ],
      [PaymentStatus.PROCESSING]: [
        PaymentStatus.COMPLETED,
        PaymentStatus.FAILED,
        PaymentStatus.CANCELLED,
      ],
      [PaymentStatus.COMPLETED]: [
        PaymentStatus.REFUNDED,
        PaymentStatus.PARTIALLY_REFUNDED,
        PaymentStatus.DISPUTED,
      ],
      [PaymentStatus.FAILED]: [],
      [PaymentStatus.CANCELLED]: [],
      [PaymentStatus.REFUNDED]: [],
      [PaymentStatus.PARTIALLY_REFUNDED]: [PaymentStatus.REFUNDED],
      [PaymentStatus.DISPUTED]: [],
      [PaymentStatus.EXPIRED]: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
  }

  private calculateNetAmount(payment: Payment): number {
    return payment.amount - payment.gatewayFee - payment.platformFee;
  }

  private async updateMerchantStatistics(merchantId: string, amount: number): Promise<void> {
    await this.merchantRepository
      .createQueryBuilder()
      .update(Merchant)
      .set({
        totalProcessedAmount: () => `total_processed_amount + ${amount}`,
        totalTransactions: () => 'total_transactions + 1',
        lastTransactionAt: new Date(),
      })
      .where('id = :merchantId', { merchantId })
      .execute();
  }

  private toPaymentResponse(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      gateway: payment.gateway,
      description: payment.description,
      customerEmail: payment.customerEmail,
      customerName: payment.customerName,
      createdAt: payment.createdAt,
      expiresAt: payment.expiresAt,
      metadata: payment.metadata,
    };
  }
}