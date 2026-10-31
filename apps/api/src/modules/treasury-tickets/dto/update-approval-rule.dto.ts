import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, ValidateIf } from 'class-validator';
import { RequestType } from '@prisma/client';

export class UpdateApprovalRuleDto {
  @IsOptional() @IsEnum(RequestType) requestType?: RequestType;
  @IsOptional() @IsInt() @Min(1) @Max(20) sequence?: number;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currencyCode?: string;
  @IsOptional() @Matches(/^\d{1,16}(\.\d{1,2})?$/) minAmount?: string;
  @IsOptional() @Matches(/^\d{1,16}(\.\d{2})?$/) maxAmount?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() approverRoleCode?: string | null;
  @IsOptional() @IsUUID() approverUserId?: string | null;
}
