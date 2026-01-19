import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PayoutRequest {
  action: 'calculate' | 'request' | 'process';
  instructorId?: string;
  payoutId?: string;
  payoutMethod?: string;
  payoutReference?: string;
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

    const { action, instructorId, payoutId, payoutMethod, payoutReference }: PayoutRequest = await req.json();

    // Verify the user is an instructor
    const { data: instructor, error: instructorError } = await supabase
      .from('instructors')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (instructorError || !instructor) {
      throw new Error('Not an instructor');
    }

    const INSTRUCTOR_SHARE = 0.70; // 70% goes to instructor
    const MINIMUM_PAYOUT = 1000; // Minimum 1000 credits for payout

    if (action === 'calculate') {
      // Calculate earnings from course enrollments
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select(`
          id,
          credits_paid,
          enrolled_at,
          course:courses!inner(
            id,
            title,
            instructor_id
          )
        `)
        .eq('course.instructor_id', instructor.id)
        .gte('enrolled_at', instructor.last_payout_at || '1970-01-01');

      if (enrollError) {
        throw new Error('Failed to fetch enrollments');
      }

      const totalCredits = (enrollments || []).reduce(
        (sum, e) => sum + (e.credits_paid || 0), 
        0
      );
      const instructorEarnings = Math.floor(totalCredits * INSTRUCTOR_SHARE);
      const platformFee = totalCredits - instructorEarnings;

      // Get pending payouts
      const { data: pendingPayouts } = await supabase
        .from('instructor_payouts')
        .select('amount_credits')
        .eq('instructor_id', instructor.id)
        .eq('status', 'pending');

      const pendingAmount = (pendingPayouts || []).reduce(
        (sum, p) => sum + p.amount_credits, 
        0
      );

      // Get lifetime earnings
      const { data: processedPayouts } = await supabase
        .from('instructor_payouts')
        .select('amount_credits')
        .eq('instructor_id', instructor.id)
        .eq('status', 'processed');

      const lifetimeEarnings = (processedPayouts || []).reduce(
        (sum, p) => sum + p.amount_credits, 
        0
      );

      return new Response(
        JSON.stringify({
          success: true,
          earnings: {
            periodStart: instructor.last_payout_at || instructor.created_at,
            periodEnd: new Date().toISOString(),
            totalEnrollments: enrollments?.length || 0,
            totalCreditsEarned: totalCredits,
            instructorShare: instructorEarnings,
            platformFee,
            availableForPayout: instructorEarnings - pendingAmount,
            pendingPayouts: pendingAmount,
            lifetimeEarnings,
            minimumPayout: MINIMUM_PAYOUT,
            canRequestPayout: (instructorEarnings - pendingAmount) >= MINIMUM_PAYOUT
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'request') {
      // Request a payout
      const { data: existingPending } = await supabase
        .from('instructor_payouts')
        .select('id')
        .eq('instructor_id', instructor.id)
        .eq('status', 'pending')
        .limit(1);

      if (existingPending && existingPending.length > 0) {
        throw new Error('You already have a pending payout request');
      }

      // Calculate available amount
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select(`
          credits_paid,
          course:courses!inner(instructor_id)
        `)
        .eq('course.instructor_id', instructor.id)
        .gte('enrolled_at', instructor.last_payout_at || '1970-01-01');

      const totalCredits = (enrollments || []).reduce(
        (sum, e) => sum + (e.credits_paid || 0), 
        0
      );
      const availableAmount = Math.floor(totalCredits * INSTRUCTOR_SHARE);

      if (availableAmount < MINIMUM_PAYOUT) {
        throw new Error(`Minimum payout is ${MINIMUM_PAYOUT} credits. You have ${availableAmount} available.`);
      }

      // Create payout request
      const { data: payout, error: payoutError } = await supabase
        .from('instructor_payouts')
        .insert({
          instructor_id: instructor.id,
          amount_credits: availableAmount,
          period_start: instructor.last_payout_at || instructor.created_at,
          period_end: new Date().toISOString(),
          status: 'pending',
          payout_method: payoutMethod || 'bank_transfer'
        })
        .select()
        .single();

      if (payoutError) {
        throw new Error('Failed to create payout request');
      }

      return new Response(
        JSON.stringify({
          success: true,
          payout: {
            id: payout.id,
            amount: payout.amount_credits,
            status: payout.status,
            createdAt: payout.created_at
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'process') {
      // Admin action to process a payout
      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !['admin', 'super_admin'].includes(profile.role || '')) {
        throw new Error('Admin access required');
      }

      if (!payoutId) {
        throw new Error('Payout ID required');
      }

      // Update payout status
      const { data: payout, error: updateError } = await supabase
        .from('instructor_payouts')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
          payout_reference: payoutReference
        })
        .eq('id', payoutId)
        .select()
        .single();

      if (updateError) {
        throw new Error('Failed to process payout');
      }

      // Update instructor's last payout date
      await supabase
        .from('instructors')
        .update({ last_payout_at: payout.period_end })
        .eq('id', payout.instructor_id);

      return new Response(
        JSON.stringify({
          success: true,
          payout: {
            id: payout.id,
            amount: payout.amount_credits,
            status: payout.status,
            processedAt: payout.processed_at
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Instructor payout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
