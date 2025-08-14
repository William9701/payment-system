import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedMerchant } from '../../modules/auth/interfaces/jwt-payload.interface';

/**
 * Extract the current authenticated merchant from the request
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedMerchant | undefined, ctx: ExecutionContext): AuthenticatedMerchant | any => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedMerchant = request.user;

    return data ? user?.[data] : user;
  },
);