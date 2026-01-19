import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AptitudeAnswer {
  questionId: string;
  selectedOptionId: string;
}

interface GradeRequest {
  testId: string;
  answers: AptitudeAnswer[];
  timeTaken: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { testId, answers, timeTaken }: GradeRequest = await req.json();

    // 1. Fetch the test and questions
    const { data: test, error: testError } = await supabase
      .from('aptitude_tests')
      .select('*, aptitude_test_questions(*)')
      .eq('id', testId)
      .single();

    if (testError || !test) {
      throw new Error('Test not found');
    }

    const questions = test.aptitude_test_questions || [];

    // 2. Check credit cost and deduct if needed
    const creditCost = test.credit_cost || 10;
    
    const { data: userCredits, error: creditsError } = await supabase
      .rpc('get_user_credits', { p_user_id: user.id });

    if (creditsError || (userCredits || 0) < creditCost) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient credits',
          required: creditCost,
          available: userCredits || 0
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct credits
    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      amount: -creditCost,
      type: 'debit',
      description: `Aptitude Test: ${test.title}`,
      reference_type: 'aptitude_test',
      reference_id: testId
    });

    // 3. Grade the test
    let correctAnswers = 0;
    const gradedAnswers: Record<string, { 
      selected: string; 
      correct: string; 
      isCorrect: boolean;
      explanation?: string;
    }> = {};

    for (const question of questions) {
      const userAnswer = answers.find(a => a.questionId === question.id);
      const selectedOptionId = userAnswer?.selectedOptionId || '';
      const isCorrect = selectedOptionId === question.correct_option_id;
      
      if (isCorrect) {
        correctAnswers++;
      }

      gradedAnswers[question.id] = {
        selected: selectedOptionId,
        correct: question.correct_option_id,
        isCorrect,
        explanation: question.explanation
      };
    }

    const totalQuestions = questions.length;
    const scorePercent = Math.round((correctAnswers / totalQuestions) * 100);
    const passingScore = test.passing_score || 70;
    const passed = scorePercent >= passingScore;

    // 4. Generate career recommendations based on test type and score
    let recommendations: string[] = [];
    
    if (test.test_type === 'logical') {
      if (scorePercent >= 80) {
        recommendations = [
          'Software Engineering',
          'Data Science',
          'Research & Development',
          'Strategic Planning',
          'Systems Analysis'
        ];
      } else if (scorePercent >= 60) {
        recommendations = [
          'Business Analysis',
          'Project Management',
          'Quality Assurance',
          'Technical Writing'
        ];
      } else {
        recommendations = [
          'Consider improving logical reasoning skills',
          'Practice with more logic puzzles',
          'Take structured thinking courses'
        ];
      }
    } else if (test.test_type === 'verbal') {
      if (scorePercent >= 80) {
        recommendations = [
          'Content Writing',
          'Marketing & Communications',
          'Public Relations',
          'Law',
          'Journalism'
        ];
      } else if (scorePercent >= 60) {
        recommendations = [
          'Customer Service',
          'Sales',
          'Human Resources',
          'Teaching'
        ];
      } else {
        recommendations = [
          'Reading comprehension practice recommended',
          'Vocabulary building exercises',
          'Communication skills courses'
        ];
      }
    } else if (test.test_type === 'numerical') {
      if (scorePercent >= 80) {
        recommendations = [
          'Finance & Banking',
          'Data Analytics',
          'Accounting',
          'Actuarial Science',
          'Economics'
        ];
      } else if (scorePercent >= 60) {
        recommendations = [
          'Business Administration',
          'Supply Chain Management',
          'Operations Management'
        ];
      } else {
        recommendations = [
          'Mathematical skills improvement recommended',
          'Practice numerical reasoning',
          'Take quantitative analysis courses'
        ];
      }
    } else {
      // General aptitude
      if (scorePercent >= 80) {
        recommendations = [
          'Leadership Roles',
          'Consulting',
          'Entrepreneurship',
          'Product Management'
        ];
      } else if (scorePercent >= 60) {
        recommendations = [
          'Team Collaboration Roles',
          'Administrative Positions',
          'Technical Support'
        ];
      } else {
        recommendations = [
          'Focus on skill development',
          'Consider targeted training programs',
          'Retake test after preparation'
        ];
      }
    }

    // 5. Save the result
    const { data: result, error: resultError } = await supabase
      .from('aptitude_test_results')
      .insert({
        user_id: user.id,
        test_id: testId,
        score_percent: scorePercent,
        passed,
        correct_answers: correctAnswers,
        total_questions: totalQuestions,
        time_taken_seconds: timeTaken,
        answers: gradedAnswers,
        recommendations,
        started_at: new Date(Date.now() - timeTaken * 1000).toISOString(),
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (resultError) {
      console.error('Error saving result:', resultError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: {
          id: result?.id,
          scorePercent,
          passed,
          correctAnswers,
          totalQuestions,
          timeTaken,
          passingScore,
          gradedAnswers,
          recommendations,
          creditsDeducted: creditCost
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Learn aptitude error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
