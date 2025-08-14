import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedMerchant } from '../../modules/auth/interfaces/jwt-payload.interface';

@Injectable()
export class VerifiedMerchantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresVerification = this.reflector.getAllAndOverride<boolean>('requiresVerification', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If verification is not required for this route, allow access
    if (!requiresVerification) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedMerchant = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if merchant is verified
    if (!user.verifiedAt) {
      throw new ForbiddenException('Account verification required to access this resource');
    }

    return true;
  }
}