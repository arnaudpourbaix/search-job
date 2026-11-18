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
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { StageKind } from '../generated/prisma/enums.js';
import { STAGE_COLORS, StagesService } from './stages.service.js';
import { UserId } from '../auth/auth.decorators.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

class CreateStageBody {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Le libellé de l'étape est obligatoire" })
  @MaxLength(50)
  label!: string;

  @IsOptional()
  @IsIn(STAGE_COLORS, { message: 'Couleur inconnue' })
  color?: string;

  @IsOptional()
  @IsEnum(StageKind)
  kind?: StageKind;
}

/** Absent = inchangé ; null ou vide refusé. */
class UpdateStageBody {
  @Transform(trim)
  @ValidateIf((o: UpdateStageBody) => o.label !== undefined)
  @IsString()
  @IsNotEmpty({ message: "Le libellé de l'étape est obligatoire" })
  @MaxLength(50)
  label?: string;

  @ValidateIf((o: UpdateStageBody) => o.color !== undefined)
  @IsIn(STAGE_COLORS, { message: 'Couleur inconnue' })
  color?: string;

  @ValidateIf((o: UpdateStageBody) => o.kind !== undefined)
  @IsEnum(StageKind)
  kind?: StageKind;
}

class OrderBody {
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  ids!: number[];
}

class RemoveQuery {
  /** Étape vers laquelle basculer les pistes de l'étape supprimée. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  replaceWith?: number;
}

@Controller('settings/stages')
export class StagesController {
  constructor(private readonly stages: StagesService) {}

  @Get()
  list(@UserId() userId: number) {
    return this.stages.list(userId);
  }

  @Post()
  add(@UserId() userId: number, @Body() body: CreateStageBody) {
    return this.stages.add(userId, body);
  }

  @Put('order')
  @HttpCode(204)
  reorder(@UserId() userId: number, @Body() body: OrderBody) {
    return this.stages.reorder(userId, body.ids);
  }

  @Patch(':id')
  update(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateStageBody,
  ) {
    return this.stages.update(userId, id, body);
  }

  @Delete(':id')
  remove(
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: RemoveQuery,
  ) {
    return this.stages.remove(userId, id, query.replaceWith);
  }
}
