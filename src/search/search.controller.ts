

import { Controller, Get, Query, Res, Req, Redirect, UseGuards, BadRequestException, InternalServerErrorException } from '@nestjs/common'; // Added exceptions
import { Response, Request } from 'express';
import { SearchService } from './search.service';
import { ApiKeyGuard } from '../guards/api-key.guard';
// Import interfaces from the shared file
import {
    SearchResult,
    NewsResult,
    ImageResult,
    VideoResult,
    WikiSummary,
} from './interfaces/search.interfaces'; // Import interfaces


@Controller('search')
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    @Get('/')
    async renderSearchResults(
        @Req() req: Request,
        @Res() res: Response,
        @Query('query') queryParam: string,
        @Query('q') qParam: string,
        @Query('type') type: string,
        @Query('start') startParam: string,
    ) {
        const query = (queryParam || qParam)?.trim() || '';
        const start = Math.max(0, parseInt(startParam, 10) || 0);

        if (!query) {
             return res.redirect('/');
        }

        const bangRedirect = this.searchService.checkBangRedirects(query);
        if (bangRedirect) {
            return res.redirect(bangRedirect);
        }

        try {
             // Perform the search using the service
             const renderData = await this.searchService.performSearch(query, type, start, req);
             // Render the results view
             res.render('results', renderData);
        } catch (error) {
             console.error("Error in SearchController rendering search:", error.message);
             // Render an error page or results page with an error message
             res.render('results', {
                 query,
                 type,
                 start,
                 results: [],
                 images: [],
                 newsResults: [],
                 videos: [],
                 wiki: null,
                 countryCode: 'N/A',
                 elapsedTime: 'N/A',
                 searchSource: 'Error',
                 errorMessage: 'Arama sonuçları alınırken bir hata oluştu.' // Pass an error message
             });
        }
    }

    @UseGuards(ApiKeyGuard)
    @Get('/api')
    async getSearchResultsApi(
        @Query('query') queryParam: string,
        @Query('q') qParam: string,
        @Query('type') type: string,
        @Query('start') startParam: string,
        // apikey is handled by the guard
    ): Promise<{ // Explicitly type the return object for clarity in API
        query: string;
        type: string;
        start: number;
        searchSource: string;
        wiki: WikiSummary | null;
        results: SearchResult[];
        images: ImageResult[];
        newsResults: NewsResult[];
        videos: VideoResult[];
        // elapsedTime and countryCode are typically not returned in a public API response
    }> {
         const query = (queryParam || qParam)?.trim();
         const start = Math.max(0, parseInt(startParam, 10) || 0);

         if (!query) {
            // Use NestJS standard exceptions for API endpoints
            throw new BadRequestException("Arama sorgusu eksik!");
         }

         try {
             // Perform the search using the service
             const apiResponseData = await this.searchService.performSearch(query, type, start);

             // Return JSON response (exclude internal fields like elapsedTime, countryCode, req)
             const { elapsedTime, countryCode, ...responseData } = apiResponseData;

             return responseData; // NestJS automatically sends this as JSON
         } catch (error) {
             console.error("Error in SearchController API search:", error.message);
             // Use NestJS standard exception for internal server errors
             throw new InternalServerErrorException("Arama sırasında bir sunucu hatası oluştu.");
         }
    }

    @Get('/google')
    @Redirect('/search', 302)
    redirectToSearchGoogle(@Query('q') query: string) {
         return { url: `/search?query=${encodeURIComponent(query || '')}&type=web` };
    }

    @Get('/bing')
    @Redirect('/search', 302)
    redirectToSearchBing(@Query('q') query: string) {
         return { url: `/search?query=${encodeURIComponent(query || '')}&type=web` };
    }
}
