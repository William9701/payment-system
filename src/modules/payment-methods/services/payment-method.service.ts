import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod, PaymentMethodStatus } from '../entities/payment-method.entity';
import { Merchant, MerchantStatus } from '../../merchants/entities/merchant.entity';
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
  PaymentMethodResponseDto,
} from '../dto/payment-method.dto';

@Injectable()
export class PaymentMethodService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
  ) {}

  async createPaymentMethod(
    merchantId: string,
    createPaymentMethodDto: CreatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    // Validate merchant exists and is active
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    if (merchant.status !== MerchantStatus.ACTIVE) {
      throw new BadRequestException('Merchant account must be active to create payment methods');
    }

    // If this is set as default, unset other defaults
    if (createPaymentMethodDto.isDefault) {
      await this.paymentMethodRepository.update(
        { merchantId, isDefault: true },
        { isDefault: false, updatedBy: merchantId },
      );
    }

    // Create payment method
    const paymentMethod = this.paymentMethodRepository.create({
      ...createPaymentMethodDto,
      merchantId,
      status: PaymentMethodStatus.ACTIVE,
      createdBy: merchantId,
      updatedBy: merchantId,
    });

    const savedPaymentMethod = await this.paymentMethodRepository.save(paymentMethod);

    return this.toPaymentMethodResponse(savedPaymentMethod);
  }

  async getPaymentMethods(merchantId: string): Promise<PaymentMethodResponseDto[]> {
    const paymentMethods = await this.paymentMethodRepository.find({
      where: { merchantId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    return paymentMethods.map(pm => this.toPaymentMethodResponse(pm));
  }

  async getPaymentMethod(merchantId: string, paymentMethodId: string): Promise<PaymentMethodResponseDto> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, merchantId },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    return this.toPaymentMethodResponse(paymentMethod);
  }

  async updatePaymentMethod(
    merchantId: string,
    paymentMethodId: string,
    updatePaymentMethodDto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodResponseDto> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, merchantId },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    // If this is being set as default, unset other defaults
    if (updatePaymentMethodDto.isDefault) {
      await this.paymentMethodRepository.update(
        { merchantId, isDefault: true },
        { isDefault: false, updatedBy: merchantId },
      );
    }

    // Update payment method
    await this.paymentMethodRepository.update(
      { id: paymentMethodId, merchantId },
      {
        ...updatePaymentMethodDto,
        updatedBy: merchantId,
        updatedAt: new Date(),
      },
    );

    const updatedPaymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, merchantId },
    });

    return this.toPaymentMethodResponse(updatedPaymentMethod!);
  }

  async deletePaymentMethod(merchantId: string, paymentMethodId: string): Promise<void> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, merchantId },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    // Check if this payment method is being used in active payments
    const activePaymentsCount = await this.paymentMethodRepository.manager.query(
      'SELECT COUNT(*) as count FROM payments WHERE payment_method_id = $1 AND status IN ($2, $3)',
      [paymentMethodId, 'pending', 'processing']
    );

    if (activePaymentsCount[0].count > 0) {
      throw new ConflictException('Cannot delete payment method with active payments');
    }

    await this.paymentMethodRepository.softDelete(paymentMethodId);
  }

  async setDefaultPaymentMethod(merchantId: string, paymentMethodId: string): Promise<PaymentMethodResponseDto> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, merchantId },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    if (paymentMethod.status !== PaymentMethodStatus.ACTIVE) {
      throw new BadRequestException('Only active payment methods can be set as default');
    }

    // Unset current default
    await this.paymentMethodRepository.update(
      { merchantId, isDefault: true },
      { isDefault: false, updatedBy: merchantId },
    );

    // Set new default
    await this.paymentMethodRepository.update(
      { id: paymentMethodId, merchantId },
      { isDefault: true, updatedBy: merchantId, updatedAt: new Date() },
    );

    const updatedPaymentMethod = await this.paymentMethodRepository.findOne({
      where: { id: paymentMethodId, merchantId },
    });

    return this.toPaymentMethodResponse(updatedPaymentMethod!);
  }

  private toPaymentMethodResponse(paymentMethod: PaymentMethod): PaymentMethodResponseDto {
    return {
      id: paymentMethod.id,
      name: paymentMethod.name,
      type: paymentMethod.type,
      status: paymentMethod.status,
      isDefault: paymentMethod.isDefault,
      externalId: paymentMethod.externalId,
      externalProvider: paymentMethod.externalProvider,
      createdAt: paymentMethod.createdAt,
      updatedAt: paymentMethod.updatedAt,
      lastUsedAt: paymentMethod.lastUsedAt,
      metadata: paymentMethod.metadata,
    };
  }
}