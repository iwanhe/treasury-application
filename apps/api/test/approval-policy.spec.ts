import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { Prisma } from '@prisma/client';
import { selectApplicableApprovalRules } from '../src/modules/treasury-tickets/approval-policy';
const rule = (id: string, companyId: string | null, sequence: number, min: string, max: string | null = null) => ({
  id, companyId, sequence, currencyCode: 'IDR', minAmount: new Prisma.Decimal(min),
  maxAmount: max === null ? null : new Prisma.Decimal(max)
});
describe('selectApplicableApprovalRules', () => {
  it('prefers company rules over global rules and respects nominal boundaries', () => {
    const selected = selectApplicableApprovalRules([
      rule('global-1', null, 1, '0'), rule('local-1', 'pt-a', 1, '1000000', '5000000'),
      rule('local-2', 'pt-a', 2, '1000000', '5000000')
    ], 'pt-a', 'IDR', '5000000.00');
    assert.deepEqual(selected.map(x => x.id), ['local-1', 'local-2']);
  });
  it('uses global rules when no company-specific rule matches', () => {
    const selected = selectApplicableApprovalRules([rule('global-1', null, 1, '0')], 'pt-a', 'IDR', '1');
    assert.equal(selected[0].id, 'global-1');
  });
  it('does not mix currencies or ranges', () => {
    assert.equal(selectApplicableApprovalRules([rule('r1', 'pt-a', 1, '10', '20')], 'pt-a', 'IDR', '21').length, 0);
  });
  it('rejects sequence gaps', () => {
    assert.throws(() => selectApplicableApprovalRules([
      rule('r1', 'pt-a', 1, '0'), rule('r3', 'pt-a', 3, '0')
    ], 'pt-a', 'IDR', '100'), /contiguous/);
  });
});
