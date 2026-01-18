import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Apple, Plus, X, Loader2, PieChart, Sparkles, Lightbulb, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { EnhancedMarkdownRenderer } from '@/components/ai/EnhancedMarkdownRenderer';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';

const CREDIT_COST = 5;

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

const QUICK_FOODS = [
  { name: 'Apple', quantity: '1 medium' },
  { name: 'Banana', quantity: '1 medium' },
  { name: 'Chicken Breast', quantity: '100g' },
  { name: 'Brown Rice', quantity: '1 cup cooked' },
  { name: 'Eggs', quantity: '2 large' },
  { name: 'Greek Yogurt', quantity: '1 cup' },
];

const NutritionCalculator = () => {
  const navigate = useNavigate();
  const { balance, hasEnoughCredits, checkAndDeductCredits } = useAIToolCredits({
    toolName: 'nutrition_calculator',
    creditCost: CREDIT_COST,
  });
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

  const addQuickFood = (food: typeof QUICK_FOODS[0]) => {
    setFoods([...foods, food]);
  };

  const removeFood = (index: number) => {
    setFoods(foods.filter((_, i) => i !== index));
    setNutrition(null);
  };

  const handleCalculate = async () => {
    if (foods.length === 0) {
      toast.error('Please add at least one food item');
      return;
    }

    const success = await checkAndDeductCredits();
    if (!success) return;

    setIsCalculating(true);
    try {
      const foodList = foods.map(f => `${f.quantity} of ${f.name}`).join(', ');
      
      const session = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Calculate the approximate nutrition for these foods: ${foodList}
              
              Provide the response in JSON format ONLY, no other text:
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
          systemPrompt: 'You are a nutrition calculator expert. Provide accurate nutritional information based on USDA food database values. Be precise with macronutrient calculations. Always include helpful suggestions for balanced nutrition. ONLY return valid JSON, no markdown or other text.'
        }),
      });

      if (!response.ok) throw new Error('Failed to calculate nutrition');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                }
              } catch {}
            }
          }
        }
      }

      if (fullContent) {
        const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setNutrition(parsed);
          toast.success('Nutrition calculated!');
        } else {
          throw new Error('Invalid response format');
        }
      }
    } catch (error) {
      console.error('Calculation error:', error);
      toast.error('Calculation failed. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  const getMacroPercentage = (macro: number, calories: number): number => {
    if (!calories) return 0;
    const macroCalories = macro === nutrition?.protein || macro === nutrition?.carbs 
      ? macro * 4 
      : macro * 9;
    return Math.round((macroCalories / calories) * 100);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Apple className="h-5 w-5 text-primary" />
              Nutrition Calculator
            </h1>
            <p className="text-sm text-muted-foreground">Track your food intake</p>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            {CREDIT_COST}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Quick Add */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="p-4">
              <Label className="font-semibold mb-3 block">Quick Add</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_FOODS.map((food, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => addQuickFood(food)}
                    className="text-xs"
                  >
                    + {food.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Add Foods */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-4">
              <div className="flex items-center gap-2">
                <Apple className="h-5 w-5 text-green-500" />
                <Label className="font-semibold">Add Foods</Label>
              </div>
            </div>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Input
                  value={currentFood}
                  onChange={(e) => setCurrentFood(e.target.value)}
                  placeholder="Food item (e.g., banana, chicken breast)"
                  className="h-12"
                  onKeyDown={(e) => e.key === 'Enter' && addFood()}
                />
                <div className="flex gap-2">
                  <Input
                    value={currentQuantity}
                    onChange={(e) => setCurrentQuantity(e.target.value)}
                    placeholder="Quantity (e.g., 1 cup, 100g)"
                    className="flex-1 h-12"
                  />
                  <Button onClick={addFood} size="icon" className="h-12 w-12">
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {foods.length > 0 && (
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {foods.map((food, index) => (
                      <motion.div 
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                      >
                        <div>
                          <span className="font-medium">{food.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">({food.quantity})</span>
                        </div>
                        <button 
                          onClick={() => removeFood(index)}
                          className="p-1 hover:bg-destructive/20 rounded"
                        >
                          <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button 
                onClick={handleCalculate} 
                disabled={isCalculating || foods.length === 0}
                className="w-full h-12 text-base"
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <PieChart className="h-5 w-5 mr-2" />
                    Calculate Nutrition
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {nutrition && (
            <>
              {/* Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 p-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-orange-500" />
                      Nutrition Summary
                    </h3>
                  </div>
                  <CardContent className="p-4">
                    <div className="text-center mb-6">
                      <motion.div 
                        className="text-5xl font-bold text-primary"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring' }}
                      >
                        {nutrition.totalCalories}
                      </motion.div>
                      <p className="text-muted-foreground">Total Calories</p>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="text-center p-3 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl">
                        <p className="text-2xl font-bold">{nutrition.protein}g</p>
                        <p className="text-xs text-muted-foreground">Protein</p>
                        <p className="text-xs text-red-500">{getMacroPercentage(nutrition.protein, nutrition.totalCalories)}%</p>
                      </div>
                      <div className="text-center p-3 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl">
                        <p className="text-2xl font-bold">{nutrition.carbs}g</p>
                        <p className="text-xs text-muted-foreground">Carbs</p>
                        <p className="text-xs text-blue-500">{getMacroPercentage(nutrition.carbs, nutrition.totalCalories)}%</p>
                      </div>
                      <div className="text-center p-3 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-xl">
                        <p className="text-2xl font-bold">{nutrition.fat}g</p>
                        <p className="text-xs text-muted-foreground">Fat</p>
                        <p className="text-xs text-yellow-500">{getMacroPercentage(nutrition.fat * 9 / 4, nutrition.totalCalories)}%</p>
                      </div>
                      <div className="text-center p-3 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl">
                        <p className="text-2xl font-bold">{nutrition.fiber}g</p>
                        <p className="text-xs text-muted-foreground">Fiber</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">Food Breakdown</h3>
                    <div className="space-y-2">
                      {nutrition.breakdown.map((item, index) => (
                        <motion.div 
                          key={index} 
                          className="p-3 bg-muted/50 rounded-lg"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <div className="font-medium">{item.food}</div>
                          <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                            <span className="text-orange-500">{item.calories} cal</span>
                            <span className="text-red-500">{item.protein}g P</span>
                            <span className="text-blue-500">{item.carbs}g C</span>
                            <span className="text-yellow-500">{item.fat}g F</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Suggestions */}
              {nutrition.suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-yellow-500" />
                        Nutrition Tips
                      </h3>
                      <ul className="space-y-2">
                        {nutrition.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-primary">💡</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Disclaimer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground text-center">
                      ⚠️ These are approximate values. For precise nutrition tracking, 
                      consult food packaging or a registered dietitian.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
};

export default NutritionCalculator;