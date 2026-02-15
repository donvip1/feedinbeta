import { useNavigation } from '@/context/NavigationContext';

/**
 * Hook to get the goBack function from NavigationContext.
 * Usage: const goBack = useGoBack();
 *        goBack('/fallback-route');
 */
export function useGoBack() {
  const { goBack } = useNavigation();
  return goBack;
}
