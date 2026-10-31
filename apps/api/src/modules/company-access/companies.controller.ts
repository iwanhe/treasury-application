import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { OidcJwtGuard } from '../auth/oidc-jwt.guard';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { CompanyAccessService } from './company-access.service';

@Controller('companies')
@UseGuards(OidcJwtGuard)
export class CompaniesController {
  constructor(private readonly companyAccess: CompanyAccessService) {}

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.companyAccess.listCompaniesForUser(user.userId);
  }
}
