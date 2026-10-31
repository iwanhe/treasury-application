export interface AuthenticatedPrincipal {
  userId: string;
  subject: string;
  email?: string;
  roles: string[];
}
export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedPrincipal;
}
