import {
  HttpException,
  HttpStatus,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimit, RateLimitGuard } from './rate-limit.js';

class LimitedController {
  @RateLimit({ limit: 2, ttl: 60_000 })
  login(this: void) {}

  other(this: void) {}
}

function contextFor(
  handler: () => void,
  ip = '1.2.3.4',
): { context: ExecutionContext; setHeader: ReturnType<typeof vi.fn> } {
  const setHeader = vi.fn();
  const context = {
    getType: () => 'http',
    getClass: () => LimitedController,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;
  return { context, setHeader };
}

describe('RateLimitGuard', () => {
  const proto = LimitedController.prototype;

  it('refuse au-delà de la limite avec 429 et Retry-After', () => {
    const guard = new RateLimitGuard(new Reflector());
    const { context, setHeader } = contextFor(proto.login);
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    try {
      guard.canActivate(context);
      expect.unreachable();
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });

  it('compte séparément par adresse IP et par route', () => {
    const guard = new RateLimitGuard(new Reflector());
    guard.canActivate(contextFor(proto.login).context);
    guard.canActivate(contextFor(proto.login).context);
    expect(guard.canActivate(contextFor(proto.login, '5.6.7.8').context)).toBe(
      true,
    );
    // Sans @RateLimit, la limite large par défaut s'applique.
    expect(guard.canActivate(contextFor(proto.other).context)).toBe(true);
  });

  it('rouvre une fenêtre une fois la précédente expirée', () => {
    vi.useFakeTimers();
    try {
      const guard = new RateLimitGuard(new Reflector());
      const { context } = contextFor(proto.login);
      guard.canActivate(context);
      guard.canActivate(context);
      vi.advanceTimersByTime(60_001);
      expect(guard.canActivate(context)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
