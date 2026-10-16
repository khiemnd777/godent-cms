import {ArgumentsHost,Body,Catch,Controller,ExceptionFilter,Get,HttpCode,Inject,Module,Param,Post,Query,Req,UseFilters,type DynamicModule} from '@nestjs/common';
import {M5DomainsService} from './m5-domains.service';
import {ReauthenticationRequired} from './publication.service';
import type {PrivateRequest} from './request-security';
const DOMAINS=Symbol('M5_DOMAINS');
@Catch(ReauthenticationRequired)class ReauthFilter implements ExceptionFilter{catch(_e:ReauthenticationRequired,h:ArgumentsHost){h.switchToHttp().getResponse().status(403).json({statusCode:403,error:'Forbidden',code:'REAUTH_REQUIRED'});}}
@Controller('api/tenants/:tenant/domains')@UseFilters(ReauthFilter)
class DomainsController{
 constructor(@Inject(DOMAINS)private readonly s:M5DomainsService){}
 @Get()list(@Req()r:PrivateRequest,@Param('tenant')t:string,@Query()q:Record<string,unknown>){return this.s.list(r,t,q);}
 @Get('readiness')readiness(@Req()r:PrivateRequest,@Param('tenant')t:string){return this.s.list(r,t);}
 @Post()register(@Req()r:PrivateRequest,@Param('tenant')t:string,@Body()v:unknown){return this.s.command(r,t,undefined,'register',v);}
 @Post('primary')@HttpCode(200)primary(@Req()r:PrivateRequest,@Param('tenant')t:string,@Body()v:unknown){return this.s.command(r,t,undefined,'primary',v);}
 @Post(':binding/:action')@HttpCode(200)change(@Req()r:PrivateRequest,@Param('tenant')t:string,@Param('binding')b:string,@Param('action')a:string,@Body()v:unknown){return this.s.command(r,t,b,a,v);}
}
@Controller('api/public')class EntryController{constructor(@Inject(DOMAINS)private readonly s:M5DomainsService){}@Get('entry')resolve(@Req()r:PrivateRequest,@Query()q:Record<string,unknown>){return this.s.resolve(r,q);}}
@Module({})class M5DomainsModule{}
export function createM5DomainsModule(s:M5DomainsService):DynamicModule{return {module:M5DomainsModule,controllers:[DomainsController,EntryController],providers:[{provide:DOMAINS,useValue:s}]};}
