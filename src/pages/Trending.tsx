import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/navigation/BottomNav';
import { TrendingUp, ArrowLeft } from 'lucide-react';

const Trending = () => {
  const navigate = useNavigate();

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => navigate('/feed')}
                  variant="ghost"
                  size="icon"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  Trending
                </h1>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground text-center">
              Post system has been completely removed
            </p>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default Trending;
