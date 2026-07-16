import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  async create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversationsService.createConversation(
      user.userId,
      dto.friendId,
    );
  }

  @Get()
  async getAll(@CurrentUser() user: { userId: string }) {
    return this.conversationsService.getConversations(user.userId);
  }
}