import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthConfig } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { SessionsService } from './sessions.service.js';
import { UsersService } from './users.service.js';

@Global()
@Module({
  imports: [
    // Limite large pour l'usage normal ; la connexion a sa propre limite, plus stricte.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthConfig,
    SessionsService,
    UsersService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Toutes les routes exigent une session, sauf @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthConfig, SessionsService, UsersService],
})
export class AuthModule {}
