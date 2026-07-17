import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from '../fcm/fcm.service';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);
  private userSocketMap = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly messagesService: MessagesService,
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token as string;

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });

      const userId = payload.sub as string;
      this.userSocketMap.set(userId, client.id);
      client.data.userId = userId;

      this.logger.log(`User ${userId} connected with socket ${client.id}`);
    } catch (error) {
      this.logger.error('Connection rejected: invalid token');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId as string;
    if (userId) {
      this.userSocketMap.delete(userId);
      this.logger.log(`User ${userId} disconnected`);
    }
  }

  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    const senderId = client.data.userId as string;

    const message = await this.messagesService.sendMessage(
      senderId,
      data.conversationId,
      data.content,
    );

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
      include: { participants: { include: { user: true } } },
    });

    const otherParticipant = conversation?.participants.find(
      (p) => p.userId !== senderId,
    );

    if (otherParticipant) {
      const receiverSocketId = this.userSocketMap.get(otherParticipant.userId);

      if (receiverSocketId) {
        // Receiver is online — deliver in real-time
        this.server.to(receiverSocketId).emit('message:new', message);
      } else if (otherParticipant.user.fcmToken) {
        // Receiver is offline — send push notification instead
        await this.fcmService.sendPushNotification(
          otherParticipant.user.fcmToken,
          message.sender.displayName,
          data.content,
          { conversationId: data.conversationId },
        );
      }
    }

    return message;
  }

  notifyFriendRequest(
    receiverId: string,
    payload: { requestId: string; sender: any },
  ) {
    const receiverSocketId = this.userSocketMap.get(receiverId);

    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('friend:request', payload);
    }
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId as string;

    await this.messagesService.markAsRead(userId, data.conversationId);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
      include: { participants: true },
    });

    const otherParticipant = conversation?.participants.find(
      (p) => p.userId !== userId,
    );

    if (otherParticipant) {
      const senderSocketId = this.userSocketMap.get(otherParticipant.userId);

      if (senderSocketId) {
        this.server.to(senderSocketId).emit('message:read', {
          conversationId: data.conversationId,
          readBy: userId,
        });
      }
    }
  }
}