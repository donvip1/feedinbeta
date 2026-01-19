import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { enrollmentId, courseId } = await req.json()

    if (!enrollmentId || !courseId) {
      throw new Error('Enrollment ID and Course ID are required')
    }

    // Verify enrollment exists and is completed
    const { data: enrollment, error: enrollmentError } = await supabaseClient
      .from('course_enrollments')
      .select(`
        *,
        course:courses(
          id,
          title,
          course_type,
          instructor:instructors(
            id,
            profiles:profiles(display_name)
          )
        )
      `)
      .eq('id', enrollmentId)
      .eq('user_id', user.id)
      .eq('is_completed', true)
      .single()

    if (enrollmentError || !enrollment) {
      throw new Error('Enrollment not found or course not completed')
    }

    // Check if certificate already exists
    const { data: existingCert } = await supabaseClient
      .from('certificates')
      .select('id, certificate_number')
      .eq('enrollment_id', enrollmentId)
      .single()

    if (existingCert) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          certificate_number: existingCert.certificate_number,
          message: 'Certificate already exists'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate unique certificate number
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    const certificateNumber = `FDN-${timestamp}-${random}`

    // Determine certificate type based on course type
    const certificateType = enrollment.course?.course_type === 'diploma' ? 'diploma' : 'certificate'

    // Get user profile for certificate
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('display_name, username')
      .eq('id', user.id)
      .single()

    const recipientName = profile?.display_name || profile?.username || 'Student'
    const courseTitle = enrollment.course?.title || 'Course'
    const instructorName = enrollment.course?.instructor?.profiles?.display_name || 'Instructor'

    // Create certificate metadata
    const metadata = {
      course_title: courseTitle,
      instructor_name: instructorName,
      recipient_name: recipientName,
      completion_date: enrollment.completed_at || new Date().toISOString(),
      course_type: enrollment.course?.course_type,
      credits_paid: enrollment.credits_paid || 0,
    }

    // Insert certificate record
    const { data: certificate, error: certError } = await supabaseClient
      .from('certificates')
      .insert({
        user_id: user.id,
        course_id: courseId,
        enrollment_id: enrollmentId,
        certificate_number: certificateNumber,
        certificate_type: certificateType,
        issue_date: new Date().toISOString(),
        is_verified: true,
        metadata,
      })
      .select()
      .single()

    if (certError) {
      console.error('Certificate creation error:', certError)
      throw new Error('Failed to create certificate')
    }

    // Update enrollment with certificate reference
    await supabaseClient
      .from('course_enrollments')
      .update({ certificate_id: certificate.id })
      .eq('id', enrollmentId)

    // Create notification for certificate earned
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'certificate_earned',
        title: 'Certificate Earned! 🎓',
        message: `Congratulations! You've earned a ${certificateType} for completing "${courseTitle}"`,
        related_id: certificate.id,
        related_type: 'certificate',
      })

    return new Response(
      JSON.stringify({
        success: true,
        certificate_number: certificateNumber,
        certificate_id: certificate.id,
        certificate_type: certificateType,
        message: 'Certificate generated successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error generating certificate:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
