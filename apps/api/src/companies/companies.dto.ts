import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Chaîne nettoyée ; une chaîne vide devient null (champ effacé). */
const Trim = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const text = value.trim().replace(/[ \t]+/g, ' ');
    return text === '' ? null : text;
  });

const NotesTrim = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    return text === '' ? null : text;
  });

export class CreateCompanyDto {
  @Trim()
  @IsString({ message: "Le nom de l'entreprise est obligatoire" })
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @NotesTrim()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}
