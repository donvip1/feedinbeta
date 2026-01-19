import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { action, assessmentId, answers, timeTaken } = await req.json();

    if (action === 'start') {
      // Start a new assessment attempt
      const { data: assessment } = await adminClient
        .from('course_assessments')
        .select('*, questions:assessment_questions(*)')
        .eq('id', assessmentId)
        .single();

      if (!assessment) {
        throw new Error('Assessment not found');
      }

      // Check max attempts
      const { count: attemptCount } = await adminClient
        .from('assessment_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('assessment_id', assessmentId)
        .eq('user_id', user.id);

      if (assessment.max_attempts && attemptCount && attemptCount >= assessment.max_attempts) {
        throw new Error(`Maximum attempts (${assessment.max_attempts}) reached`);
      }

      // Create attempt record
      const { data: attempt, error: attemptError } = await adminClient
        .from('assessment_attempts')
        .insert({
          user_id: user.id,
          assessment_id: assessmentId,
          started_at: new Date().toISOString(),
          total_questions: assessment.questions?.length || 0,
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Return questions without correct answers
      const questions = assessment.questions?.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        points: q.points,
        display_order: q.display_order,
      })).sort((a: any, b: any) => a.display_order - b.display_order);

      return new Response(
        JSON.stringify({ 
          success: true, 
          attempt, 
          questions,
          timeLimit: assessment.time_limit_minutes,
          passPercentage: assessment.pass_percentage,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'submit') {
      // Grade the assessment
      const { data: questions } = await adminClient
        .from('assessment_questions')
        .select('*')
        .eq('assessment_id', assessmentId);

      if (!questions || questions.length === 0) {
        throw new Error('No questions found');
      }

      let correctAnswers = 0;
      let totalPoints = 0;
      let earnedPoints = 0;

      const gradedAnswers: Record<string, { 
        selected: string; 
        correct: string; 
        isCorrect: boolean;
        explanation?: string;
      }> = {};

      for (const question of questions) {
        const userAnswer = answers[question.id];
        const correctOption = question.options?.find((o: any) => o.is_correct);
        const isCorrect = userAnswer === correctOption?.id;
        
        totalPoints += question.points || 1;
        
        if (isCorrect) {
          correctAnswers++;
          earnedPoints += question.points || 1;
        }

        gradedAnswers[question.id] = {
          selected: userAnswer,
          correct: correctOption?.id,
          isCorrect,
          explanation: question.explanation,
        };
      }

      const scorePercent = Math.round((earnedPoints / totalPoints) * 100);

      // Get assessment pass percentage
      const { data: assessment } = await adminClient
        .from('course_assessments')
        .select('pass_percentage, course_id, is_final_assessment')
        .eq('id', assessmentId)
        .single();

      const passed = scorePercent >= (assessment?.pass_percentage || 70);

      // Update attempt record
      const { data: updatedAttempt, error: updateError } = await adminClient
        .from('assessment_attempts')
        .update({
          completed_at: new Date().toISOString(),
          answers: gradedAnswers,
          correct_answers: correctAnswers,
          total_questions: questions.length,
          score_percent: scorePercent,
          passed,
          time_taken_seconds: timeTaken,
        })
        .eq('assessment_id', assessmentId)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        throw new Error('Failed to save results');
      }

      // If this is a final assessment and passed, mark course as completed
      if (passed && assessment?.is_final_assessment && assessment?.course_id) {
        await adminClient
          .from('course_enrollments')
          .update({
            is_completed: true,
            completed_at: new Date().toISOString(),
            progress_percent: 100,
          })
          .eq('course_id', assessment.course_id)
          .eq('user_id', user.id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          results: {
            scorePercent,
            correctAnswers,
            totalQuestions: questions.length,
            passed,
            gradedAnswers,
            timeTaken,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error: unknown) {
    console.error('Learn assessment error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});