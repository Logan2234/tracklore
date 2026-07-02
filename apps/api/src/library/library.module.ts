import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

@Module({
  imports: [CatalogModule],
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
