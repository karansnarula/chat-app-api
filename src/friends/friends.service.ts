import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';


@Injectable()
export class FriendsService {
    constructor(private readonly prisma: PrismaService) { }

    async sendRequest(senderId: string, receiverEmail: string) {
        // Find the receiver by email
        const receiver = await this.prisma.user.findUnique({
            where: { email: receiverEmail },
        });

        if (!receiver) {
            throw new NotFoundException('No user found with this email');
        }

        // Can't send a request to yourself
        if (receiver.id === senderId) {
            throw new BadRequestException('You cannot add yourself as a friend');
        }

        // Check if already friends
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

        // Check if a request already exists (either direction)
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

        // Create the request
        const request = await this.prisma.friendRequest.create({
            data: {
                senderId,
                receiverId: receiver.id,
            },
        });

        return { message: 'Friend request sent successfully', requestId: request.id };
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

        // Only the receiver can respond to a request
        if (request.receiverId !== userId) {
            throw new ForbiddenException('You cannot respond to this request');
        }

        if (request.status !== 'PENDING') {
            throw new BadRequestException('This request has already been responded to');
        }

        if (action === 'decline') {
            await this.prisma.friendRequest.update({
                where: { id: requestId },
                data: { status: 'DECLINED' },
            });
            return { message: 'Friend request declined' };
        }

        // action === 'accept'
        // Use a transaction — both operations must succeed together
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

  // Map to return only the "other" person, not the current user
  return friendships.map((friendship) => {
    return friendship.userAId === userId
      ? friendship.userB
      : friendship.userA;
  });
}

}