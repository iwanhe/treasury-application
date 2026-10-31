import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** userId must come from a validated authentication principal, never request input. */
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
    const rows = await this.prisma.userCompanyRole.findMany({
      where: { userId, user: { status: 'ACTIVE' }, company: { status: 'ACTIVE' } },
      select: { company: { select: { id: true, code: true, name: true } }, role: { select: { code: true } } },
      orderBy: { company: { name: 'asc' } }
    });
    return rows.map(({ company, role }) => ({ ...company, role: role.code }));
  }
}
