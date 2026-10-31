import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { RequestType, TicketPriority } from '@prisma/client';
export class CreateTicketDto {
  @IsEnum(RequestType) type!: RequestType;
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @MinLength(1) @MaxLength(10000) description!: string;
  @Matches(/^\d{1,16}(\.\d{1,2})?$/) amount!: string;
  @Matches(/^[A-Z]{3}$/) currencyCode!: string;
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
}
