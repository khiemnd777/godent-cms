import { ArgumentsHost, Body, Catch, Controller, HttpCode, Inject, Module, Param, Post, Req, UseFilters, type DynamicModule, type ExceptionFilter } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { LeadFailure } from './leads.service';
import type { PrivateRequest } from './request-security';
const RETENTION = Symbol('RETENTION');
@Catch(LeadFailure)
class RetentionFilter implements ExceptionFilter {
  catch(error: LeadFailure, host: ArgumentsHost) {
    const statusCode = error.getStatus();
    host.switchToHttp().getResponse().status(statusCode).json({ statusCode, error: ({ 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict' } as Record<number, string>)[statusCode], code: error.code });
  }
}
@Controller('api/tenants/:tenant/leads/:id') @UseFilters(RetentionFilter)
class RetentionController {
  constructor(@Inject(RETENTION) private readonly service: RetentionService) {}
  @Post('retention-extension') @HttpCode(200)
  extend(@Req() request: PrivateRequest, @Param('tenant') tenant: string, @Param('id') id: string, @Body() body: unknown) { return this.service.extend(request, tenant, id, body); }
}
@Module({}) class RetentionModule {}
export function createRetentionModule(service: RetentionService): DynamicModule { return { module: RetentionModule, controllers: [RetentionController], providers: [{ provide: RETENTION, useValue: service }] }; }
