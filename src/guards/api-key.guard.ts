import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SearchService } from '../search/search.service'; // Inject the service that holds keys

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private readonly searchService: SearchService) {} // Inject SearchService

    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.query.apikey;

        if (!apiKey || !this.searchService.isValidApiKey(apiKey)) {
            // Use NestJS standard exception for unauthorized access
            throw new ForbiddenException('Geçersiz veya eksik API anahtarı');
        }

        return true; // Allow access
    }
}
