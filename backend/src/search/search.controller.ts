import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SearchService } from './search.service';

@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('candidates')
  candidates(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.search.semanticCandidates(q, limit ? Number(limit) : 20);
  }
}
