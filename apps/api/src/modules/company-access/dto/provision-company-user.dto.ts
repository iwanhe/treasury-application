import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';

const ASSIGNABLE_ROLES = [
  'REQUESTER',
  'TREASURY_MAKER',
  'TREASURY_CHECKER',
  'APPROVER',
  'ADMIN'
];

export class ProvisionCompanyUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  externalId!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  fullName!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(ASSIGNABLE_ROLES, { each: true })
  roles!: string[];
}
