import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(userId: string, friendId: string) {
    // Verify they are actually friends
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userAId: userId, userBId: friendId },
          { userAId: friendId, userBId: userId },
        ],
      },
    });

    if (!friendship) {
      throw new BadRequestException('You can only chat with friends');
    }

    // Check if a conversation already exists between these two
    const existing = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: friendId } } },
        ],
      },
    });

    if (existing) {
      return existing;
    }

    // Create new conversation with both participants
    return this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId }, { userId: friendId }],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
      },
    });
  }

  async getConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Shape the response: show the OTHER participant + last message
    return conversations.map((conversation) => {
      const otherParticipant = conversation.participants.find(
        (p) => p.userId !== userId,
      );

      return {
        id: conversation.id,
        otherUser: otherParticipant?.user,
        lastMessage: conversation.messages[0] || null,
      };
    });
  }
}
