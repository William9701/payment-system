import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { Merchant } from '../../merchants/entities/merchant.entity';
import { RegisterDto, LoginDto, ChangePasswordDto } from '../dto/auth.dto';
import { MerchantStatus, MerchantType } from '../../merchants/entities/merchant.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockedBcrypt = bcrypt as jest.Mocked<{
  hash: jest.MockedFunction<any>;
  compare: jest.MockedFunction<any>;
}>;

describe('AuthService', () => {
  let service: AuthService;
  let merchantRepository: jest.Mocked<Repository<Merchant>>;
  let jwtService: jest.Mocked<JwtService>;

  const mockMerchant: Merchant = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    name: 'Test Merchant',
    password: '$2b$10$hashedpassword',
    merchantType: MerchantType.INDIVIDUAL,
    status: MerchantStatus.ACTIVE,
    phone: '+1234567890',
    businessId: undefined,
    totalProcessedAmount: 0,
    totalTransactions: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    updatedBy: 'system',
    payments: [],
    paymentMethods: [],
  } as Merchant;

  const mockTokens = {
    accessToken: 'mock.access.token',
    refreshToken: 'mock.refresh.token',
  };

  beforeEach(async () => {
    const mockMerchantRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn(),
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'app.jwt') {
          return {
            secret: 'test-secret',
            refreshSecret: 'test-refresh-secret',
            expiresIn: '15m',
            refreshExpiresIn: '7d',
          };
        }
        if (key === 'app.bcryptRounds') {
          return 10;
        }
        if (key === 'app.jwt.refreshSecret') {
          return 'test-refresh-secret';
        }
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(Merchant),
          useValue: mockMerchantRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    merchantRepository = module.get(getRepositoryToken(Merchant));
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      name: 'New User',
      merchantType: MerchantType.INDIVIDUAL,
      phone: '+1234567890',
    };

    it('should successfully register a new merchant', async () => {
      merchantRepository.findOne.mockResolvedValue(null);
      merchantRepository.create.mockReturnValue({ ...mockMerchant, ...registerDto } as Merchant);
      merchantRepository.save.mockResolvedValue({ ...mockMerchant, ...registerDto } as Merchant);
      mockedBcrypt.hash.mockResolvedValue('$2b$10$hashedpassword');
      jwtService.signAsync.mockResolvedValueOnce(mockTokens.accessToken).mockResolvedValueOnce(mockTokens.refreshToken);

      const result = await service.register(registerDto);

      expect(merchantRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, expect.any(Number));
      expect(merchantRepository.create).toHaveBeenCalledWith({
        name: registerDto.name,
        email: registerDto.email,
        password: '$2b$10$hashedpassword',
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
      expect(merchantRepository.save).toHaveBeenCalled();
      expect(result.merchant.email).toBe(registerDto.email);
      expect(result.tokens).toEqual(mockTokens);
      expect(result.merchant).not.toHaveProperty('password');
    });

    it('should throw ConflictException if email already exists', async () => {
      merchantRepository.findOne.mockResolvedValue(mockMerchant);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(merchantRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(merchantRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
    };

    it('should successfully log in a merchant', async () => {
      merchantRepository.findOne
        .mockResolvedValueOnce(mockMerchant)
        .mockResolvedValueOnce(mockMerchant);
      mockedBcrypt.compare.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValueOnce(mockTokens.accessToken).mockResolvedValueOnce(mockTokens.refreshToken);
      merchantRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.login(loginDto);

      expect(merchantRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
        select: ['id', 'email', 'name', 'password', 'merchantType', 'status', 'businessName', 'businessId', 'verifiedAt'],
      });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockMerchant.password);
      expect(merchantRepository.update).toHaveBeenCalledWith(mockMerchant.id, {
        lastTransactionAt: expect.any(Date),
        updatedBy: mockMerchant.id,
      });
      expect(result.merchant.email).toBe(loginDto.email);
      expect(result.tokens).toEqual(mockTokens);
      expect(result.merchant).not.toHaveProperty('password');
    });

    it('should throw UnauthorizedException if merchant not found', async () => {
      merchantRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(merchantRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
        select: ['id', 'email', 'name', 'password', 'merchantType', 'status', 'businessName', 'businessId', 'verifiedAt'],
      });
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      merchantRepository.findOne.mockResolvedValue(mockMerchant);
      mockedBcrypt.compare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockMerchant.password);
      expect(merchantRepository.update).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if merchant is inactive', async () => {
      const inactiveMerchant = { ...mockMerchant, status: MerchantStatus.SUSPENDED };
      merchantRepository.findOne.mockResolvedValue(inactiveMerchant);
      mockedBcrypt.compare.mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(merchantRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    const refreshToken = 'valid.refresh.token';

    it('should successfully refresh tokens', async () => {
      const mockPayload = { sub: mockMerchant.id, email: mockMerchant.email };
      jwtService.verify.mockReturnValue(mockPayload);
      merchantRepository.findOne.mockResolvedValue(mockMerchant);
      jwtService.signAsync.mockResolvedValueOnce(mockTokens.accessToken).mockResolvedValueOnce(mockTokens.refreshToken);

      const result = await service.refreshTokens(refreshToken);

      expect(jwtService.verify).toHaveBeenCalledWith(refreshToken, {
        secret: 'test-refresh-secret',
      });
      expect(merchantRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockPayload.sub, email: mockPayload.email },
      });
      expect(result).toEqual(mockTokens);
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(UnauthorizedException);
      expect(merchantRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if merchant not found', async () => {
      const mockPayload = { sub: 'non-existent-id', email: 'test@example.com' };
      jwtService.verify.mockReturnValue(mockPayload);
      merchantRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateMerchant', () => {
    it('should return merchant if credentials are valid', async () => {
      merchantRepository.findOne.mockResolvedValue(mockMerchant);
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await service.validateMerchant(mockMerchant.email, 'password');

      expect(merchantRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockMerchant.email },
        select: ['id', 'email', 'name', 'password', 'merchantType', 'status', 'businessName', 'businessId', 'verifiedAt'],
      });
      expect(result).toEqual(service['toAuthenticatedMerchant'](mockMerchant));
    });

    it('should return null if merchant not found', async () => {
      merchantRepository.findOne.mockResolvedValue(null);

      const result = await service.validateMerchant('test@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should throw UnauthorizedException if merchant is suspended', async () => {
      const inactiveMerchant = { ...mockMerchant, status: MerchantStatus.SUSPENDED };
      merchantRepository.findOne.mockResolvedValue(inactiveMerchant);

      await expect(service.validateMerchant(inactiveMerchant.email, 'password')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('private methods', () => {
    describe('generateTokens', () => {
      it('should generate access and refresh tokens', async () => {
        jwtService.signAsync.mockResolvedValueOnce(mockTokens.accessToken).mockResolvedValueOnce(mockTokens.refreshToken);

        const result = await service['generateTokens'](mockMerchant);

        expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
        expect(result).toEqual(mockTokens);
      });
    });

    describe('toAuthenticatedMerchant', () => {
      it('should exclude password from merchant object', () => {
        const result = service['toAuthenticatedMerchant'](mockMerchant);

        expect(result).not.toHaveProperty('password');
        expect(result.email).toBe(mockMerchant.email);
        expect(result.name).toBe(mockMerchant.name);
        expect(result.id).toBe(mockMerchant.id);
      });
    });
  });
});