import { Controller, Get, Module, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { DashboardService } from './dashboard.service.js';

class DashboardQuery {
  /** Absent = toutes les campagnes. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  campaignId?: number;
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@Query() query: DashboardQuery) {
    return this.dashboard.get(query.campaignId);
  }
}

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
