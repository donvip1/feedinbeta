import { Skeleton } from '@/components/ui/skeleton';

export const FeedSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border h-16" />
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const MessagesSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border h-16" />
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="grid md:grid-cols-3 gap-4 h-[calc(100vh-120px)]">
        <div className="md:col-span-1 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between p-4 border-b">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="space-y-4 px-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className={`h-16 ${i % 2 === 0 ? 'w-64' : 'w-48'} rounded-2xl`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const ProfileSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border h-16" />
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <Skeleton className="w-24 h-24 rounded-full" />
          <div className="space-y-2 text-center">
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center space-y-2">
              <Skeleton className="h-8 w-16 mx-auto" />
              <Skeleton className="h-4 w-20 mx-auto" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const SettingsSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border h-16" />
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 bg-card rounded-lg">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

export const GenericPageSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border h-16" />
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ))}
      </div>
    </div>
  </div>
);