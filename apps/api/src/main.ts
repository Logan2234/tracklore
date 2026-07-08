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
    {
      logger: ["error", "warn", "log", "fatal", "debug", "verbose"],
      httpsOptions:
        process.env.API_TLS_KEY && process.env.API_TLS_CERT
          ? {
              key: process.env.API_TLS_KEY,
              cert: process.env.API_TLS_CERT,
            }
          : undefined,
      abortOnError: true,
      autoFlushLogs: true,
      bufferLogs: true,
      moduleIdGeneratorAlgorithm: "reference",
      forceConsole: false,
      preview: false,
      rawBody: false,
      snapshot: false,
      cors: {
        origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        optionsSuccessStatus: 204,
        maxAge: 3600,
        credentials: true,
        exposedHeaders: ["Content-Disposition"],
        preflightContinue: false,
      },
    },
  );

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.API_PORT ?? 3000);
}

void bootstrap();
