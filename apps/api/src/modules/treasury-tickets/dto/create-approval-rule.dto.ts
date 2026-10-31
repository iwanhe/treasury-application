import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, ValidateIf } from 'class-validator';
import { RequestType } from '@prisma/client';
export class CreateApprovalRuleDto {
  @IsEnum(RequestType) requestType!: RequestType;
  @IsInt() @Min(1) @Max(20) sequence!: number;
  @Matches(/^[A-Z]{3}$/) currencyCode!: string;
  @Matches(/^\d{1,16}(\.\d{1,2})?$/) minAmount!: string;
  @IsOptional() @Matches(/^\d{1,16}(\.\d{1,2})?$/) maxAmount?: string;
  @ValidateIf(o => o.approverUserId === undefined) @IsString() approverRoleCode?: string;
  @ValidateIf(o => o.approverRoleCode === undefined) @IsUUID() approverUserId?: string;
}
