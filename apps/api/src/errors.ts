import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { postgresCode } from './database';

const labels: Record<number, string> = {
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
  409: 'Conflict', 413: 'Payload Too Large', 415: 'Unsupported Media Type',
  429: 'Too Many Requests', 503: 'Service Unavailable',
};
export function safeError(error: unknown) {
  const code = postgresCode(error);
  const statusCode = error instanceof HttpException ? error.getStatus() :
    code === '28000' ? 401 : code === '42501' ? 403 :
      ['23514', '23505', '40001', '40P01'].includes(code ?? '') ? 409 : 500;
  return { statusCode, error: labels[statusCode] ?? 'Internal Server Error' };
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
