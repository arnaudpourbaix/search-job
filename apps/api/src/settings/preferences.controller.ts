import { Body, Controller, HttpCode, Patch } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UserId } from '../auth/auth.decorators.js';
import {
  MAX_SILENCE_DAYS,
  MAX_STALE_DAYS,
  MIN_SILENCE_DAYS,
  MIN_STALE_DAYS,
} from '../common/follow-up.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Réglages modifiés ; un champ absent reste inchangé. */
class UpdatePreferencesBody {
  @IsOptional()
  @IsInt({ message: 'Le délai de relance doit être un nombre entier de jours' })
  @Min(MIN_STALE_DAYS, {
    message: `Le délai de relance est d'au moins ${MIN_STALE_DAYS} jour`,
  })
  @Max(MAX_STALE_DAYS, {
    message: `Le délai de relance est d'au plus ${MAX_STALE_DAYS} jours`,
  })
  staleDays?: number;

  @IsOptional()
  @IsInt({ message: 'Le délai de silence doit être un nombre entier de jours' })
  @Min(MIN_SILENCE_DAYS, {
    message: `Le délai de silence est d'au moins ${MIN_SILENCE_DAYS} jours`,
  })
  @Max(MAX_SILENCE_DAYS, {
    message: `Le délai de silence est d'au plus ${MAX_SILENCE_DAYS} jours`,
  })
  silenceDays?: number;

  /** Chaîne vide ou null : adresse effacée. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().replace(/\s+/g, ' ') || null
      : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(300)
  homeAddress?: string | null;
}

/** Réglages du compte ; ils sont lus avec l'utilisateur connecté (/auth/me). */
@Controller('settings/preferences')
export class PreferencesController {
  constructor(private readonly prisma: PrismaService) {}

  @Patch()
  @HttpCode(204)
  async update(@UserId() userId: number, @Body() body: UpdatePreferencesBody) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        staleDays: body.staleDays,
        silenceDays: body.silenceDays,
        homeAddress: body.homeAddress,
      },
    });
  }
}
