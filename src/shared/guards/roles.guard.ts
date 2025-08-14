import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MerchantType, MerchantStatus } from '../../modules/merchants/entities/merchant.entity';
import { AuthenticatedMerchant } from '../../modules/auth/interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<MerchantType[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedMerchant = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if merchant account is active
    if (user.status !== MerchantStatus.ACTIVE) {
      throw new ForbiddenException('Account must be active to access this resource');
    }

    // Check if merchant has required role
    const hasRole = requiredRoles.some((role) => user.merchantType === role);

    if (!hasRole) {
      throw new ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}