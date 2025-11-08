# Route Transition & Navigation Components

This directory contains components for handling route transitions, loading states, and browser navigation.

## Components

### NavigationProgress
Shows a progress bar at the top of the screen during route transitions.

```tsx
import { NavigationProgress } from '@/components/routing/NavigationProgress';

// Add to your App.tsx inside BrowserRouter
<NavigationProgress />
```

### ScrollRestoration
Automatically saves and restores scroll positions when navigating back/forward.

```tsx
import { ScrollRestoration } from '@/components/routing/ScrollRestoration';

// Add to your App.tsx inside BrowserRouter
<ScrollRestoration />
```

### RouteTransition
Wraps route content to show loading states and smooth transitions.

```tsx
import { RouteTransition } from '@/components/routing/RouteTransition';

<RouteTransition>
  <YourPageComponent />
</RouteTransition>
```

### Page Skeletons
Pre-built skeleton screens for different page types:

```tsx
import {
  FeedSkeleton,
  MessagesSkeleton,
  ProfileSkeleton,
  SettingsSkeleton,
  GenericPageSkeleton
} from '@/components/routing/PageSkeletons';

// Use directly in your components
{isLoading && <FeedSkeleton />}
```

## Hooks

### useRouteLoading
Detects route changes and returns loading state.

```tsx
import { useRouteLoading } from '@/hooks/useRouteLoading';

function MyComponent() {
  const isLoading = useRouteLoading(200); // 200ms delay
  
  if (isLoading) {
    return <Skeleton />;
  }
  
  return <YourContent />;
}
```

## Browser Back/Forward Navigation

The ScrollRestoration component automatically handles:
- Saving scroll position before navigation
- Restoring scroll position on back/forward
- Scrolling to top on new page navigation

No additional configuration needed! The component works automatically with React Router's navigation state.

## Features

- ✅ Smooth page transitions with fade-in animations
- ✅ Loading progress bar for visual feedback
- ✅ Automatic scroll position restoration
- ✅ Page-specific skeleton screens
- ✅ Browser back/forward button support
- ✅ Prevents layout shift during transitions
