import 'reflect-metadata';
import { Controller, Get, Module, Query, Res, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { SafeExceptionFilter } from './errors';
import { readConfig } from './config';
import { readiness } from './services';
import { createS02Database } from './database';
import { createS02Auth } from './auth';
import { DomainService } from './modules/domain.service';
import { createDomainModule } from './modules/domain.module';
import { PublicationServiceOperations } from './modules/publication.service';
import { createPublicationModule } from './modules/publication.module';
import { apiSecurity, bodyParserError } from './modules/http-security';
import { IntakeService } from './modules/intake.service';
import { createIntakeModule } from './modules/intake.module';
import { LeadsService } from './modules/leads.service';
import { createLeadsModule } from './modules/leads.module';
import { RetentionService } from './modules/retention.service';
import { createRetentionModule } from './modules/retention.module';
import { MediaService } from './modules/media.service';
import { createMediaModule } from './modules/media.module';
import { MediaStorage, readMediaStorageConfig } from './media/storage';
import { MediaSigner } from './media/signing';

class EchoQuery {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  value!: string;
}

@Controller()
class DiagnosticsController {
  @Get('health')
  health() { return { status: 'ok', scope: 'process', runtime: 'bun', version: Bun.version }; }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: { status: (code: number) => void }) {
    const result = await readiness(readConfig());
    response.status(result.status === 'ready' ? 200 : 503);
    return result;
  }

  @Get('diagnostics/echo')
  echo(@Query() query: EchoQuery) { return { value: query.value }; }
}

export async function createApp() {
  if (!process.versions.bun) throw new Error('Bun runtime required');
  readConfig();
  const database = createS02Database();
  const identity = createS02Auth(database);
  const leads = new LeadsService(database,identity);
  const mediaStorage = new MediaStorage(readMediaStorageConfig());
  @Module({ controllers: [DiagnosticsController], imports: [createDomainModule(new DomainService(database, identity)),
    createPublicationModule(new PublicationServiceOperations(database, identity)),createIntakeModule(new IntakeService(database,identity)),createLeadsModule(leads),
    createRetentionModule(new RetentionService(database,identity,leads)),createMediaModule(new MediaService(database,identity,mediaStorage,new MediaSigner(process.env.S07_MEDIA_SIGNING_SECRET??'')))],
    providers: [{ provide: 'DATABASE_LIFECYCLE', useValue: { onApplicationShutdown: async () => {mediaStorage.close();await database.close();} } }] })
  class AppModule {}
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false, bodyParser: false });
  const express = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  express.set('trust proxy', false);
  app.use('/api', apiSecurity);
  // Better Auth 1.7.10 consumes the raw stream before the custom JSON parser.
  // Source: https://better-auth.com/docs/integrations/express#mount-the-handler
  express.all(/^\/api\/auth(?:\/.*)?$/, toNodeHandler(identity.handler));
  app.useBodyParser('json', { limit: '64kb', strict: true });
  app.use(bodyParserError);
  // Source: https://docs.nestjs.com/techniques/validation
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true,
    forbidUnknownValues: true, validationError: { target: false, value: false } }));
  app.useGlobalFilters(new SafeExceptionFilter());
  app.enableShutdownHooks(['SIGTERM', 'SIGINT']);
  return app;
}
