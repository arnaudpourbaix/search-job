import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { UserId } from '../auth/auth.decorators.js';
import { NotificationsService } from './notifications.service.js';

class ReadBody {
  @IsBoolean()
  read!: boolean;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@UserId() userId: number) {
    return this.notifications.list(userId);
  }

  @Post('read-all')
  @HttpCode(204)
  markAllRead(@UserId() userId: number) {
    return this.notifications.markAllRead(userId);
  }

  @Patch(':id')
  @HttpCode(204)
  markRead(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReadBody,
  ) {
    return this.notifications.markRead(userId, id, body.read);
  }
}
