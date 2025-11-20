import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Bookmark, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SavedPosts = () => {
  const navigate = useNavigate();

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted pb-20">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Bookmark className="w-8 h-8 text-primary" />
                Saved Posts
              </h1>
            </div>
          </div>

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

export default SavedPosts;
