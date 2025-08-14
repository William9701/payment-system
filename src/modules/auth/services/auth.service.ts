import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Merchant, MerchantStatus, MerchantType } from '../../merchants/entities/merchant.entity';
import { 
  JwtPayload, 
  JwtTokens, 
  AuthenticatedMerchant 
} from '../interfaces/jwt-payload.interface';
import {
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ merchant: AuthenticatedMerchant; tokens: JwtTokens }> {
    // Check if merchant already exists
    const existingMerchant = await this.merchantRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingMerchant) {
      throw new ConflictException('Merchant with this email already exists');
    }

    // Check business ID uniqueness if provided
    if (registerDto.businessId) {
      const existingBusinessId = await this.merchantRepository.findOne({
        where: { businessId: registerDto.businessId },
      });

      if (existingBusinessId) {
        throw new ConflictException('Business ID already exists');
      }
    }

    // Hash password
    const saltRounds = this.configService.get<number>('app.bcryptRounds') || 10;
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

    // Create merchant
    const merchant = this.merchantRepository.create({
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
      merchantType: registerDto.merchantType,
      phone: registerDto.phone,
      address: registerDto.address,
      businessName: registerDto.businessName,
      businessId: registerDto.businessId,
      status: MerchantStatus.PENDING,
      totalProcessedAmount: 0,
      totalTransactions: 0,
      createdBy: 'system',
      updatedBy: 'system',
    });

    const savedMerchant = await this.merchantRepository.save(merchant);

    // Generate tokens
    const tokens = await this.generateTokens(savedMerchant);

    // Return authenticated merchant without password
    const authenticatedMerchant = this.toAuthenticatedMerchant(savedMerchant);

    return { merchant: authenticatedMerchant, tokens };
  }

  async login(loginDto: LoginDto): Promise<{ merchant: AuthenticatedMerchant; tokens: JwtTokens }> {
    const merchant = await this.validateMerchant(loginDto.email, loginDto.password);

    if (!merchant) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Get the full merchant entity for token generation
    const fullMerchant = await this.merchantRepository.findOne({
      where: { id: merchant.id },
    });

    if (!fullMerchant) {
      throw new UnauthorizedException('Merchant not found');
    }

    // Update last login timestamp
    await this.merchantRepository.update(merchant.id, {
      lastTransactionAt: new Date(),
      updatedBy: merchant.id,
    });

    const tokens = await this.generateTokens(fullMerchant);

    return { merchant, tokens };
  }

  async validateMerchant(email: string, password: string): Promise<AuthenticatedMerchant | null> {
    const merchant = await this.merchantRepository.findOne({
      where: { email },
      select: ['id', 'email', 'name', 'password', 'merchantType', 'status', 'businessName', 'businessId', 'verifiedAt'],
    });

    if (!merchant) {
      return null;
    }

    if (merchant.status === MerchantStatus.SUSPENDED) {
      throw new UnauthorizedException('Account suspended');
    }

    if (merchant.status === MerchantStatus.INACTIVE) {
      throw new UnauthorizedException('Account inactive');
    }

    const isPasswordValid = await bcrypt.compare(password, merchant.password);

    if (!isPasswordValid) {
      return null;
    }

    return this.toAuthenticatedMerchant(merchant);
  }

  async refreshTokens(refreshToken: string): Promise<JwtTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('app.jwt.refreshSecret'),
      });

      const merchant = await this.merchantRepository.findOne({
        where: { id: payload.sub, email: payload.email },
      });

      if (!merchant) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (merchant.status === MerchantStatus.SUSPENDED || merchant.status === MerchantStatus.INACTIVE) {
        throw new UnauthorizedException('Account not active');
      }

      return this.generateTokens(merchant);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async changePassword(merchantId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
      select: ['id', 'password'],
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      merchant.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const saltRounds = this.configService.get<number>('app.bcryptRounds') || 10;
    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, saltRounds);

    await this.merchantRepository.update(merchantId, {
      password: hashedNewPassword,
      updatedBy: merchantId,
    });
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const merchant = await this.merchantRepository.findOne({
      where: { email: forgotPasswordDto.email },
    });

    if (!merchant) {
      // Don't reveal if email exists for security
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // In a real application, you would:
    // 1. Generate a secure reset token
    // 2. Store it in the database with expiration
    // 3. Send email with reset link
    
    // For now, just return success message
    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    // In a real application, you would:
    // 1. Verify the reset token
    // 2. Check token expiration
    // 3. Update password
    
    // For now, just return success message
    return { message: 'Password has been reset successfully' };
  }

  async getProfile(merchantId: string): Promise<AuthenticatedMerchant> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    return this.toAuthenticatedMerchant(merchant);
  }

  private async generateTokens(merchant: Merchant): Promise<JwtTokens> {
    const payload: JwtPayload = {
      sub: merchant.id,
      email: merchant.email,
      merchantType: merchant.merchantType,
      status: merchant.status,
    };

    const jwtConfig = this.configService.get('app.jwt');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtConfig.secret,
        expiresIn: jwtConfig.expiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: jwtConfig.refreshSecret,
        expiresIn: jwtConfig.refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private toAuthenticatedMerchant(merchant: Merchant): AuthenticatedMerchant {
    return {
      id: merchant.id,
      email: merchant.email,
      name: merchant.name,
      merchantType: merchant.merchantType,
      status: merchant.status,
      businessName: merchant.businessName,
      businessId: merchant.businessId,
      verifiedAt: merchant.verifiedAt,
    };
  }
}