import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant, MerchantStatus } from '../../merchants/entities/merchant.entity';
import { JwtPayload, AuthenticatedMerchant } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('app.jwt.secret') || 'default-secret-key',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedMerchant> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: payload.sub, email: payload.email },
    });

    if (!merchant) {
      throw new UnauthorizedException('Invalid token: merchant not found');
    }

    if (merchant.status === MerchantStatus.SUSPENDED) {
      throw new UnauthorizedException('Account suspended');
    }

    if (merchant.status === MerchantStatus.INACTIVE) {
      throw new UnauthorizedException('Account inactive');
    }

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