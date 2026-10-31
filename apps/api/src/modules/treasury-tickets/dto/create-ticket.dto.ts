import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RequestType, TicketPriority } from '@prisma/client';

export class CreateTicketDto {
  @IsEnum(RequestType)
  type!: RequestType;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description!: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}
