import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        userId_conversationId: { userId, conversationId },
      },
    });

    if (!participant) {
      throw new ForbiddenException('You are not part of this conversation');
    }
  }

  async sendMessage(senderId: string, conversationId: string, content: string) {
    await this.verifyParticipant(senderId, conversationId);

    const message = await this.prisma.message.create({
      data: {
        content,
        senderId,
        conversationId,
      },
      include: {
        sender: {
          select: { id: true, displayName: true },
        },
      },
    });

    // Bump conversation's updatedAt so it sorts to top of the list
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getMessages(
    userId: string,
    conversationId: string,
    cursor?: string,
    limit = 20,
  ) {
    await this.verifyParticipant(userId, conversationId);

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // skip the cursor item itself
      }),
      include: {
        sender: {
          select: { id: true, displayName: true },
        },
      },
    });

    return {
      messages,
      nextCursor:
        messages.length === limit ? messages[messages.length - 1].id : null,
    };
  }

  async markAsRead(userId: string, conversationId: string) {
    await this.verifyParticipant(userId, conversationId);

    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId }, // only mark OTHER people's messages as read
        status: 'SENT',
      },
      data: { status: 'READ' },
    });

    return { message: 'Messages marked as read' };
  }
}
