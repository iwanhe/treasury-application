import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:5173')
    .split(',').map(origin => origin.trim()).filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type']
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  }));
  app.setGlobalPrefix('api');
  return app;
}

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

if (require.main === module) {
  void bootstrap();
}
