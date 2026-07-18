import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post(':conversationId')
  async send(
    @CurrentUser() user: { userId: string },
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(
      user.userId,
      conversationId,
      dto.content,
    );
  }

  @Get(':conversationId')
  async getMessages(
    @CurrentUser() user: { userId: string },
    @Param('conversationId') conversationId: string,
    @Query() query: GetMessagesDto,
  ) {
    return this.messagesService.getMessages(
      user.userId,
      conversationId,
      query.cursor,
      query.limit,
    );
  }

  @Patch(':conversationId/read')
  async markAsRead(
    @CurrentUser() user: { userId: string },
    @Param('conversationId') conversationId: string,
  ) {
    return this.messagesService.markAsRead(user.userId, conversationId);
  }
}
