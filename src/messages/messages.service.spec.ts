import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MessagesService', () => {
  let service: MessagesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      conversationParticipant: {
        findUnique: jest.fn(),
      },
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      conversation: {
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  describe('sendMessage', () => {
    it('should throw ForbiddenException if sender is not a participant', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage('user-id', 'conversation-id', 'Hello!'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a message and bump conversation updatedAt if authorized', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        id: 'participant-id',
        userId: 'user-id',
        conversationId: 'conversation-id',
      });
      prisma.message.create.mockResolvedValue({
        id: 'message-id',
        content: 'Hello!',
        senderId: 'user-id',
      });

      const result = await service.sendMessage(
        'user-id',
        'conversation-id',
        'Hello!',
      );

      expect(result.id).toBe('message-id');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conversation-id' },
        data: { updatedAt: expect.any(Date) },
      });
    });
  });

  describe('getMessages', () => {
    it('should throw ForbiddenException if user is not a participant', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.getMessages('user-id', 'conversation-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return nextCursor as null when fewer messages than limit are returned', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.message.findMany.mockResolvedValue([
        { id: 'msg-1', content: 'Hi' },
        { id: 'msg-2', content: 'Hello' },
      ]);

      const result = await service.getMessages(
        'user-id',
        'conversation-id',
        undefined,
        20,
      );

      expect(result.messages).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    });

    it('should return nextCursor as last message id when full page is returned', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p1' });
      const fullPage = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
      }));
      prisma.message.findMany.mockResolvedValue(fullPage);

      const result = await service.getMessages(
        'user-id',
        'conversation-id',
        undefined,
        20,
      );

      expect(result.messages).toHaveLength(20);
      expect(result.nextCursor).toBe('msg-19');
    });
  });

  describe('markAsRead', () => {
    it('should throw ForbiddenException if user is not a participant', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.markAsRead('user-id', 'conversation-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should only mark messages NOT sent by the current user as read', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.message.updateMany.mockResolvedValue({ count: 3 });

      await service.markAsRead('user-id', 'conversation-id');

      expect(prisma.message.updateMany).toHaveBeenCalledWith({
        where: {
          conversationId: 'conversation-id',
          senderId: { not: 'user-id' },
          status: 'SENT',
        },
        data: { status: 'READ' },
      });
    });
  });
});