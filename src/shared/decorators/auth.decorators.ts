import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { MerchantType, MerchantStatus } from '../../modules/merchants/entities/merchant.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { MerchantStatusGuard } from '../guards/merchant-status.guard';
import { VerifiedMerchantGuard } from '../guards/verified-merchant.guard';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const MERCHANT_STATUS_KEY = 'merchantStatus';
export const REQUIRES_VERIFICATION_KEY = 'requiresVerification';

/**
 * Mark a route as public (no authentication required)
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Require specific merchant roles to access the route
 * @param roles - Array of required merchant types
 */
export const Roles = (...roles: MerchantType[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Require specific merchant statuses to access the route
 * @param statuses - Array of required merchant statuses
 */
export const RequireStatus = (...statuses: MerchantStatus[]) => SetMetadata(MERCHANT_STATUS_KEY, statuses);

/**
 * Require merchant verification to access the route
 */
export const RequireVerification = () => SetMetadata(REQUIRES_VERIFICATION_KEY, true);

/**
 * Apply JWT authentication with optional role and status restrictions
 */
export function Auth(...roles: MerchantType[]) {
  const guards: any[] = [JwtAuthGuard];
  
  if (roles && roles.length > 0) {
    guards.push(RolesGuard);
  }

  return applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(...guards),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Authentication required' }),
    ApiForbiddenResponse({ description: 'Insufficient permissions' }),
  );
}

/**
 * Apply JWT authentication with merchant status requirements
 */
export function AuthWithStatus(...statuses: MerchantStatus[]) {
  return applyDecorators(
    SetMetadata(MERCHANT_STATUS_KEY, statuses),
    UseGuards(JwtAuthGuard, MerchantStatusGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Authentication required' }),
    ApiForbiddenResponse({ description: 'Invalid account status' }),
  );
}

/**
 * Apply JWT authentication with verification requirement
 */
export function AuthVerified() {
  return applyDecorators(
    SetMetadata(REQUIRES_VERIFICATION_KEY, true),
    UseGuards(JwtAuthGuard, VerifiedMerchantGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Authentication required' }),
    ApiForbiddenResponse({ description: 'Account verification required' }),
  );
}

/**
 * Apply JWT authentication for active merchants only
 */
export function AuthActive() {
  return applyDecorators(
    SetMetadata(MERCHANT_STATUS_KEY, [MerchantStatus.ACTIVE]),
    UseGuards(JwtAuthGuard, MerchantStatusGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Authentication required' }),
    ApiForbiddenResponse({ description: 'Account must be active' }),
  );
}

/**
 * Apply JWT authentication for business/enterprise merchants only
 */
export function AuthBusiness() {
  return applyDecorators(
    SetMetadata(ROLES_KEY, [MerchantType.BUSINESS, MerchantType.ENTERPRISE]),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Authentication required' }),
    ApiForbiddenResponse({ description: 'Business account required' }),
  );
}

/**
 * Apply JWT authentication for enterprise merchants only
 */
export function AuthEnterprise() {
  return applyDecorators(
    SetMetadata(ROLES_KEY, [MerchantType.ENTERPRISE]),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Authentication required' }),
    ApiForbiddenResponse({ description: 'Enterprise account required' }),
  );
}