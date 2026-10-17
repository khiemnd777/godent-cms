import {ArgumentsHost,Body,Catch,Controller,ExceptionFilter,Get,HttpCode,Inject,Module,Param,Post,Put,Query,Req,UseFilters,type DynamicModule} from '@nestjs/common';
import {BuilderService} from './builder.service';
import {ReauthenticationRequired} from './publication.service';
import type {PrivateRequest} from './request-security';
const BUILDER=Symbol('BUILDER');
@Catch(ReauthenticationRequired)class ReauthFilter implements ExceptionFilter{catch(_e:ReauthenticationRequired,h:ArgumentsHost){h.switchToHttp().getResponse().status(403).json({statusCode:403,error:'Forbidden',code:'REAUTH_REQUIRED'});}}
@Controller('api/tenants/:tenant/site-builder')@UseFilters(ReauthFilter)
class BuilderController{
 constructor(@Inject(BUILDER)private readonly s:BuilderService){}
 @Get('references')references(@Req()r:PrivateRequest,@Param('tenant')t:string,@Query()q:Record<string,unknown>){return this.s.references(r,t,q);}
 @Get('config/:locale')config(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('locale')l:string){return this.s.read(r,t,'config',t,l);}
 @Put('config/:locale')saveConfig(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('locale')l:string,@Body()v:unknown){return this.s.command(r,t,'config',t,l,'save',v);}
 @Get('config/:locale/preview')configPreview(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('locale')l:string){return this.s.preview(r,t,'config',t,l);}
 @Get('config/:locale/history')configHistory(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('locale')l:string,@Query()q:Record<string,unknown>){return this.s.history(r,t,'config',t,l,q);}
 @Get('config/:locale/permissions')configPermissions(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('locale')l:string,@Query()q:Record<string,unknown>){return this.s.permissions(r,t,'config',t,l,q);}
 @Get('config/:locale/permissions/:permission')configPermission(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('locale')l:string,@Param('permission')p:string){return this.s.permission(r,t,'config',t,l,p);}
 @Post('config/:locale/permissions/retry')@HttpCode(200)configRetry(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('locale')l:string,@Body()v:unknown){return this.s.command(r,t,'config',t,l,'purge_retry',v);}
 @Post('config/:locale/:action')@HttpCode(200)configCommand(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('locale')l:string,@Param('action')a:string,@Body()v:unknown){return this.s.command(r,t,'config',t,l,a==='permissions'?'grant':a==='withdrawal'?'withdraw':a,v);}
 @Get('resources/:kind')list(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('kind')k:string,@Query()q:Record<string,unknown>){return this.s.list(r,t,k,q);}
 @Post('resources/:kind')create(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('kind')k:string,@Query('locale')l:string,@Body()v:unknown){return this.s.command(r,t,k,undefined,l,'create',v);}
 @Get('resources/:kind/:id/:locale')read(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('kind')k:string,@Param('id')id:string,@Param('locale')l:string){return this.s.read(r,t,k,id,l);}
 @Put('resources/:kind/:id/:locale')save(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('kind')k:string,@Param('id')id:string,@Param('locale')l:string,@Body()v:unknown){return this.s.command(r,t,k,id,l,'save',v);}
 @Get('resources/:kind/:id/:locale/preview')preview(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('kind')k:string,@Param('id')id:string,@Param('locale')l:string){return this.s.preview(r,t,k,id,l);}
 @Get('resources/:kind/:id/:locale/history')history(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('kind')k:string,@Param('id')id:string,@Param('locale')l:string,@Query()q:Record<string,unknown>){return this.s.history(r,t,k,id,l,q);}
 @Get('resources/:kind/:id/:locale/permissions')permissions(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('kind')k:string,@Param('id')id:string,@Param('locale')l:string,@Query()q:Record<string,unknown>){return this.s.permissions(r,t,k,id,l,q);}
 @Get('resources/:kind/:id/:locale/permissions/:permission')permission(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('kind')k:string,@Param('id')id:string,@Param('locale')l:string,@Param('permission')p:string){return this.s.permission(r,t,k,id,l,p);}
 @Post('resources/:kind/:id/:locale/permissions/retry')@HttpCode(200)retry(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('kind')k:string,@Param('id')id:string,@Param('locale')l:string,@Body()v:unknown){return this.s.command(r,t,k,id,l,'purge_retry',v);}
 @Post('resources/:kind/:id/:locale/:action')@HttpCode(200)command(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('kind')k:string,@Param('id')id:string,@Param('locale')l:string,@Param('action')a:string,@Body()v:unknown){return this.s.command(r,t,k,id,l,a==='permissions'?'grant':a==='withdrawal'?'withdraw':a,v);}
}
@Controller('api/public/builder')class PublicBuilderController{
 constructor(@Inject(BUILDER)private readonly s:BuilderService){}
 @Get(':tenant/seo')seo(@Req()r:PrivateRequest,@Param('tenant')t:string,@Query()q:Record<string,unknown>){return this.s.seo(r,t,q);}
 @Get(':tenant/:locale/search')search(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('locale')l:string,@Query()q:Record<string,unknown>){return this.s.publicSearch(r,t,l,q);}
 @Get(':tenant/:locale/config')config(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('locale')l:string){return this.s.publicConfig(r,t,l);}
 @Get(':tenant/:locale/:kind')list(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('locale')l:string,@Param('kind')k:string,@Query()q:Record<string,unknown>){return this.s.publicList(r,t,l,k,q);}
 @Get(':tenant/:locale/:kind/:slug')read(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('locale')l:string,@Param('kind')k:string,@Param('slug')s:string){return this.s.publicRead(r,t,l,k,s);}
}
@Module({})class BuilderModule{}
export function createBuilderModule(s:BuilderService):DynamicModule{return {module:BuilderModule,controllers:[BuilderController,PublicBuilderController],providers:[{provide:BUILDER,useValue:s}]};}
