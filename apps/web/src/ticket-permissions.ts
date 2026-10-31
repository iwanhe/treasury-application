export function canEditTicket(status: string): boolean {
  return status === 'DRAFT' || status === 'RETURNED';
}

export function canSubmitTicket(status: string): boolean {
  return status === 'DRAFT' || status === 'RETURNED';
}

export function canCancelTicket(status: string): boolean {
  return status === 'DRAFT' || status === 'SUBMITTED';
}
