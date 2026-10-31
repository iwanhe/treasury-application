import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
async function bootstrap() {
 const app = await NestFactory.create(AppModule);
 app.setGlobalPrefix('api/v1');
 app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' });
 await app.listen(process.env.API_PORT ?? 3000);
}
void bootstrap();
