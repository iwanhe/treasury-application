import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Call only with userId taken from a validated authentication principal,
 * never from a request body or query parameter.
 */
@Injectable()
export class CompanyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertMembership(userId: string, companyId: string, allowedRoles?: string[]) {
    const membership = await this.prisma.userCompanyRole.findFirst({
      where: {
        userId,
        companyId,
        user: { status: 'ACTIVE' },
        company: { status: 'ACTIVE' },
        ...(allowedRoles?.length ? { role: { code: { in: allowedRoles } } } : {})
      },
      select: { id: true, companyId: true, role: { select: { code: true } } }
    });

    if (!membership) throw new ForbiddenException('You do not have access to this company.');
    return membership;
  }

  async listCompaniesForUser(userId: string) {
    const memberships = await this.prisma.userCompanyRole.findMany({
      where: { userId, user: { status: 'ACTIVE' }, company: { status: 'ACTIVE' } },
      select: { company: { select: { id: true, code: true, name: true } }, role: { select: { code: true } } },
      orderBy: { company: { name: 'asc' } }
    });

    return memberships.map(({ company, role }) => ({ ...company, role: role.code }));
  }
}
