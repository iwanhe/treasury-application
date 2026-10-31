import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TicketStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class ListTicketsDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
