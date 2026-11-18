import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'node:path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CampaignsModule } from './campaigns/campaigns.module.js';
import { ContactsModule } from './contacts/contacts.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OpportunitiesModule } from './opportunities/opportunities.module.js';
import { API_ROOT } from './paths.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReferenceModule } from './reference/reference.module.js';
import { SettingsModule } from './settings/settings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(API_ROOT, '.env'),
    }),
    PrismaModule,
    OpportunitiesModule,
    ReferenceModule,
    SettingsModule,
    ScheduleModule.forRoot(),
    NotificationsModule,
    CampaignsModule,
    ContactsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
