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
  Put,
  Query,
} from '@nestjs/common';
import {
  CreateActionDto,
  CreateInteractionDto,
  CreateInterviewDto,
  CreateOpportunityDto,
  ListOpportunitiesQuery,
  ReorderInterviewsDto,
  UpdateActionDto,
  UpdateInteractionDto,
  UpdateInterviewDto,
  UpdateOpportunityDto,
} from './dto.js';
import { UserId } from '../auth/auth.decorators.js';
import { InterviewsService } from './interviews.service.js';
import { JournalService } from './journal.service.js';
import { OpportunitiesService } from './opportunities.service.js';

@Controller('opportunities')
export class OpportunitiesController {
  constructor(
    private readonly opportunities: OpportunitiesService,
    private readonly journal: JournalService,
    private readonly interviews: InterviewsService,
  ) {}

  @Get()
  list(@UserId() userId: number, @Query() query: ListOpportunitiesQuery) {
    return this.opportunities.list(userId, query);
  }

  @Get(':id')
  get(@UserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.opportunities.get(userId, id);
  }

  @Post()
  create(@UserId() userId: number, @Body() dto: CreateOpportunityDto) {
    return this.opportunities.create(userId, dto);
  }

  @Patch(':id')
  update(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunities.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.opportunities.remove(userId, id);
  }

  /** Reporte la relance de la piste (ou annule le report). */
  /** Ajoute un échange au journal et renvoie la piste à jour. */
  @Post(':id/interactions')
  async addInteraction(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateInteractionDto,
  ) {
    await this.journal.addInteraction(userId, id, dto);
    return this.opportunities.get(userId, id);
  }

  /** Ajoute une action et renvoie la piste à jour. */
  @Post(':id/actions')
  async addAction(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateActionDto,
  ) {
    await this.journal.addAction(userId, id, dto);
    return this.opportunities.get(userId, id);
  }

  /** Ajoute un tour au processus de recrutement et renvoie la piste à jour. */
  @Post(':id/interviews')
  async addInterview(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateInterviewDto,
  ) {
    await this.interviews.add(userId, id, dto);
    return this.opportunities.get(userId, id);
  }

  @Put(':id/interviews/order')
  @HttpCode(204)
  reorderInterviews(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() { ids }: ReorderInterviewsDto,
  ) {
    return this.interviews.reorder(userId, id, ids);
  }
}

@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Patch(':id')
  @HttpCode(204)
  update(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInterviewDto,
  ) {
    return this.interviews.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.interviews.remove(userId, id);
  }
}

@Controller('interactions')
export class InteractionsController {
  constructor(private readonly journal: JournalService) {}

  @Patch(':id')
  @HttpCode(204)
  update(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInteractionDto,
  ) {
    return this.journal.updateInteraction(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.journal.removeInteraction(userId, id);
  }
}

@Controller('actions')
export class ActionsController {
  constructor(private readonly journal: JournalService) {}

  @Patch(':id')
  @HttpCode(204)
  update(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActionDto,
  ) {
    return this.journal.updateAction(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.journal.removeAction(userId, id);
  }
}
