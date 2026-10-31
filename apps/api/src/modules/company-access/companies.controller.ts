import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { OidcJwtGuard } from '../auth/oidc-jwt.guard';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { CompanyAccessService } from './company-access.service';
import { CompanyRolesGuard } from './company-roles.guard';
import { RequireCompanyRoles } from './company-roles.decorator';
import { ProvisionCompanyUserDto } from './dto/provision-company-user.dto';

@Controller('companies')
@UseGuards(OidcJwtGuard)
export class CompaniesController {
  constructor(private readonly companyAccess: CompanyAccessService) {}

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.companyAccess.listCompaniesForUser(user.userId);
  }

  @Get(':companyId/users')
  @UseGuards(CompanyRolesGuard)
  @RequireCompanyRoles('ADMIN')
  listCompanyUsers(@Param('companyId') companyId: string) {
    return this.companyAccess.listCompanyUsers(companyId);
  }

  @Post(':companyId/users')
  @UseGuards(CompanyRolesGuard)
  @RequireCompanyRoles('ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  provisionCompanyUser(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('companyId') companyId: string,
    @Body() dto: ProvisionCompanyUserDto
  ) {
    return this.companyAccess.provisionCompanyUser(user.userId, companyId, dto);
  }
}
