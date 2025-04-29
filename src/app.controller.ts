import { Controller, Get, Res, Render } from '@nestjs/common';
import { Response } from 'express'; // Import Response type

@Controller('/') // Use the root path
export class AppController {
  // You might inject AppService here if needed

  @Get('/')
  @Render('index') // Render the 'index.ejs' view
  getIndexPage() {
    return {}; // Pass data to the view if needed
  }

  @Get('/manifesto')
  @Render('manifesto') // Render the 'manifesto.ejs' view
  getManifestoPage() {
    return {};
  }

  @Get('/iletisim')
  @Render('iletisim') // Render the 'iletisim.ejs' view
  getIletisimPage() {
    return { messageSent: false }; // Pass data to the view
  }

  // Note: The original /google and /bing redirects are moved to the SearchController
}
