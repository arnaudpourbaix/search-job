import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateCampaignDto, UpdateCampaignDto } from './campaigns.dto.js';
import { CampaignsService } from './campaigns.service.js';
import { UserId } from '../auth/auth.decorators.js';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(@UserId() userId: number) {
    return this.campaigns.list(userId);
  }

  @Post()
  create(@UserId() userId: number, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(userId, dto);
  }

  @Patch(':id')
  update(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaigns.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.campaigns.remove(userId, id);
  }
}
