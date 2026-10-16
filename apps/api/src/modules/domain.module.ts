import { Body, Controller, Delete, Get, HttpCode, Inject, Module, Param, Post, Put, Query, Req, type DynamicModule } from '@nestjs/common';
import { DomainService } from './domain.service';
import type { PrivateRequest } from './request-security';

const DOMAIN_SERVICE = Symbol('DOMAIN_SERVICE');

@Controller('api')
class SessionController {
  constructor(@Inject(DOMAIN_SERVICE) private readonly service: DomainService) {}
  @Get('session') current(@Req() request: PrivateRequest) { return this.service.currentSession(request); }
  @Post('session/reauth') @HttpCode(200)
  reauthenticate(@Req() request: PrivateRequest, @Body() input: unknown) { return this.service.reauthenticate(request, input); }
  @Post('invitations/accept') @HttpCode(200)
  accept(@Req() request: PrivateRequest, @Body() input: unknown) { return this.service.acceptInvitation(request, input); }
}

@Controller('api/tenants/:tenantId')
class TenantController {
  constructor(@Inject(DOMAIN_SERVICE) private readonly service: DomainService) {}
  @Get('services') list(@Req() request: PrivateRequest, @Param('tenantId') tenant: string, @Query('cursor') cursor?: string) {
    return this.service.listDrafts(request, tenant, cursor);
  }
  @Post('services') create(@Req() request: PrivateRequest, @Param('tenantId') tenant: string, @Body() input: unknown) {
    return this.service.createDraft(request, tenant, input);
  }
  @Get('services/:draftId') get(@Req() request: PrivateRequest, @Param('tenantId') tenant: string, @Param('draftId') id: string) {
    return this.service.getDraft(request, tenant, id);
  }
  @Get('services/:draftId/preview') preview(@Req() request: PrivateRequest, @Param('tenantId') tenant: string, @Param('draftId') id: string) {
    return this.service.getDraft(request, tenant, id);
  }
  @Put('services/:draftId') save(@Req() request: PrivateRequest, @Param('tenantId') tenant: string, @Param('draftId') id: string, @Body() input: unknown) {
    return this.service.saveDraft(request, tenant, id, input);
  }
  @Get('members') members(@Req() request: PrivateRequest, @Param('tenantId') tenant: string, @Query('cursor') cursor?: string) {
    return this.service.listMembers(request, tenant, cursor);
  }
  @Delete('members/:userId') revoke(@Req() request: PrivateRequest, @Param('tenantId') tenant: string, @Param('userId') user: string) {
    return this.service.revokeMember(request, tenant, user);
  }
  @Get('invitations') invitations(@Req() request: PrivateRequest, @Param('tenantId') tenant: string, @Query('cursor') cursor?: string) {
    return this.service.listInvitations(request, tenant, cursor);
  }
  @Post('invitations') invite(@Req() request: PrivateRequest, @Param('tenantId') tenant: string, @Body() input: unknown) {
    return this.service.inviteMember(request, tenant, input);
  }
  @Post('invitations/:invitationId/resend') @HttpCode(200)
  resend(@Req() request: PrivateRequest, @Param('tenantId') tenant: string, @Param('invitationId') id: string, @Body() input: unknown) {
    return this.service.resendInvitation(request, tenant, id, input);
  }
  @Delete('invitations/:invitationId') revokeInvite(@Req() request: PrivateRequest, @Param('tenantId') tenant: string, @Param('invitationId') id: string) {
    return this.service.revokeInvitation(request, tenant, id);
  }
}

@Controller('api/platform')
class PlatformController {
  constructor(@Inject(DOMAIN_SERVICE) private readonly service: DomainService) {}
  @Get('tenants') tenants(@Req() request: PrivateRequest, @Query('cursor') cursor?: string) { return this.service.listTenants(request, cursor); }
  @Post('tenants') provision(@Req() request: PrivateRequest, @Body() input: unknown) { return this.service.provisionTenant(request, input); }
  @Post('users/:userId/disable') @HttpCode(200)
  disable(@Req() request: PrivateRequest, @Param('userId') user: string, @Body() input: unknown) { return this.service.disableUser(request, user, input); }
}

@Module({})
class DomainModule {}
export function createDomainModule(service: DomainService): DynamicModule {
  return { module: DomainModule, controllers: [SessionController, TenantController, PlatformController],
    providers: [{ provide: DOMAIN_SERVICE, useValue: service }] };
}
