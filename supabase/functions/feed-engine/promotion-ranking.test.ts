import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { mergePromotedPosts, promotionScore, rankPromotedPosts } from './promotion-ranking.ts';

Deno.test('promotion score excludes inactive and capped campaigns', () => {
  assertEquals(promotionScore({ campaignId: 'a', postId: 'a', planKey: 'starter', planWeight: 1, active: false, targetMatches: true, frequencyCapped: false, pacingFactor: 1, qualityFactor: 1 }), 0);
  assertEquals(promotionScore({ campaignId: 'b', postId: 'b', planKey: 'starter', planWeight: 1, active: true, targetMatches: true, frequencyCapped: false, pacingFactor: .5, qualityFactor: .8 }), .4);
});

Deno.test('ranked promotions merge at bounded intervals', () => {
  const ranked = rankPromotedPosts([
    { campaignId: 'c1', postId: 'p1', planKey: 'premium', planWeight: 4, active: true, targetMatches: true, frequencyCapped: false, pacingFactor: 1, qualityFactor: 1 },
  ], 1);
  const merged = mergePromotedPosts([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }, { id: 'p5' }, { id: 'p6' }], ranked);
  assertEquals(merged.map((post) => post.id), ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  assertEquals(merged[0].promotion_disclosure, 'Promoted');
});

Deno.test('merged output exposes only campaigns that were actually emitted', () => {
  const ranked = rankPromotedPosts([
    { campaignId: 'c1', postId: 'p1', planKey: 'premium', planWeight: 4, active: true, targetMatches: true, frequencyCapped: false, pacingFactor: 1, qualityFactor: 1 },
    { campaignId: 'c2', postId: 'missing', planKey: 'elite', planWeight: 5, active: true, targetMatches: true, frequencyCapped: false, pacingFactor: 1, qualityFactor: 1 },
  ], 2);
  const merged = mergePromotedPosts([{ id: 'p1' }, { id: 'p2' }], ranked);

  assertEquals(merged.filter((post) => post.is_promoted).map((post) => post.promotion_campaign_id), ['c1']);
});
