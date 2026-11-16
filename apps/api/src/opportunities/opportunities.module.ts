import { Module } from '@nestjs/common';
import {
  ActionsController,
  InteractionsController,
  OpportunitiesController,
} from './opportunities.controller.js';
import { JournalService } from './journal.service.js';
import { OpportunitiesService } from './opportunities.service.js';

@Module({
  controllers: [
    OpportunitiesController,
    InteractionsController,
    ActionsController,
  ],
  providers: [OpportunitiesService, JournalService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
