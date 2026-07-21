import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from '../messages/messages.gateway';

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  async sendRequest(senderId: string, receiverEmail: string) {
    const receiver = await this.prisma.user.findUnique({
      where: { email: receiverEmail },
    });

    if (!receiver) {
      throw new NotFoundException('No user found with this email');
    }

    if (receiver.id === senderId) {
      throw new BadRequestException('You cannot add yourself as a friend');
    }

    const existingFriendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userAId: senderId, userBId: receiver.id },
          { userAId: receiver.id, userBId: senderId },
        ],
      },
    });

    if (existingFriendship) {
      throw new BadRequestException('You are already friends');
    }

    const existingRequest = await this.prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId: receiver.id },
          { senderId: receiver.id, receiverId: senderId },
        ],
      },
    });

    if (existingRequest) {
      throw new BadRequestException('A friend request already exists');
    }

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, displayName: true, email: true },
    });

    const request = await this.prisma.friendRequest.create({
      data: {
        senderId,
        receiverId: receiver.id,
      },
    });

    this.messagesGateway.notifyFriendRequest(receiver.id, {
      requestId: request.id,
      sender,
    });

    return {
      message: 'Friend request sent successfully',
      requestId: request.id,
    };
  }

  async respondToRequest(
    userId: string,
    requestId: string,
    action: 'accept' | 'decline',
  ) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.receiverId !== userId) {
      throw new ForbiddenException('You cannot respond to this request');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'This request has already been responded to',
      );
    }

    if (action === 'decline') {
      await this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'DECLINED' },
      });
      return { message: 'Friend request declined' };
    }

    // Friendship and conversation are created together so an accepted
    // request always yields a chat both users can open.
    await this.prisma.$transaction([
      this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      }),
      this.prisma.friendship.create({
        data: {
          userAId: request.senderId,
          userBId: request.receiverId,
        },
      }),
      this.prisma.conversation.create({
        data: {
          participants: {
            create: [
              { userId: request.senderId },
              { userId: request.receiverId },
            ],
          },
        },
      }),
    ]);

    return { message: 'Friend request accepted' };
  }

  async getPendingRequests(userId: string) {
    return this.prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: {
          select: { id: true, email: true, displayName: true },
        },
        userB: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });

    return friendships.map((friendship) => {
      return friendship.userAId === userId
        ? friendship.userB
        : friendship.userA;
    });
  }
}
