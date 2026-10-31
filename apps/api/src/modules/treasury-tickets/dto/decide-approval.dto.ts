import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
export class DecideApprovalDto {
  @IsIn(['APPROVED', 'REJECTED', 'RETURNED']) decision!: 'APPROVED' | 'REJECTED' | 'RETURNED';
  @IsOptional() @IsString() @MaxLength(2000) comments?: string;
}
