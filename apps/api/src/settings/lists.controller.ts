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
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  LIST_CATEGORIES,
  ListsService,
  type ListCategory,
} from './lists.service.js';
import { UserId } from '../auth/auth.decorators.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

class CategoryParam {
  @IsIn(LIST_CATEGORIES, { message: 'Liste inconnue' })
  category: ListCategory;
}

class ValueBody {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La valeur ne peut pas être vide' })
  @MaxLength(100)
  value: string;
}

class OrderBody {
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  ids: number[];
}

class RemoveQuery {
  /** Valeur de la liste qui remplace celle supprimée dans les pistes / échanges. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  replaceWith?: string;
}

/** Paramétrage des listes déroulantes. */
@Controller('settings/lists')
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Get()
  getAll(@UserId() userId: number) {
    return this.lists.getAll(userId);
  }

  @Post(':category')
  add(
    @UserId() userId: number,
    @Param() { category }: CategoryParam,
    @Body() { value }: ValueBody,
  ) {
    return this.lists.add(userId, category, value);
  }

  @Put(':category/order')
  @HttpCode(204)
  reorder(
    @UserId() userId: number,
    @Param() { category }: CategoryParam,
    @Body() { ids }: OrderBody,
  ) {
    return this.lists.reorder(userId, category, ids);
  }

  @Patch('items/:id')
  rename(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() { value }: ValueBody,
  ) {
    return this.lists.rename(userId, id, value);
  }

  @Delete('items/:id')
  remove(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() { replaceWith }: RemoveQuery,
  ) {
    return this.lists.remove(userId, id, replaceWith);
  }
}
