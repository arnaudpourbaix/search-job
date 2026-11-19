import { Body, Controller, HttpCode, Patch } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { UserId } from '../auth/auth.decorators.js';
import { MAX_STALE_DAYS, MIN_STALE_DAYS } from '../common/follow-up.js';
import { PrismaService } from '../prisma/prisma.service.js';

class UpdatePreferencesBody {
  @IsInt({ message: 'Le délai de relance doit être un nombre entier de jours' })
  @Min(MIN_STALE_DAYS, {
    message: `Le délai de relance est d'au moins ${MIN_STALE_DAYS} jour`,
  })
  @Max(MAX_STALE_DAYS, {
    message: `Le délai de relance est d'au plus ${MAX_STALE_DAYS} jours`,
  })
  staleDays!: number;
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
      data: { staleDays: body.staleDays },
    });
  }
}
