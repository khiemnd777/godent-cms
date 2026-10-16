import { ArgumentsHost, Body, Catch, Controller, ExceptionFilter, HttpCode, Inject, Module, Param, Post, Req, UseFilters, type DynamicModule } from '@nestjs/common';
import { IntakeFailure, IntakeService, type IntakeRequest } from './intake.service';
import {BuilderIntakeService} from './builder-intake.service';
const BUILDER_INTAKE=Symbol('BUILDER_INTAKE');
const INTAKE=Symbol('INTAKE');
@Catch(IntakeFailure)
class IntakeFilter implements ExceptionFilter {
  catch(error:IntakeFailure,host:ArgumentsHost) {
    const status=error.getStatus();const labels:Record<number,string>={400:'Bad Request',404:'Not Found',409:'Conflict',428:'Precondition Required',429:'Too Many Requests',503:'Service Unavailable'};
    const response=host.switchToHttp().getResponse();
    if(status===429) response.setHeader('Retry-After','60');
    response.status(status).json({statusCode:status,error:labels[status],code:error.code});
  }
}
@Controller('api/public/intake/sites/:tenant/services/:service')
@UseFilters(IntakeFilter)
class PublicIntakeController {
  constructor(@Inject(INTAKE) private readonly intake:IntakeService) {}
  @Post() @HttpCode(200) accept(@Req() request:IntakeRequest,@Param('tenant') tenant:string,@Param('service') service:string,@Body() body:unknown) {return this.intake.accept(request,tenant,service,body);}
  @Post('challenge') @HttpCode(200) challenge(@Req() request:IntakeRequest,@Param('tenant') tenant:string,@Param('service') service:string,@Body() body:unknown) {return this.intake.challenge(request,tenant,service,body);}
}
@Controller('api/public/intake/builder/:tenant/:locale/:kind/:slug')
@UseFilters(IntakeFilter)
class BuilderIntakeController{
 constructor(@Inject(BUILDER_INTAKE)private readonly s:BuilderIntakeService){}
 @Post()@HttpCode(200)accept(@Req()r:IntakeRequest,@Param('tenant')t:string,@Param('locale')l:string,@Param('kind')k:string,@Param('slug')slug:string,@Body()v:unknown){return this.s.accept(r,t,l,k,slug,v);}
 @Post('challenge')@HttpCode(200)challenge(@Req()r:IntakeRequest,@Param('tenant')t:string,@Param('locale')l:string,@Param('kind')k:string,@Param('slug')slug:string,@Body()v:unknown){return this.s.challenge(r,t,l,k,slug,v);}
}
@Module({}) class IntakeModule {}
export function createIntakeModule(service:IntakeService,builder:BuilderIntakeService):DynamicModule {return {module:IntakeModule,controllers:[PublicIntakeController,BuilderIntakeController],providers:[{provide:INTAKE,useValue:service},{provide:BUILDER_INTAKE,useValue:builder}]};}
