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

    // Save to database (reusing our existing service logic!)
    const message = await this.messagesService.sendMessage(
      senderId,
      data.conversationId,
      data.content,
    );

    // Find the other participant to send them the real-time event
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
      include: { participants: true },
    });

    const otherParticipant = conversation?.participants.find(
      (p) => p.userId !== senderId,
    );

    if (otherParticipant) {
      const receiverSocketId = this.userSocketMap.get(otherParticipant.userId);

      if (receiverSocketId) {
        // Receiver is online — push the message to them in real-time
        this.server.to(receiverSocketId).emit('message:new', message);
      }
      // If receiverSocketId doesn't exist, they're offline —
      // this is where FCM push notification will come in later
    }

    // Also send back to the sender for confirmation
    return message;
  }
}