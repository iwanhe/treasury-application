import { describe, expect, it } from 'vitest';
import { canCancelTicket, canEditTicket, canSubmitTicket } from './ticket-permissions';

describe('ticket action permissions shown by the UI', () => {
  it.each(['DRAFT', 'RETURNED'])('allows editing and submitting %s tickets', status => {
    expect(canEditTicket(status)).toBe(true);
    expect(canSubmitTicket(status)).toBe(true);
  });

  it.each(['IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'])('does not allow editing or submitting %s tickets', status => {
    expect(canEditTicket(status)).toBe(false);
    expect(canSubmitTicket(status)).toBe(false);
  });

  it.each(['DRAFT', 'SUBMITTED'])('allows cancellation of %s tickets', status => {
    expect(canCancelTicket(status)).toBe(true);
  });

  it.each(['IN_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'])('does not allow cancellation of %s tickets', status => {
    expect(canCancelTicket(status)).toBe(false);
  });
});
