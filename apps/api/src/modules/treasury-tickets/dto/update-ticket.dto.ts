import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { RequestType, TicketPriority } from '@prisma/client';
export class UpdateTicketDto {
  @IsOptional() @IsEnum(RequestType) type?: RequestType;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(10000) description?: string;
  @IsOptional() @Matches(/^\d{1,16}(\.\d{1,2})?$/) amount?: string;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currencyCode?: string;
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
}
