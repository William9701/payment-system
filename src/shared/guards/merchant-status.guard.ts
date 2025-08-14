import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MerchantStatus } from '../../modules/merchants/entities/merchant.entity';
import { AuthenticatedMerchant } from '../../modules/auth/interfaces/jwt-payload.interface';

@Injectable()
export class MerchantStatusGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredStatuses = this.reflector.getAllAndOverride<MerchantStatus[]>('merchantStatus', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredStatuses) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedMerchant = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const hasValidStatus = requiredStatuses.some((status) => user.status === status);

    if (!hasValidStatus) {
      throw new ForbiddenException(`Access denied. Account status must be: ${requiredStatuses.join(', ')}`);
    }

    return true;
  }
}