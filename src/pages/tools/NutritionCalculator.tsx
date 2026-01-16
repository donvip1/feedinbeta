import { useState } from 'react';
import { ArrowLeft, Apple, Plus, X, Loader2, PieChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';

interface FoodItem {
  name: string;
  quantity: string;
}

interface NutritionData {
  totalCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  breakdown: { food: string; calories: number; protein: number; carbs: number; fat: number }[];
  suggestions: string[];
}

const NutritionCalculator = () => {
  const navigate = useNavigate();
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [currentFood, setCurrentFood] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [nutrition, setNutrition] = useState<NutritionData | null>(null);

  const addFood = () => {
    if (currentFood.trim()) {
      setFoods([...foods, { 
        name: currentFood.trim(), 
        quantity: currentQuantity.trim() || '1 serving' 
      }]);
      setCurrentFood('');
      setCurrentQuantity('');
    }
  };

  const removeFood = (index: number) => {
    setFoods(foods.filter((_, i) => i !== index));
  };

  const handleCalculate = async () => {
    if (foods.length === 0) {
      toast.error('Please add at least one food item');
      return;
    }

    setIsCalculating(true);
    try {
      const foodList = foods.map(f => `${f.quantity} of ${f.name}`).join(', ');
      
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Calculate the approximate nutrition for these foods: ${foodList}
              
              Provide the response in JSON format:
              {
                "totalCalories": 0,
                "protein": 0,
                "carbs": 0,
                "fat": 0,
                "fiber": 0,
                "breakdown": [
                  { "food": "Food name", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }
                ],
                "suggestions": ["Nutrition suggestion 1", "Suggestion 2"]
              }
              
              Use approximate values based on common food databases. All values in grams except calories.`
            }
          ],
          systemPrompt: 'You are a nutrition calculator. Provide approximate nutritional information based on common food databases. Be accurate but note these are estimates.'
        }
      });

      if (error) throw error;

      const content = data?.choices?.[0]?.message?.content || data?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setNutrition(parsed);
          toast.success('Nutrition calculated!');
        }
      }
    } catch (error) {
      console.error('Calculation error:', error);
      toast.error('Calculation failed. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Nutrition Calculator</h1>
            <p className="text-sm text-muted-foreground">Track your food intake</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Apple className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Add Foods</h3>
            </div>

            <div className="space-y-2">
              <Input
                value={currentFood}
                onChange={(e) => setCurrentFood(e.target.value)}
                placeholder="Food item (e.g., banana, chicken breast)"
              />
              <div className="flex gap-2">
                <Input
                  value={currentQuantity}
                  onChange={(e) => setCurrentQuantity(e.target.value)}
                  placeholder="Quantity (e.g., 1 cup, 100g)"
                  className="flex-1"
                />
                <Button onClick={addFood} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {foods.length > 0 && (
              <div className="space-y-2">
                {foods.map((food, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded"
                  >
                    <span className="text-sm">
                      {food.quantity} - {food.name}
                    </span>
                    <button onClick={() => removeFood(index)}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button 
              onClick={handleCalculate} 
              disabled={isCalculating || foods.length === 0}
              className="w-full"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <PieChart className="h-4 w-4 mr-2" />
                  Calculate Nutrition
                </>
              )}
            </Button>
          </div>
        </Card>

        {nutrition && (
          <>
            {/* Summary Card */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Nutrition Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-orange-500/20 rounded-lg">
                  <p className="text-2xl font-bold">{nutrition.totalCalories}</p>
                  <p className="text-xs text-muted-foreground">Calories</p>
                </div>
                <div className="text-center p-3 bg-red-500/20 rounded-lg">
                  <p className="text-2xl font-bold">{nutrition.protein}g</p>
                  <p className="text-xs text-muted-foreground">Protein</p>
                </div>
                <div className="text-center p-3 bg-blue-500/20 rounded-lg">
                  <p className="text-2xl font-bold">{nutrition.carbs}g</p>
                  <p className="text-xs text-muted-foreground">Carbs</p>
                </div>
                <div className="text-center p-3 bg-yellow-500/20 rounded-lg">
                  <p className="text-2xl font-bold">{nutrition.fat}g</p>
                  <p className="text-xs text-muted-foreground">Fat</p>
                </div>
              </div>
              <div className="mt-3 text-center p-2 bg-green-500/20 rounded-lg">
                <p className="text-lg font-bold">{nutrition.fiber}g Fiber</p>
              </div>
            </Card>

            {/* Breakdown */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Food Breakdown</h3>
              <div className="space-y-2">
                {nutrition.breakdown.map((item, index) => (
                  <div key={index} className="p-2 bg-muted/50 rounded text-sm">
                    <div className="font-medium">{item.food}</div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      <span>{item.calories} cal</span>
                      <span>{item.protein}g protein</span>
                      <span>{item.carbs}g carbs</span>
                      <span>{item.fat}g fat</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Suggestions */}
            {nutrition.suggestions.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Suggestions</h3>
                <ul className="space-y-2">
                  {nutrition.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-primary">💡</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="p-4 bg-muted/50">
              <p className="text-xs text-muted-foreground text-center">
                Note: These are approximate values. For precise nutrition tracking, 
                consult food packaging or a nutritionist.
              </p>
            </Card>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default NutritionCalculator;
