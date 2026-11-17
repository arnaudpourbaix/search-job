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
import { NotificationsService } from './notifications.service.js';

class ReadBody {
  @IsBoolean()
  read!: boolean;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list() {
    return this.notifications.list();
  }

  @Post('read-all')
  @HttpCode(204)
  markAllRead() {
    return this.notifications.markAllRead();
  }

  @Patch(':id')
  @HttpCode(204)
  markRead(@Param('id', ParseIntPipe) id: number, @Body() body: ReadBody) {
    return this.notifications.markRead(id, body.read);
  }
}
