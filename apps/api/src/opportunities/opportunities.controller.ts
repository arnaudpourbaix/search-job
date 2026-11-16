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
  Query,
} from '@nestjs/common';
import {
  CreateActionDto,
  CreateInteractionDto,
  CreateOpportunityDto,
  ListOpportunitiesQuery,
  UpdateActionDto,
  UpdateInteractionDto,
  UpdateOpportunityDto,
} from './dto.js';
import { JournalService } from './journal.service.js';
import { OpportunitiesService } from './opportunities.service.js';

@Controller('opportunities')
export class OpportunitiesController {
  constructor(
    private readonly opportunities: OpportunitiesService,
    private readonly journal: JournalService,
  ) {}

  @Get()
  list(@Query() query: ListOpportunitiesQuery) {
    return this.opportunities.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.opportunities.get(id);
  }

  @Post()
  create(@Body() dto: CreateOpportunityDto) {
    return this.opportunities.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunities.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.opportunities.remove(id);
  }

  /** Ajoute un échange au journal et renvoie la piste à jour. */
  @Post(':id/interactions')
  async addInteraction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateInteractionDto,
  ) {
    await this.journal.addInteraction(id, dto);
    return this.opportunities.get(id);
  }

  /** Ajoute une action et renvoie la piste à jour. */
  @Post(':id/actions')
  async addAction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateActionDto,
  ) {
    await this.journal.addAction(id, dto);
    return this.opportunities.get(id);
  }
}

@Controller('interactions')
export class InteractionsController {
  constructor(private readonly journal: JournalService) {}

  @Patch(':id')
  @HttpCode(204)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInteractionDto,
  ) {
    return this.journal.updateInteraction(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.journal.removeInteraction(id);
  }
}

@Controller('actions')
export class ActionsController {
  constructor(private readonly journal: JournalService) {}

  @Patch(':id')
  @HttpCode(204)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateActionDto) {
    return this.journal.updateAction(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.journal.removeAction(id);
  }
}
