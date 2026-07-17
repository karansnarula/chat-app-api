import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    // Create fake versions of PrismaService and JwtService
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('fake-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should throw ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' });

      await expect(
        service.register({
          email: 'test@test.com',
          password: 'password123',
          displayName: 'Test',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should hash the password before saving', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        displayName: 'Test',
        password: 'hashed-password',
      });

      await service.register({
        email: 'test@test.com',
        password: 'plainPassword123',
        displayName: 'Test',
      });

      const createCallArgs = prisma.user.create.mock.calls[0][0];
      expect(createCallArgs.data.password).not.toBe('plainPassword123');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      const hashedPassword = await bcrypt.hash('correctPassword', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        password: hashedPassword,
        displayName: 'Test',
      });

      await expect(
        service.login({ email: 'test@test.com', password: 'wrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should succeed with correct credentials', async () => {
      const hashedPassword = await bcrypt.hash('correctPassword', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        password: hashedPassword,
        displayName: 'Test',
      });

      const result = await service.login({
        email: 'test@test.com',
        password: 'correctPassword',
      });

      expect(result.user.email).toBe('test@test.com');
      expect(result.accessToken).toBe('fake-jwt-token');
    });
  });
});