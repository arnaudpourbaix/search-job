import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { InterviewStatus } from '../generated/prisma/enums.js';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'doit être au format AAAA-MM-JJ';
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_MESSAGE = "L'heure doit être au format HH:MM";

/** Chaîne nettoyée ; une chaîne vide devient null (champ effacé). */
const Trim = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    return text === '' ? null : text;
  });

/**
 * Champ facultatif en mise à jour, mais pas effaçable : absent = inchangé,
 * null ou vide = refusé (400). Contrairement à @IsOptional, null est validé.
 */
const Present = <T extends object>(field: keyof T & string) =>
  ValidateIf((o: T) => o[field] !== undefined);

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

  /** Étape ; par défaut, la première du pipeline. */
  @IsOptional()
  @IsInt()
  stageId?: number;

  /** Campagne ; par défaut, la campagne en cours la plus récente. */
  @IsOptional()
  @IsInt()
  campaignId?: number;

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

  /** Contacts de la piste, choisis dans le carnet (liste complète ; [] pour tous les retirer). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  contactIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];
}

export class UpdateOpportunityDto extends PartialType(
  OmitType(CreateOpportunityDto, ['stageId', 'campaignId'] as const),
) {
  /** L'étape peut changer, mais pas être effacée. */
  @Present<UpdateOpportunityDto>('stageId')
  @IsInt()
  stageId?: number;

  /** Déplacement vers une autre campagne (pas d'effacement possible). */
  @Present<UpdateOpportunityDto>('campaignId')
  @IsInt()
  campaignId?: number;
}

export class ListOpportunitiesQuery {
  /** Recherche libre (référence, poste, entreprise, intermédiaire, contact, techno). */
  @Trim()
  @IsOptional()
  @IsString()
  q?: string;

  /** Identifiants d'étapes séparés par des virgules. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.split(',').filter(Boolean).map(Number)
      : value,
  )
  @IsInt({ each: true })
  stageIds?: number[];

  /** Campagne ; absent = toutes les campagnes. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  campaignId?: number;

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

  /** Interlocuteur (carnet) ; il est ajouté aux contacts de la piste. */
  @IsOptional()
  @IsInt()
  contactId?: number | null;
}

export class UpdateInteractionDto {
  @Present<UpdateInteractionDto>('date')
  @Matches(DAY, { message: `date ${DAY_MESSAGE}` })
  date?: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  channel?: string | null;

  @Trim()
  @Present<UpdateInteractionDto>('summary')
  @IsString({ message: 'Le résumé ne peut pas être vide' })
  @MaxLength(10000)
  summary?: string;

  /** null pour retirer l'interlocuteur. */
  @IsOptional()
  @IsInt()
  contactId?: number | null;
}

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

export class UpdateActionDto {
  @Trim()
  @Present<UpdateActionDto>('label')
  @IsString({ message: "Le libellé de l'action ne peut pas être vide" })
  @MaxLength(500)
  label?: string;

  @IsOptional()
  @Matches(DAY, { message: `dueDate ${DAY_MESSAGE}` })
  dueDate?: string | null;

  @Present<UpdateActionDto>('done')
  @IsBoolean()
  done?: boolean;
}

export class CreateInterviewDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Le type de tour est obligatoire' })
  @MaxLength(100)
  type: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string | null;

  @IsOptional()
  @Matches(DAY, { message: `date ${DAY_MESSAGE}` })
  date?: string | null;

  @Trim()
  @IsOptional()
  @Matches(TIME, { message: TIME_MESSAGE })
  time?: string | null;

  @IsOptional()
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string | null;

  /** Interlocuteurs (carnet), liste complète ; ils rejoignent les contacts de la piste. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  contactIds?: number[];
}

export class UpdateInterviewDto extends PartialType(
  OmitType(CreateInterviewDto, ['type', 'status']),
) {
  @Trim()
  @Present<UpdateInterviewDto>('type')
  @IsString({ message: 'Le type de tour ne peut pas être vide' })
  @MaxLength(100)
  type?: string;

  @Present<UpdateInterviewDto>('status')
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;
}

export class ReorderInterviewsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  ids: number[];
}
