import { Module } from '@nestjs/common';
import { CompanyAccessService } from './company-access.service';

@Module({ providers: [CompanyAccessService], exports: [CompanyAccessService] })
export class CompanyAccessModule {}
