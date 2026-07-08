import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('apiPrefix', 'api');
  const frontendUrl = config.get<string>('frontendUrl', 'http://localhost:5173');

  app.setGlobalPrefix(apiPrefix);
  const helmetMiddleware = helmet();
  app.use((req: Request, res: Response, next: NextFunction) => {
    const swaggerPath = `/${apiPrefix}/docs`;
    if (req.path === swaggerPath || req.path.startsWith(`${swaggerPath}/`)) return next();
    return helmetMiddleware(req, res, next);
  });
  app.use(cookieParser());
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HR Bot API')
    .setDescription('API documentation for the HR Bot backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, swaggerDocument);

  await app.listen(config.get<number>('port', 3000));
}
bootstrap();
