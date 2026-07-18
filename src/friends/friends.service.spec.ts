import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from '../messages/messages.gateway';

describe('FriendsService', () => {
  let service: FriendsService;
  let prisma: any;
  let gateway: { notifyFriendRequest: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      friendship: { findFirst: jest.fn(), create: jest.fn() },
      friendRequest: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    gateway = {
      notifyFriendRequest: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        { provide: PrismaService, useValue: prisma },
        { provide: MessagesGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
  });

  describe('sendRequest', () => {
    it('should throw NotFoundException if receiver email does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.sendRequest('sender-id', 'nobody@test.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user tries to add themselves', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'sender-id',
        email: 'self@test.com',
      });

      await expect(
        service.sendRequest('sender-id', 'self@test.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already friends', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'receiver-id',
        email: 'friend@test.com',
      });
      prisma.friendship.findFirst.mockResolvedValue({
        id: 'existing-friendship',
      });

      await expect(
        service.sendRequest('sender-id', 'friend@test.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if a request already exists', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'receiver-id', email: 'friend@test.com' }) // receiver lookup
        .mockResolvedValueOnce({ id: 'sender-id', displayName: 'Sender' }); // sender lookup for notification
      prisma.friendship.findFirst.mockResolvedValue(null);
      prisma.friendRequest.findFirst.mockResolvedValue({
        id: 'existing-request',
      });

      await expect(
        service.sendRequest('sender-id', 'friend@test.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create a request and notify via gateway', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'receiver-id', email: 'friend@test.com' })
        .mockResolvedValueOnce({ id: 'sender-id', displayName: 'Sender' });
      prisma.friendship.findFirst.mockResolvedValue(null);
      prisma.friendRequest.findFirst.mockResolvedValue(null);
      prisma.friendRequest.create.mockResolvedValue({ id: 'new-request-id' });

      const result = await service.sendRequest('sender-id', 'friend@test.com');

      expect(result.message).toBe('Friend request sent successfully');
      expect(gateway.notifyFriendRequest).toHaveBeenCalledWith(
        'receiver-id',
        expect.objectContaining({ requestId: 'new-request-id' }),
      );
    });
  });

  describe('respondToRequest', () => {
    it('should throw NotFoundException if request does not exist', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.respondToRequest('user-id', 'request-id', 'accept'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the receiver', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({
        id: 'request-id',
        receiverId: 'someone-else',
        status: 'PENDING',
      });

      await expect(
        service.respondToRequest('user-id', 'request-id', 'accept'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if request is not pending', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({
        id: 'request-id',
        receiverId: 'user-id',
        status: 'ACCEPTED',
      });

      await expect(
        service.respondToRequest('user-id', 'request-id', 'accept'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call transaction when accepting a request', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({
        id: 'request-id',
        receiverId: 'user-id',
        senderId: 'sender-id',
        status: 'PENDING',
      });
      prisma.friendRequest.update.mockReturnValue('update-op');
      prisma.friendship.create.mockReturnValue('create-op');
      prisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.respondToRequest(
        'user-id',
        'request-id',
        'accept',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.message).toBe('Friend request accepted');
    });
  });
});
