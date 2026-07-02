import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    // TV Time import posts several CSV files as a JSON body; the default 1 MB
    // Fastify limit is too small for a full watch history.
    new FastifyAdapter({ bodyLimit: 25 * 1024 * 1024 }),
  );

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  });

  await app.listen(process.env.API_PORT ?? 3000);
}

void bootstrap();
