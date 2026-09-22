import { ZodError } from 'zod';

export function formatZodError(error: ZodError): string {
  return error.issues.map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message)).join('; ');
}
