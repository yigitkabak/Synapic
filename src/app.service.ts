import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Synapic is Best Browser!'; // Example method
  }
}
