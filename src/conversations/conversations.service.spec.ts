import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      friendship: { findFirst: jest.fn() },
      conversation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  describe('createConversation', () => {
    it('should throw BadRequestException when users are not friends', async () => {
      prisma.friendship.findFirst.mockResolvedValue(null);

      await expect(
        service.createConversation('user-id', 'stranger-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return the existing conversation instead of creating a duplicate', async () => {
      prisma.friendship.findFirst.mockResolvedValue({ id: 'friendship-id' });
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'existing-conversation',
      });

      const result = await service.createConversation('user-id', 'friend-id');

      expect(result).toEqual({ id: 'existing-conversation' });
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });
  });

  describe('getConversations', () => {
    it('should expose the other participant, last message, and unread count', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conversation-id',
          participants: [
            { userId: 'user-id', user: { id: 'user-id' } },
            { userId: 'friend-id', user: { id: 'friend-id' } },
          ],
          messages: [{ id: 'message-id', content: 'Hello!' }],
          _count: { messages: 3 },
        },
      ]);

      const result = await service.getConversations('user-id');

      expect(result).toEqual([
        {
          id: 'conversation-id',
          otherUser: { id: 'friend-id' },
          lastMessage: { id: 'message-id', content: 'Hello!' },
          unreadCount: 3,
        },
      ]);
    });

    it('should count only unread messages sent by the other participant', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);

      await service.getConversations('user-id');

      const query = prisma.conversation.findMany.mock.calls[0][0];
      expect(query.include._count.select.messages.where).toEqual({
        senderId: { not: 'user-id' },
        status: 'SENT',
      });
    });
  });
});
