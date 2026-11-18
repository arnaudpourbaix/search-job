import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** Chaîne nettoyée ; une chaîne vide devient null (champ effacé). */
const Trim = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const text = value.trim().replace(/[ \t]+/g, ' ');
    return text === '' ? null : text;
  });

/** Absent = inchangé ; null refusé. */
const Present = <T extends object>(field: keyof T & string) =>
  ValidateIf((o: T) => o[field] !== undefined);

export class CreateContactDto {
  @Trim()
  @IsString({ message: 'Le nom du contact est obligatoire' })
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  /** Fonction : recruteur, RH, lead dev… */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  /** Société (intermédiaire ou client), créée si inconnue ; null pour la retirer. */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string | null;

  @Trim()
  @IsOptional()
  @IsEmail({}, { message: 'Email invalide' })
  @MaxLength(200)
  email?: string | null;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @Trim()
  @IsOptional()
  @IsUrl({}, { message: 'Lien LinkedIn invalide' })
  @MaxLength(500)
  linkedin?: string | null;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

export class UpdateContactDto extends PartialType(
  OmitType(CreateContactDto, ['name'] as const),
) {
  @Trim()
  @Present<UpdateContactDto>('name')
  @IsString({ message: 'Le nom du contact est obligatoire' })
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;
}

export class ListContactsQuery {
  /** Recherche : nom, fonction, société, email, téléphone. */
  @Trim()
  @IsOptional()
  @IsString()
  q?: string;
}
