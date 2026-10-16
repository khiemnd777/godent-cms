import {ArgumentsHost,Body,Catch,Controller,ExceptionFilter,Get,HttpCode,Inject,Module,Param,Post,Put,Query,Req,UseFilters,type DynamicModule} from '@nestjs/common';
import {ContentService} from './content.service';
import {ReauthenticationRequired} from './publication.service';
import type {PrivateRequest} from './request-security';
const CONTENT=Symbol('CONTENT');
@Catch(ReauthenticationRequired) class ReauthFilter implements ExceptionFilter {catch(_e:ReauthenticationRequired,h:ArgumentsHost){h.switchToHttp().getResponse().status(403).json({statusCode:403,error:'Forbidden',code:'REAUTH_REQUIRED'});}}
@Controller('api/tenants/:tenantId') @UseFilters(ReauthFilter)
class ContentController {
 constructor(@Inject(CONTENT) private readonly s:ContentService){}
 @Get('content-references') refs(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Query()q:Record<string,unknown>){return this.s.references(r,t,q);}
 @Get('content/:kind') list(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Query()q:Record<string,unknown>){return this.s.list(r,t,k,q);}
 @Post('content/:kind') create(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Body()v:unknown){return this.s.command(r,t,k,undefined,'create',v);}
 @Get('content/:kind/:id') read(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Param('id')id:string){return this.s.read(r,t,k,id);}
 @Put('content/:kind/:id') save(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Param('id')id:string,@Body()v:unknown){return this.s.command(r,t,k,id,'save',v);}
 @Get('content/:kind/:id/preview') preview(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Param('id')id:string){return this.s.preview(r,t,k,id);}
 @Get('content/:kind/:id/live') live(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Param('id')id:string){return this.s.live(r,t,k,id);}
 @Get('content/:kind/:id/history') history(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Param('id')id:string,@Query('cursor')c:unknown){return this.s.history(r,t,k,id,c);}
 @Post('content/:kind/:id/publish') @HttpCode(200) publish(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Param('id')id:string,@Body()v:unknown){return this.s.command(r,t,k,id,'publish',v);}
 @Post('content/:kind/:id/unpublish') @HttpCode(200) unpublish(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Param('id')id:string,@Body()v:unknown){return this.s.command(r,t,k,id,'unpublish',v);}
 @Post('content/:kind/:id/restore') @HttpCode(200) restore(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Param('id')id:string,@Body()v:unknown){return this.s.command(r,t,k,id,'restore',v);}
 @Get('content/:kind/:id/permissions') permissions(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Param('id')id:string,@Query()q:Record<string,unknown>){return this.s.permissions(r,t,k,id,q);}
 @Get('content/:kind/:id/permissions/:permissionId') permission(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Param('id')id:string,@Param('permissionId')p:string){return this.s.permission(r,t,k,id,p);}
 @Post('content/:kind/:id/permissions') @HttpCode(200) grant(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Param('id')id:string,@Body()v:unknown){return this.s.command(r,t,k,id,'grant',v);}
 @Post('content/:kind/:id/permissions/withdrawal') @HttpCode(200) withdraw(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Param('id')id:string,@Body()v:unknown){return this.s.command(r,t,k,id,'withdraw',v);}
 @Post('content/:kind/:id/permissions/retry') @HttpCode(200) retry(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('kind')k:string,@Param('id')id:string,@Body()v:unknown){return this.s.command(r,t,k,id,'purge_retry',v);}
 @Get('publication/services/:id/content-links') links(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('id')id:string){return this.s.serviceLinks(r,t,id);}
 @Put('publication/services/:id/content-links') saveLinks(@Req()r:PrivateRequest,@Param('tenantId')t:string,@Param('id')id:string,@Body()v:unknown){return this.s.serviceLinks(r,t,id,v);}
}
@Controller('api/public/content') class PublicContentController {
 constructor(@Inject(CONTENT)private readonly s:ContentService){}
 @Get(':tenant/service/:slug/links') links(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('slug')slug:string){return this.s.publicServiceLinks(r,t,slug);}
 @Get(':tenant/:kind') list(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('kind')k:string,@Query()q:Record<string,unknown>){return this.s.publicList(r,t,k,q);}
 @Get(':tenant/:kind/:slug') read(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('kind')k:string,@Param('slug')slug:string){return this.s.publicRead(r,t,k,slug);}
}
@Module({})class ContentModule{}
export function createContentModule(service:ContentService):DynamicModule{return {module:ContentModule,controllers:[ContentController,PublicContentController],providers:[{provide:CONTENT,useValue:service}]};}
