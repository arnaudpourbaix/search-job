import { Module } from '@nestjs/common';
import { ListsController } from './lists.controller.js';
import { ListsService } from './lists.service.js';
import { StagesController } from './stages.controller.js';
import { StagesService } from './stages.service.js';

@Module({
  controllers: [ListsController, StagesController],
  providers: [ListsService, StagesService],
})
export class SettingsModule {}
