import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CompanyAccessService } from './company-access.service';
import { COMPANY_ROLES_KEY } from './company-roles.decorator';

@Injectable()
export class CompanyRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly companyAccess: CompanyAccessService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      COMPANY_ROLES_KEY,
      [context.getHandler(), context.getClass()]
    ) ?? [];
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & {
      params: { companyId?: string };
    }>();
    const companyId = request.params.companyId;

    if (!request.user || !companyId) {
      throw new ForbiddenException('Authenticated user and company context are required.');
    }
    if (requiredRoles.length === 0) return true;

    await this.companyAccess.assertMembership(request.user.userId, companyId, requiredRoles);
    return true;
  }
}
