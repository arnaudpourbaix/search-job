import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: { opportunity: { count: () => Promise.resolve(3) } },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('returns health status with opportunity count', async () => {
    await expect(appController.getHealth()).resolves.toEqual({
      status: 'ok',
      opportunities: 3,
    });
  });
});
