import {Body,Controller,Get,HttpCode,Inject,Module,Param,Post,Query,Req,Res,type DynamicModule} from '@nestjs/common';
import type {ServerResponse} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import type {PrivateRequest} from './request-security';
import {M5PlatformService} from './m5-platform.service';
import {M5PlatformExport} from './m5-platform-export';
const PLATFORM=Symbol('M5_PLATFORM'),EXPORT=Symbol('M5_EXPORT');
@Controller('api/cms/tenants/:tenant/m5/platform') class M5TenantController {
 constructor(@Inject(PLATFORM)private readonly service:M5PlatformService,@Inject(EXPORT)private readonly exporter:M5PlatformExport){}
 @Get()status(@Req()r:PrivateRequest,@Param('tenant')t:string){return this.service.status(r,t);}
 @Post('deletion/request')@HttpCode(200)request(@Req()r:PrivateRequest,@Param('tenant')t:string,@Body()b:unknown){return this.service.command(r,t,'request',b);}
 @Post('deletion/confirm')@HttpCode(200)confirm(@Req()r:PrivateRequest,@Param('tenant')t:string,@Body()b:unknown){return this.service.command(r,t,'confirm',b);}
 @Post('deletion/cancel')@HttpCode(200)cancel(@Req()r:PrivateRequest,@Param('tenant')t:string,@Body()b:unknown){return this.service.command(r,t,'cancel',b);}
 @Get('export')async export(@Req()r:PrivateRequest,@Param('tenant')t:string,@Query()q:Record<string,unknown>,@Res()response:ServerResponse){const abort=new AbortController();const close=()=>abort.abort();response.once('close',close);try{const bytes=await this.exporter.create(r,t,q,abort.signal);response.setHeader('Content-Type','application/zip');response.setHeader('Content-Disposition','attachment; filename="tenant-business-export.zip"');response.setHeader('Cache-Control','private, no-store, max-age=0');response.setHeader('X-Content-Type-Options','nosniff');await pipeline(Readable.from(bytes),response);}catch(error){if(response.headersSent){response.destroy();return;}throw error;}finally{response.removeListener('close',close);}}
}
@Controller('api/platform/tenants/:tenant/m5') class M5PlatformController {
 constructor(@Inject(PLATFORM)private readonly service:M5PlatformService){}
 @Get()status(@Req()r:PrivateRequest,@Param('tenant')t:string){return this.service.status(r,t,true);}
 @Post('quota')@HttpCode(200)quota(@Req()r:PrivateRequest,@Param('tenant')t:string,@Body()b:unknown){return this.service.command(r,t,'quota',b);}
 @Post('lifecycle')@HttpCode(200)lifecycle(@Req()r:PrivateRequest,@Param('tenant')t:string,@Body()b:unknown){return this.service.command(r,t,'lifecycle',b);}
 @Post('deletion/execute')@HttpCode(200)execute(@Req()r:PrivateRequest,@Param('tenant')t:string,@Body()b:unknown){return this.service.command(r,t,'execute',b);}
}
@Module({})class M5PlatformModule{}
export function createM5PlatformModule(service:M5PlatformService,exporter:M5PlatformExport):DynamicModule{return {module:M5PlatformModule,controllers:[M5TenantController,M5PlatformController],providers:[{provide:PLATFORM,useValue:service},{provide:EXPORT,useValue:exporter}]};}
