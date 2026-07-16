import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SendRequestDto } from './dto/send-request.dto';
import { RespondRequestDto } from './dto/respond-request.dto';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
    constructor(private readonly friendsService: FriendsService) { }

    @Post('request')
    async sendRequest(
        @CurrentUser() user: { userId: string },
        @Body() dto: SendRequestDto,
    ) {
        return this.friendsService.sendRequest(user.userId, dto.email);
    }

    @Post('request/:id/respond')
    async respondToRequest(
        @CurrentUser() user: { userId: string },
        @Param('id') requestId: string,
        @Body() dto: RespondRequestDto,
    ) {
        return this.friendsService.respondToRequest(
            user.userId,
            requestId,
            dto.action,
        );
    }

    @Get('requests')
    async getPendingRequests(@CurrentUser() user: { userId: string }) {
        return this.friendsService.getPendingRequests(user.userId);
    }

    @Get()
    async getFriends(@CurrentUser() user: { userId: string }) {
        return this.friendsService.getFriends(user.userId);
    }
}