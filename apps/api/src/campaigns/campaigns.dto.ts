import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'doit être au format AAAA-MM-JJ';

const Trim = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const text = value.trim().replace(/[ \t]+/g, ' ');
    return text === '' ? null : text;
  });

/** Absent = inchangé ; null refusé. */
const Present = <T extends object>(field: keyof T & string) =>
  ValidateIf((o: T) => o[field] !== undefined);

export class CreateCampaignDto {
  @Trim()
  @IsString({ message: 'Le nom de la campagne est obligatoire' })
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  /** Objectif : type de poste, TJM visé, date de démarrage… */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  goal?: string | null;

  /** Par défaut : aujourd'hui. */
  @IsOptional()
  @Matches(DAY, { message: `startDate ${DAY_MESSAGE}` })
  startDate?: string;

  /** Clôture en même temps les campagnes en cours (fin = veille du début). */
  @IsOptional()
  @IsBoolean()
  closeOthers?: boolean;
}

export class UpdateCampaignDto {
  @Trim()
  @Present<UpdateCampaignDto>('name')
  @IsString({ message: 'Le nom de la campagne est obligatoire' })
  @MaxLength(100)
  name?: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  goal?: string | null;

  @Present<UpdateCampaignDto>('startDate')
  @Matches(DAY, { message: `startDate ${DAY_MESSAGE}` })
  startDate?: string;

  /** Date de clôture ; null pour rouvrir la campagne. */
  @IsOptional()
  @Matches(DAY, { message: `endDate ${DAY_MESSAGE}` })
  endDate?: string | null;
}
