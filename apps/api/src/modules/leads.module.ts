import { ArgumentsHost, Body, Catch, Controller, ExceptionFilter, Get, HttpCode, Inject, Module, Param, Post, Put, Query, Req, UseFilters, type DynamicModule } from '@nestjs/common';
import { LeadFailure, LeadsService } from './leads.service';
import type { PrivateRequest } from './request-security';
const LEADS = Symbol('LEADS');
@Catch(LeadFailure)
class LeadFilter implements ExceptionFilter {
  catch(error: LeadFailure, host: ArgumentsHost) {
    const statusCode = error.getStatus();
    host.switchToHttp().getResponse().status(statusCode).json({ statusCode, error: ({ 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict' } as Record<number, string>)[statusCode], code: error.code });
  }
}
@Controller('api/tenants/:tenant') @UseFilters(LeadFilter)
class LeadsController {
  constructor(@Inject(LEADS) private readonly service: LeadsService) {}
  @Get('leads') list(@Req() r: PrivateRequest, @Param('tenant') t: string, @Query() q: unknown) { return this.service.list(r, t, q); }
  @Get('leads/count') count(@Req() r: PrivateRequest, @Param('tenant') t: string, @Query() q: unknown) { return this.service.count(r, t, q); }
  @Get('leads/:id') detail(@Req() r: PrivateRequest, @Param('tenant') t: string, @Param('id') id: string) { return this.service.detail(r, t, id); }
  @Post('leads/:id/commands') @HttpCode(200) command(@Req() r: PrivateRequest, @Param('tenant') t: string, @Param('id') id: string, @Body() body: unknown) { return this.service.command(r, t, id, body); }
  @Get('leads/:id/history') history(@Req() r: PrivateRequest, @Param('tenant') t: string, @Param('id') id: string, @Query() q: Record<string, unknown>) { return this.service.history(r, t, id, q); }
  @Get('lead-assignees') assignees(@Req() r: PrivateRequest, @Param('tenant') t: string, @Query() q: Record<string, unknown>) { return this.service.assignees(r, t, q); }
  @Get('lead-notification-settings') settings(@Req() r: PrivateRequest, @Param('tenant') t: string) { return this.service.settings(r, t); }
  @Put('lead-notification-settings') settingsSave(@Req() r: PrivateRequest, @Param('tenant') t: string, @Body() b: unknown) { return this.service.saveSettings(r, t, b); }
}
@Module({}) class LeadsModule {}
export function createLeadsModule(service: LeadsService): DynamicModule { return { module: LeadsModule, controllers: [LeadsController], providers: [{ provide: LEADS, useValue: service }] }; }
