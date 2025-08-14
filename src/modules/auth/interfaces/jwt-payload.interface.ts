export interface JwtPayload {
  sub: string; // merchant id
  email: string;
  merchantType: string;
  status: string;
  iat?: number;
  exp?: number;
}

export interface JwtTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedMerchant {
  id: string;
  email: string;
  name: string;
  merchantType: string;
  status: string;
  businessName?: string;
  businessId?: string;
  verifiedAt?: Date;
}