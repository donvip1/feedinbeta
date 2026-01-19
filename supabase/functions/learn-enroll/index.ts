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

    // Create client with user's token to get user ID
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Create admin client for operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { courseId, isTrial = false } = await req.json();

    if (!courseId) {
      throw new Error('Course ID is required');
    }

    // Check if already enrolled
    const { data: existingEnrollment } = await adminClient
      .from('course_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingEnrollment) {
      return new Response(
        JSON.stringify({ success: true, message: 'Already enrolled', enrollment: existingEnrollment }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get course details
    const { data: course, error: courseError } = await adminClient
      .from('courses')
      .select('id, credit_cost, total_lessons, title')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      throw new Error('Course not found');
    }

    const creditCost = isTrial ? 0 : (course.credit_cost || 0);

    // Check and deduct credits if not trial and cost > 0
    if (!isTrial && creditCost > 0) {
      // Get user's credit balance
      const { data: userCredits } = await adminClient
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      const currentBalance = userCredits?.balance || 0;

      if (currentBalance < creditCost) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Insufficient credits', 
            required: creditCost, 
            available: currentBalance 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Record credit transaction
      const { error: transactionError } = await adminClient
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          amount: -creditCost,
          transaction_type: 'spent',
          description: `Enrolled in: ${course.title}`,
          metadata: { course_id: courseId, course_title: course.title }
        });

      if (transactionError) {
        console.error('Transaction error:', transactionError);
        throw new Error('Failed to process payment');
      }
    }

    // Create enrollment
    const { data: enrollment, error: enrollmentError } = await adminClient
      .from('course_enrollments')
      .insert({
        user_id: user.id,
        course_id: courseId,
        credits_paid: creditCost,
        is_trial: isTrial,
        total_lessons: course.total_lessons || 0,
        completed_lessons: 0,
        progress_percent: 0,
        last_accessed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (enrollmentError) {
      console.error('Enrollment error:', enrollmentError);
      throw new Error('Failed to create enrollment');
    }

    // Update course total_enrolled count
    await adminClient.rpc('increment_course_enrolled', { course_id: courseId });

    return new Response(
      JSON.stringify({ success: true, enrollment }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Learn enroll error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});