import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthConfig } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { RateLimitGuard } from './rate-limit.js';
import { SessionsService } from './sessions.service.js';
import { UsersService } from './users.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthConfig,
    SessionsService,
    UsersService,
    // Limite large pour l'usage normal ; la connexion a sa propre limite, plus stricte.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    // Toutes les routes exigent une session, sauf @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthConfig, SessionsService, UsersService],
})
export class AuthModule {}
