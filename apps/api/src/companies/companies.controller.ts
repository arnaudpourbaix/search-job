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
import { UserId } from '../auth/auth.decorators.js';
import { CreateCompanyDto, UpdateCompanyDto } from './companies.dto.js';
import { CompaniesService } from './companies.service.js';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  /** Toutes les entreprises, avec leurs contacts et leurs pistes. */
  @Get()
  list(@UserId() userId: number) {
    return this.companies.list(userId);
  }

  @Post()
  create(@UserId() userId: number, @Body() dto: CreateCompanyDto) {
    return this.companies.create(userId, dto);
  }

  @Patch(':id')
  update(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companies.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.companies.remove(userId, id);
  }
}
