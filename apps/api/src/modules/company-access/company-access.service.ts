import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProvisionCompanyUserDto } from './dto/provision-company-user.dto';

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
      select: {
        company: { select: { id: true, code: true, name: true } },
        role: { select: { code: true } }
      },
      orderBy: { company: { name: 'asc' } }
    });

    const companies = new Map<string, {
      id: string;
      code: string;
      name: string;
      roles: string[];
    }>();
    for (const row of rows) {
      const current = companies.get(row.company.id) ?? { ...row.company, roles: [] };
      current.roles.push(row.role.code);
      companies.set(row.company.id, current);
    }
    return [...companies.values()].map(company => ({
      ...company,
      roles: [...new Set(company.roles)].sort()
    }));
  }

  async listCompanyUsers(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, status: 'ACTIVE' },
      select: { id: true }
    });
    if (!company) throw new NotFoundException('Company not found.');

    const memberships = await this.prisma.userCompanyRole.findMany({
      where: { companyId, user: { status: 'ACTIVE' } },
      select: {
        user: { select: { id: true, email: true, fullName: true, externalId: true } },
        role: { select: { code: true } }
      },
      orderBy: { user: { fullName: 'asc' } }
    });

    const users = new Map<string, {
      id: string;
      email: string;
      fullName: string;
      externalId: string | null;
      roles: string[];
    }>();
    for (const membership of memberships) {
      const user = users.get(membership.user.id) ?? {
        ...membership.user,
        roles: []
      };
      user.roles.push(membership.role.code);
      users.set(user.id, user);
    }
    return [...users.values()].map(user => ({
      ...user,
      roles: [...new Set(user.roles)].sort()
    }));
  }

  async provisionCompanyUser(actorId: string, companyId: string, dto: ProvisionCompanyUserDto) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, status: 'ACTIVE' },
      select: { id: true, code: true }
    });
    if (!company) throw new NotFoundException('Company not found.');

    const roles = await this.prisma.role.findMany({
      where: { code: { in: dto.roles } },
      select: { id: true, code: true }
    });
    if (roles.length !== new Set(dto.roles).size) {
      throw new NotFoundException('One or more requested roles do not exist.');
    }

    return this.prisma.$transaction(async tx => {
      const existingBySubject = await tx.user.findUnique({
        where: { externalId: dto.externalId },
        select: { id: true, email: true }
      });
      const existingByEmail = await tx.user.findUnique({
        where: { email: dto.email },
        select: { id: true }
      });
      if (existingByEmail && existingByEmail.id !== existingBySubject?.id) {
        throw new ConflictException('Email is already assigned to another application identity.');
      }

      const user = existingBySubject
        ? await tx.user.update({
            where: { id: existingBySubject.id },
            data: { email: dto.email, fullName: dto.fullName, status: 'ACTIVE' },
            select: { id: true, email: true, fullName: true, externalId: true }
          })
        : await tx.user.create({
            data: {
              externalId: dto.externalId,
              email: dto.email,
              fullName: dto.fullName,
              status: 'ACTIVE'
            },
            select: { id: true, email: true, fullName: true, externalId: true }
          });

      for (const role of roles) {
        await tx.userCompanyRole.upsert({
          where: {
            userId_companyId_roleId: {
              userId: user.id,
              companyId,
              roleId: role.id
            }
          },
          update: {},
          create: { userId: user.id, companyId, roleId: role.id }
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          companyCode: company.code,
          action: 'CREATE',
          entityType: 'USER_COMPANY_ROLE',
          entityId: user.id,
          afterData: {
            email: user.email,
            externalId: user.externalId,
            roles: roles.map(role => role.code).sort()
          }
        }
      });

      return {
        ...user,
        companyId,
        roles: roles.map(role => role.code).sort()
      };
    });
  }
}
