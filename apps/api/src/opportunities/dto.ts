import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Stage } from '../generated/prisma/enums.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'doit être au format AAAA-MM-JJ';

/** Chaîne nettoyée ; une chaîne vide devient null (champ effacé). */
const Trim = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    return text === '' ? null : text;
  });

export class ContactInput {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @Trim()
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;
}

export class CreateOpportunityDto {
  /** Référence de l'annonce (facultative), ex. « BPCE_INFO01289 ». */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string | null;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  platform?: string | null;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contractType?: string | null;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  remoteDays?: number | null;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  duration?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  tjmMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  tjmMax?: number | null;

  @IsOptional()
  @IsEnum(Stage)
  stage?: Stage;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string | null;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string | null;

  /** Entreprise où l'on travaillerait, créée si inconnue. */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string | null;

  /** Intermédiaire éventuel (apporteur d'affaires, portage, cabinet…), créé si inconnu. */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  intermediaryName?: string | null;

  /** Valeur de la liste « INTERMEDIARY_TYPE ». */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  intermediaryType?: string | null;

  /** Contact (rattaché à l'intermédiaire s'il y en a un) ; null pour le retirer. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactInput)
  contact?: ContactInput | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
}

export class UpdateOpportunityDto extends PartialType(CreateOpportunityDto) {}

export class ListOpportunitiesQuery {
  /** Recherche libre (référence, poste, entreprise, intermédiaire, contact, techno). */
  @Trim()
  @IsOptional()
  @IsString()
  q?: string;

  /** Étapes séparées par des virgules. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsEnum(Stage, { each: true })
  stages?: Stage[];

  /** true : exclut les pistes clôturées. */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  active?: boolean;
}

export class CreateInteractionDto {
  @Matches(DAY, { message: `date ${DAY_MESSAGE}` })
  date: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  channel?: string | null;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  summary: string;
}

export class UpdateInteractionDto extends PartialType(CreateInteractionDto) {}

export class CreateActionDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  label: string;

  @IsOptional()
  @Matches(DAY, { message: `dueDate ${DAY_MESSAGE}` })
  dueDate?: string | null;
}

export class UpdateActionDto extends PartialType(CreateActionDto) {
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
