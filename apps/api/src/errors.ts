import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { postgresCode } from './database';

const labels: Record<number, string> = {
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
  409: 'Conflict', 413: 'Payload Too Large', 415: 'Unsupported Media Type',
  429: 'Too Many Requests', 503: 'Service Unavailable',
};
const publicCodes = new Set(['INVALID_INPUT', 'VERSION_CONFLICT', 'OPERATION_CONFLICT', 'REAUTH_REQUIRED',
  'QUOTA_EXCEEDED', 'DELETION_UNAVAILABLE', 'CONFIRMATION_REQUIRED', 'EXECUTE_AFTER', 'IRREVERSIBLE', 'NOT_FOUND']);
interface PublicErrorBody { statusCode: number; error: string; code?: string; dimension?: 'content_items' | 'media_bytes'; usage?: number; limit?: number }
function quotaFacts(error: unknown): Pick<PublicErrorBody, 'dimension' | 'usage' | 'limit'> {
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const value = current as { code?: unknown; errno?: unknown; detail?: unknown; cause?: unknown };
    if ((value.code === 'P5501' || value.errno === 'P5501') && typeof value.detail === 'string' && value.detail.length <= 1024) {
      try {
        const facts = JSON.parse(value.detail);
        if (facts && ['content_items', 'media_bytes'].includes(facts.dimension) &&
          Number.isSafeInteger(facts.usage) && facts.usage >= 0 && Number.isSafeInteger(facts.limit) && facts.limit >= 0) {
          return { dimension: facts.dimension, usage: facts.usage, limit: facts.limit };
        }
      } catch { /* Invalid database detail is never public. */ }
    }
    current = value.cause;
  }
  return {};
}
export function safeError(error: unknown): PublicErrorBody {
  const code = postgresCode(error);
  const statusCode = error instanceof HttpException ? error.getStatus() :
    code === '28000' ? 401 : code === '42501' ? 403 :
      ['23514', '23505', '40001', '40P01', 'P5501'].includes(code ?? '') ? 409 : 500;
  const body: PublicErrorBody = { statusCode, error: labels[statusCode] ?? 'Internal Server Error' };
  if (code === 'P5501') return { ...body, code: 'QUOTA_EXCEEDED', ...quotaFacts(error) };
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (response && typeof response === 'object') {
      const value = response as { code?: unknown; message?: unknown };
      const known = value.code ?? (value.message === 'REAUTH_REQUIRED' ? value.message : undefined);
      if (typeof known === 'string' && publicCodes.has(known)) body.code = known;
    }
  }
  return body;
}

// Do not serialize exception messages, request URLs or stack traces.
// Source: https://docs.nestjs.com/exception-filters
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const body = safeError(error);
    response.status(body.statusCode).json(body);
  }
}
