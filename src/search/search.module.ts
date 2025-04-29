import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { HttpModule } from '@nestjs/axios'; // Required if SearchService uses HttpService
import { ConfigModule } from '@nestjs/config'; // Required if SearchService uses ConfigService

@Module({
  imports: [
    HttpModule, // Inject HttpService into SearchService
    ConfigModule, // Inject ConfigService into SearchService
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService], // Export the service if other modules need it (not strictly needed here)
})
export class SearchModule {}
