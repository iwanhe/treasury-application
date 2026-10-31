import { Prisma } from '@prisma/client';
export type CandidateApprovalRule = {
  id: string; companyId: string | null; sequence: number; currencyCode: string;
  minAmount: Prisma.Decimal; maxAmount: Prisma.Decimal | null;
};
export function selectApplicableApprovalRules(
  rules: CandidateApprovalRule[], companyId: string, currencyCode: string, amount: string
): CandidateApprovalRule[] {
  const value = new Prisma.Decimal(amount);
  const matches = rules.filter(rule =>
    rule.currencyCode.trim() === currencyCode &&
    value.greaterThanOrEqualTo(rule.minAmount) &&
    (rule.maxAmount === null || value.lessThanOrEqualTo(rule.maxAmount))
  );
  const companyRules = matches.filter(rule => rule.companyId === companyId);
  const selected = companyRules.length ? companyRules : matches.filter(rule => rule.companyId === null);
  selected.sort((a, b) => a.sequence - b.sequence);
  if (!selected.length) return [];
  const sequences = selected.map(rule => rule.sequence);
  if (new Set(sequences).size !== sequences.length) throw new Error('Approval rules contain duplicate sequence numbers.');
  if (sequences.some((sequence, index) => sequence !== index + 1)) {
    throw new Error('Approval rule sequences must be contiguous starting at 1.');
  }
  return selected;
}
