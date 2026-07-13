import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { BooksModule } from "./books/books.module";
import { CatalogModule } from "./catalog/catalog.module";
import { GamesModule } from "./games/games.module";
import { HealthModule } from "./health/health.module";
import { ImportModule } from "./import/tvtime/import.module";
import { LibraryModule } from "./library/library.module";
import { NotificationModule } from "./notifications/notification.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    GamesModule,
    BooksModule,
    LibraryModule,
    ImportModule,
    NotificationModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
