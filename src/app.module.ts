import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios'; // Import HttpModule
import { AppController } from './app.controller';
import { AppService } from './app.service'; // Keep AppService if you use it for global logic
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    // Load environment variables from .env file
    ConfigModule.forRoot({
      isGlobal: true, // Makes config available throughout the app
    }),
    // Enable scheduling for background tasks
    ScheduleModule.forRoot(),
    // Provide HttpService from @nestjs/axios for making HTTP requests
    HttpModule,
    // Import your feature module
    SearchModule,
  ],
  controllers: [AppController], // Basic controllers (/, manifesto, iletisim)
  providers: [AppService], // Basic services
})
export class AppModule {}
