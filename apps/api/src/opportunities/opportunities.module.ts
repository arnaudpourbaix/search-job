import { Module } from '@nestjs/common';
import {
  ActionsController,
  InteractionsController,
  InterviewsController,
  OpportunitiesController,
} from './opportunities.controller.js';
import { InterviewsService } from './interviews.service.js';
import { JournalService } from './journal.service.js';
import { OpportunitiesService } from './opportunities.service.js';

@Module({
  controllers: [
    OpportunitiesController,
    InteractionsController,
    ActionsController,
    InterviewsController,
  ],
  providers: [OpportunitiesService, JournalService, InterviewsService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
