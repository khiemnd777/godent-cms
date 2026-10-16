import { ArgumentsHost, Body, Catch, Controller, ExceptionFilter, Get, HttpCode, Inject, Module, Param, Post, Put, Query, Req, UseFilters, type DynamicModule } from '@nestjs/common';
import { PublicationServiceOperations, ReauthenticationRequired } from './publication.service';
import type { PrivateRequest } from './request-security';

const PUBLICATION_SERVICE=Symbol('PUBLICATION_SERVICE');
@Catch(ReauthenticationRequired)
class ReauthenticationFilter implements ExceptionFilter {
  catch(_error:ReauthenticationRequired,host:ArgumentsHost) {
    host.switchToHttp().getResponse().status(403).json({statusCode:403,error:'Forbidden',code:'REAUTH_REQUIRED'});
  }
}
@Controller('api/tenants/:tenantId/publication')
@UseFilters(ReauthenticationFilter)
class PublicationController {
  constructor(@Inject(PUBLICATION_SERVICE) private readonly service:PublicationServiceOperations) {}
  @Get('site') site(@Req() r:PrivateRequest,@Param('tenantId') tenant:string) {return this.service.getSite(r,tenant);}
  @Get('site/history') siteHistory(@Req() r:PrivateRequest,@Param('tenantId') tenant:string,@Query('cursor') cursor?:string) {return this.service.history(r,tenant,'site',tenant,cursor);}
  @Post('site/restore') @HttpCode(200) siteRestore(@Req() r:PrivateRequest,@Param('tenantId') tenant:string,@Body() input:unknown) {return this.service.restore(r,tenant,'site',tenant,input);}
  @Put('site') saveSite(@Req() r:PrivateRequest,@Param('tenantId') tenant:string,@Body() input:unknown) {return this.service.saveSite(r,tenant,input);}
  @Get('services') list(@Req() r:PrivateRequest,@Param('tenantId') tenant:string,@Query('cursor') cursor?:string,@Query('q') q?:string,@Query('pageSize') pageSize?:string) {return this.service.list(r,tenant,cursor,q,pageSize);}
  @Post('services') create(@Req() r:PrivateRequest,@Param('tenantId') tenant:string,@Body() input:unknown) {return this.service.create(r,tenant,input);}
  @Get('services/:id') get(@Req() r:PrivateRequest,@Param('tenantId') tenant:string,@Param('id') id:string) {return this.service.read(r,tenant,id);}
  @Put('services/:id') save(@Req() r:PrivateRequest,@Param('tenantId') tenant:string,@Param('id') id:string,@Body() input:unknown) {return this.service.save(r,tenant,id,input);}
  @Get('services/:id/preview') preview(@Req() r:PrivateRequest,@Param('tenantId') tenant:string,@Param('id') id:string) {return this.service.preview(r,tenant,id);}
  @Get('services/:id/live') live(@Req() r:PrivateRequest,@Param('tenantId') tenant:string,@Param('id') id:string) {return this.service.live(r,tenant,id);}
  @Get('services/:id/history') history(@Req() r:PrivateRequest,@Param('tenantId') tenant:string,@Param('id') id:string,@Query('cursor') cursor?:string) {return this.service.history(r,tenant,'service',id,cursor);}
  @Post('services/:id/restore') @HttpCode(200) restore(@Req() r:PrivateRequest,@Param('tenantId') tenant:string,@Param('id') id:string,@Body() input:unknown) {return this.service.restore(r,tenant,'service',id,input);}
  @Post('services/:id/unpublish') @HttpCode(200) unpublish(@Req() r:PrivateRequest,@Param('tenantId') tenant:string,@Param('id') id:string,@Body() input:unknown) {return this.service.unpublish(r,tenant,id,input);}
  @Post('services/:id/publish') @HttpCode(200)
  publish(@Req() r:PrivateRequest,@Param('tenantId') tenant:string,@Param('id') id:string,@Body() input:unknown) {return this.service.publish(r,tenant,id,input);}
}
@Controller('api/public/sites')
class PublicServiceController {
  constructor(@Inject(PUBLICATION_SERVICE) private readonly service:PublicationServiceOperations) {}
  @Get(':tenant/services/:slug') read(@Req() r:PrivateRequest,@Param('tenant') tenant:string,@Param('slug') slug:string) {return this.service.publicRead(r,tenant,slug);}
}
@Module({})
class PublicationModule {}
export function createPublicationModule(service:PublicationServiceOperations):DynamicModule {
  return {module:PublicationModule,controllers:[PublicationController,PublicServiceController],providers:[{provide:PUBLICATION_SERVICE,useValue:service}]};
}
