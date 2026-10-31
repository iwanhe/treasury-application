import { Module } from '@nestjs/common';
import { CompanyAccessService } from './company-access.service';
import { CompanyRolesGuard } from './company-roles.guard';

@Module({
  providers: [CompanyAccessService, CompanyRolesGuard],
  exports: [CompanyAccessService, CompanyRolesGuard]
})
export class CompanyAccessModule {}
