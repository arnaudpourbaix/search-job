import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  /** Route publique : vérifie la base sans rien révéler des données. */
  async getHealth() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
