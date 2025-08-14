import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../services/auth.service';
import { AuthenticatedMerchant } from '../interfaces/jwt-payload.interface';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
    });
  }

  async validate(email: string, password: string): Promise<AuthenticatedMerchant> {
    const merchant = await this.authService.validateMerchant(email, password);
    
    if (!merchant) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return merchant;
  }
}