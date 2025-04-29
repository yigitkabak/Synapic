import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';

async function bootstrap() {
  // Use NestExpressApplication to access underlying Express features
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files from the 'public' directory
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Set the directory for views and the view engine
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('ejs');

  // Optional: Configure body-parser if needed elsewhere (already handled by default for JSON/URL-encoded)
  // app.use(bodyParser.urlencoded({ extended: true }));
  // app.use(bodyParser.json());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Synapic Search sunucusu çalışıyor: http://localhost:${port}`);
}
bootstrap();
