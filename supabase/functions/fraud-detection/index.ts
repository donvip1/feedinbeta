import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FraudCheckRequest {
  fingerprint: string;
  email?: string;
  phone?: string;
}

interface FraudCheckResponse {
  allowed: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  linkedAccounts: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP from headers
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    const { fingerprint, email, phone } = await req.json() as FraudCheckRequest;

    if (!fingerprint) {
      return new Response(
        JSON.stringify({ error: "Device fingerprint is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reasons: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let linkedAccounts = 0;

    // Check for existing accounts with same fingerprint
    const { data: fingerprintMatches, error: fpError } = await supabase
      .from('profiles')
      .select('id, username, account_status, created_at')
      .eq('signup_fingerprint', fingerprint)
      .not('account_status', 'eq', 'banned');

    if (fpError) {
      console.error('Fingerprint check error:', fpError);
    }

    if (fingerprintMatches && fingerprintMatches.length > 0) {
      linkedAccounts = fingerprintMatches.length;
      
      // Check if any linked accounts are active
      const activeAccounts = fingerprintMatches.filter(a => a.account_status === 'active');
      
      if (activeAccounts.length >= 1) {
        riskLevel = 'medium';
        reasons.push(`Device fingerprint linked to ${activeAccounts.length} existing account(s)`);
      }
      
      if (activeAccounts.length >= 3) {
        riskLevel = 'high';
        reasons.push('Multiple accounts detected from this device');
      }
    }

    // Check for existing accounts with same IP (within last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    if (clientIP !== 'unknown') {
      const { data: ipMatches, error: ipError } = await supabase
        .from('profiles')
        .select('id, username, account_status, created_at')
        .eq('registration_ip', clientIP)
        .gte('created_at', twentyFourHoursAgo)
        .not('account_status', 'eq', 'banned');

      if (ipError) {
        console.error('IP check error:', ipError);
      }

      if (ipMatches && ipMatches.length > 0) {
        if (ipMatches.length >= 2) {
          riskLevel = riskLevel === 'high' ? 'high' : 'medium';
          reasons.push(`${ipMatches.length} accounts created from this IP in the last 24 hours`);
        }
        
        if (ipMatches.length >= 5) {
          riskLevel = 'high';
          reasons.push('Excessive account creation from this IP address');
        }
      }
    }

    // Check phone number uniqueness if provided
    if (phone) {
      const { data: phoneMatches, error: phoneError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('phone_number', phone)
        .not('account_status', 'eq', 'banned');

      if (phoneError) {
        console.error('Phone check error:', phoneError);
      }

      if (phoneMatches && phoneMatches.length > 0) {
        riskLevel = 'high';
        reasons.push('Phone number is already registered to another account');
      }
    }

    // Check email domain patterns (disposable email detection)
    if (email) {
      const disposableDomains = [
        'tempmail.com', 'throwaway.email', 'guerrillamail.com', 
        'mailinator.com', '10minutemail.com', 'temp-mail.org'
      ];
      
      const emailDomain = email.split('@')[1]?.toLowerCase();
      if (emailDomain && disposableDomains.some(d => emailDomain.includes(d))) {
        riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
        reasons.push('Disposable email address detected');
      }
    }

    // Log the fraud check in user_identifiers for future reference
    if (riskLevel !== 'low') {
      // Store identifier for tracking
      await supabase
        .from('user_identifiers')
        .insert([
          {
            user_id: null, // Will be linked after signup if allowed
            identifier_type: 'fraud_check',
            identifier_value: JSON.stringify({ fingerprint, ip: clientIP, email }),
            is_flagged: riskLevel === 'high',
            flag_reason: reasons.join('; '),
          }
        ])
        .select()
        .maybeSingle();
    }

    // Determine if signup should be allowed
    // High risk = block, medium = warn but allow, low = allow
    const allowed = riskLevel !== 'high';

    // Log detailed reasons server-side only — never expose to client to prevent
    // phone number / IP / device enumeration via the anon-callable endpoint.
    if (reasons.length > 0) {
      console.log(`[fraud-detection] risk=${riskLevel} ip=${clientIP} reasons=${reasons.join('; ')}`);
    }

    // Return minimal information to the client
    const response = {
      allowed,
      riskLevel,
      // Generic message only — no enumeration of phone/IP/device counts
      reasons: allowed ? [] : ['Signup blocked. Please contact support if you believe this is an error.'],
      linkedAccounts: 0,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error('Fraud detection error:', error);
    return new Response(
      JSON.stringify({ 
        allowed: true, // Fail open to not block legitimate users
        riskLevel: 'low',
        reasons: [],
        linkedAccounts: 0,
        error: 'Fraud check failed, proceeding with caution'
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
