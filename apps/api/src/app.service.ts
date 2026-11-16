import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    const opportunities = await this.prisma.opportunity.count();
    return { status: 'ok', opportunities };
  }
}
