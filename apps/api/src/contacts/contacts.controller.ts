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
  CreateContactDto,
  ListContactsQuery,
  UpdateContactDto,
} from './contacts.dto.js';
import { ContactsService } from './contacts.service.js';
import { UserId } from '../auth/auth.decorators.js';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@UserId() userId: number, @Query() query: ListContactsQuery) {
    return this.contacts.list(userId, query);
  }

  @Post()
  create(@UserId() userId: number, @Body() dto: CreateContactDto) {
    return this.contacts.create(userId, dto);
  }

  @Patch(':id')
  update(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contacts.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@UserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.contacts.remove(userId, id);
  }
}
