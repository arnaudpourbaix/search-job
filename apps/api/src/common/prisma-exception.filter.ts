import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../generated/prisma/client.js';

/** Traduit les erreurs Prisma connues en réponses HTTP. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    switch (error.code) {
      case 'P2002':
        return super.catch(
          new ConflictException('Cette valeur existe déjà (doit être unique).'),
          host,
        );
      case 'P2025':
        return super.catch(new NotFoundException('Élément introuvable.'), host);
      default:
        return super.catch(error, host);
    }
  }
}
