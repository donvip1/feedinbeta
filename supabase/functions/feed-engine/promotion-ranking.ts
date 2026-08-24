export interface PromotionCandidate {
  campaignId: string;
  postId: string;
  planKey: string;
  planWeight: number;
  active: boolean;
  targetMatches: boolean;
  frequencyCapped: boolean;
  pacingFactor: number;
  qualityFactor: number;
}

export interface RankedPromotedPost {
  postId: string;
  campaignId: string;
  score: number;
  disclosure: 'Promoted';
}

export function promotionScore(input: PromotionCandidate): number {
  if (!input.active || !input.targetMatches || input.frequencyCapped) return 0;
  return input.planWeight * input.pacingFactor * input.qualityFactor;
}

export function rankPromotedPosts(
  candidates: PromotionCandidate[],
  maxCount: number,
): RankedPromotedPost[] {
  return candidates
    .map((candidate) => ({
      candidate,
      score: promotionScore(candidate),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, maxCount))
    .map(({ candidate, score }) => ({
      postId: candidate.postId,
      campaignId: candidate.campaignId,
      score,
      disclosure: 'Promoted' as const,
    }));
}

export function mergePromotedPosts<T extends { id: string }>(
  organic: T[],
  promoted: RankedPromotedPost[],
): Array<T & { is_promoted?: boolean; promotion_campaign_id?: string; promotion_disclosure?: string }> {
  const promotedByPost = new Map(promoted.map((item) => [item.postId, item]));
  const promotedOrganic = organic
    .filter((post) => promotedByPost.has(post.id))
    .sort((a, b) => (promotedByPost.get(b.id)?.score ?? 0) - (promotedByPost.get(a.id)?.score ?? 0));
  const organicOnly = organic.filter((post) => !promotedByPost.has(post.id));
  const output: Array<T & { is_promoted?: boolean; promotion_campaign_id?: string; promotion_disclosure?: string }> = [];
  let promotedIndex = 0;
  let organicIndex = 0;
  while (promotedIndex < promotedOrganic.length || organicIndex < organicOnly.length) {
    if (promotedIndex < promotedOrganic.length) {
      const post = promotedOrganic[promotedIndex++];
      const signal = promotedByPost.get(post.id)!;
      output.push({ ...post, is_promoted: true, promotion_campaign_id: signal.campaignId, promotion_disclosure: signal.disclosure });
    }
    for (let i = 0; i < 4 && organicIndex < organicOnly.length; i++) output.push(organicOnly[organicIndex++]);
  }
  return output;
}
