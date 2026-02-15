import { useSubscriptionFeatures } from './useSubscriptionFeatures';

/**
 * Check if the current user can create video livestreams.
 * Audio Spaces are available to all users.
 */
export const useLivestreamPermission = () => {
  const { features, isLoading } = useSubscriptionFeatures();

  return {
    canLivestream: features.canLivestream,
    tierLevel: features.creditTierLevel,
    isLoading,
  };
};
