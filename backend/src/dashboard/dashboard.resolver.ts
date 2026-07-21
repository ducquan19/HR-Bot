import { Resolver, Query } from '@nestjs/graphql';
import { DashboardService } from './dashboard.service';
import { UseGuards } from '@nestjs/common';
import { Context } from '@nestjs/graphql';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class DashboardStats {
  @Field(() => Int)
  totalCampaigns: number;

  @Field(() => Int)
  activeCampaigns: number;

  @Field(() => Int)
  totalCandidates: number;

  @Field(() => Int)
  interviewsScheduled: number;
}

@Resolver()
@UseGuards(JwtAuthGuard)
export class DashboardResolver {
  constructor(private readonly dashboardService: DashboardService) {}

  @Query(() => DashboardStats)
  async getDashboardStatsGraphQL(@Context() context: any) {
    const user = context.req.user;
    const summary = await this.dashboardService.summary(user);
    return {
      totalCampaigns: summary.cards.activeCampaigns, // Simplified mapping for PoC
      activeCampaigns: summary.cards.activeCampaigns,
      totalCandidates: summary.cards.totalCandidates,
      interviewsScheduled: summary.cards.interviews,
    };
  }
}
