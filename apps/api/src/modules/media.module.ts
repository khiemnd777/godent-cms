import { Body, Controller, Get, HttpCode, Inject, Module, Param, Post, Query, Req, Res, type DynamicModule } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { MediaService, type MediaBinary } from './media.service';
import type { PrivateRequest } from './request-security';
const MEDIA=Symbol('MEDIA');
function send(response:ServerResponse,value:MediaBinary) {
  response.setHeader('Content-Type',value.type);response.setHeader('Cache-Control','private, no-store, max-age=0');
  response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');
  response.setHeader('Content-Length',String(value.body.byteLength));
  if(value.attachment) response.setHeader('Content-Disposition','attachment; filename="private-image"');
  response.end(value.body);
}
@Controller('api/tenants/:tenant/media')
class TenantMediaController {
  constructor(@Inject(MEDIA) private readonly service:MediaService) {}
  @Get() list(@Req() r:PrivateRequest,@Param('tenant') t:string,@Query() q:Record<string,unknown>) {return this.service.list(r,t,q);}
  @Post() upload(@Req() r:PrivateRequest&IncomingMessage,@Param('tenant') t:string) {return this.service.upload(r,t);}
  @Get(':id') detail(@Req() r:PrivateRequest,@Param('tenant') t:string,@Param('id') id:string) {return this.service.read(r,t,id);}
  @Post(':id/permission') @HttpCode(200) permission(@Req() r:PrivateRequest,@Param('tenant') t:string,@Param('id') id:string,@Body() b:unknown) {return this.service.permission(r,t,id,b);}
  @Post(':id/withdrawal') @HttpCode(200) withdraw(@Req() r:PrivateRequest,@Param('tenant') t:string,@Param('id') id:string,@Body() b:unknown) {return this.service.withdraw(r,t,id,b);}
  @Post(':id/access') @HttpCode(200) access(@Req() r:PrivateRequest,@Param('tenant') t:string,@Param('id') id:string,@Body() b:unknown) {return this.service.access(r,t,id,b);}
  @Post(':id/retry') @HttpCode(200) retry(@Req() r:PrivateRequest,@Param('tenant') t:string,@Param('id') id:string,@Body() b:unknown) {return this.service.retry(r,t,id,b);}
}
@Controller('api')
class MediaDeliveryController {
  constructor(@Inject(MEDIA) private readonly service:MediaService) {}
  @Get('media/access') async privateRead(@Req() r:PrivateRequest,@Query('token') token:string,@Res() response:ServerResponse) {send(response,await this.service.privateRead(r,token));}
  @Get('public/media/:tenant/:id/:revision/cover') async publicRead(@Req() r:PrivateRequest,@Param('tenant') t:string,@Param('id') id:string,@Param('revision') revision:string,@Res() response:ServerResponse) {send(response,await this.service.publicRead(r,t,id,revision));}
  @Get('public/content-media/:tenant/:resource/:publication/:id/:revision/cover') async contentPublicRead(@Req() r:PrivateRequest,@Param('tenant') t:string,@Param('resource') resource:string,@Param('publication') publication:string,@Param('id') id:string,@Param('revision') revision:string,@Res() response:ServerResponse) {send(response,await this.service.contentPublicRead(r,t,resource,publication,id,revision));}
}
@Module({}) class MediaModule {}
export function createMediaModule(service:MediaService):DynamicModule {return {module:MediaModule,controllers:[TenantMediaController,MediaDeliveryController],providers:[{provide:MEDIA,useValue:service}]};}
