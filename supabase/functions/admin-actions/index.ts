import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check admin permissions
    const { data: adminRole } = await supabaseService
      .from("user_roles")
      .select("*")
      .eq("user_id", user.id)
      .in("role", ["admin", "moderator", "developer", "super_admin"])
      .single();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isSuperAdmin = adminRole.role === "super_admin";
    const isDeveloper = adminRole.role === "developer" || isSuperAdmin;
    const isAdmin = adminRole.role === "admin" || isSuperAdmin;

    const requestData = await req.json();
    const { action, ...params } = requestData;

    // Log admin action
    const logAction = async (actionType: string, targetType: string, targetId?: string, targetUsername?: string, details?: any) => {
      await supabaseService.from("admin_action_logs").insert({
        admin_id: user.id,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId || undefined,
        target_username: targetUsername || undefined,
        details,
      });
    };

    switch (action) {
      // ============ P2P ORDER MANAGEMENT ============
      case "cancel_p2p_order": {
        if (!isDeveloper && !isAdmin && !adminRole.can_manage_p2p) {
          return new Response(
            JSON.stringify({ error: "No permission to manage P2P orders" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { transactionId, reason } = params;
        
        const { data: transaction, error: txError } = await supabaseService
          .from("p2p_transactions")
          .select("*")
          .eq("id", transactionId)
          .single();

        if (txError || !transaction) {
          throw new Error("Transaction not found");
        }

        if (transaction.status === "completed" || transaction.status === "cancelled") {
          throw new Error("Cannot cancel completed or already cancelled transaction");
        }

        // Refund credits to seller
        await supabaseService.from("credit_transactions").insert({
          user_id: transaction.seller_id,
          type: "refund",
          amount: transaction.credits_amount,
          description: `P2P order cancelled by admin: ${reason || "No reason provided"}`,
          related_id: transactionId,
        });

        // Update escrow and transaction
        await supabaseService
          .from("p2p_escrow")
          .update({ status: "refunded" })
          .eq("transaction_id", transactionId);

        await supabaseService
          .from("p2p_transactions")
          .update({ 
            status: "cancelled", 
            escrow_locked: false,
            cancellation_reason: `[Admin] ${reason || "Cancelled by administrator"}`,
            cancelled_by: user.id,
          })
          .eq("id", transactionId);

        await logAction("cancel_p2p_order", "p2p_transaction", transactionId, undefined, { reason });

        return new Response(
          JSON.stringify({ success: true, message: "Order cancelled successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "bulk_cancel_p2p_orders": {
        if (!isDeveloper && !isAdmin && !adminRole.can_manage_p2p) {
          return new Response(
            JSON.stringify({ error: "No permission to manage P2P orders" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { transactionIds, reason } = params;
        let cancelled = 0;
        let failed = 0;

        for (const transactionId of transactionIds) {
          try {
            const { data: transaction } = await supabaseService
              .from("p2p_transactions")
              .select("*")
              .eq("id", transactionId)
              .single();

            if (!transaction || transaction.status === "completed" || transaction.status === "cancelled") {
              failed++;
              continue;
            }

            await supabaseService.from("credit_transactions").insert({
              user_id: transaction.seller_id,
              type: "refund",
              amount: transaction.credits_amount,
              description: `P2P order cancelled by admin (bulk): ${reason || "No reason provided"}`,
              related_id: transactionId,
            });

            await supabaseService
              .from("p2p_escrow")
              .update({ status: "refunded" })
              .eq("transaction_id", transactionId);

            await supabaseService
              .from("p2p_transactions")
              .update({ 
                status: "cancelled", 
                escrow_locked: false,
                cancellation_reason: `[Admin Bulk] ${reason || "Cancelled by administrator"}`,
                cancelled_by: user.id,
              })
              .eq("id", transactionId);

            cancelled++;
          } catch {
            failed++;
          }
        }

        await logAction("bulk_cancel_p2p_orders", "p2p_transactions", undefined, undefined, { 
          count: transactionIds.length, 
          cancelled, 
          failed, 
          reason 
        });

        return new Response(
          JSON.stringify({ success: true, cancelled, failed }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_pending_p2p_orders": {
        if (!isDeveloper && !isAdmin && !adminRole.can_manage_p2p) {
          return new Response(
            JSON.stringify({ error: "No permission to view P2P orders" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { username, limit = 50 } = params;
        
        let query = supabaseService
          .from("p2p_transactions")
          .select(`
            *,
            buyer:profiles!buyer_id(display_name, username),
            seller:profiles!seller_id(display_name, username)
          `)
          .in("status", ["pending", "proof_submitted"])
          .order("created_at", { ascending: false })
          .limit(limit);

        if (username) {
          // First find user by username
          const { data: userProfile } = await supabaseService
            .from("profiles")
            .select("id")
            .eq("username", username)
            .single();

          if (userProfile) {
            query = query.or(`buyer_id.eq.${userProfile.id},seller_id.eq.${userProfile.id}`);
          }
        }

        const { data: orders, error } = await query;

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, orders }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ DISPUTE MANAGEMENT ============
      case "get_disputes": {
        if (!isDeveloper && !isAdmin && !adminRole.can_manage_disputes) {
          return new Response(
            JSON.stringify({ error: "No permission to view disputes" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { status = "open", limit = 50 } = params;
        
        const { data: disputes, error } = await supabaseService
          .from("p2p_disputes")
          .select(`
            *,
            transaction:p2p_transactions(
              credits_amount,
              price_usd,
              buyer:profiles!buyer_id(display_name, username),
              seller:profiles!seller_id(display_name, username)
            ),
            initiator:profiles!initiated_by(display_name, username),
            moderator:profiles!moderator_id(display_name, username)
          `)
          .eq("status", status)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, disputes }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "assign_dispute": {
        if (!isDeveloper && !isAdmin && !adminRole.can_manage_disputes) {
          return new Response(
            JSON.stringify({ error: "No permission to manage disputes" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { disputeId, moderatorId } = params;
        
        await supabaseService
          .from("p2p_disputes")
          .update({ 
            moderator_id: moderatorId || user.id,
            status: "in_review",
            updated_at: new Date().toISOString(),
          })
          .eq("id", disputeId);

        await logAction("assign_dispute", "p2p_dispute", disputeId, undefined, { moderatorId: moderatorId || user.id });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "resolve_dispute": {
        if (!isDeveloper && !isAdmin && !adminRole.can_manage_disputes) {
          return new Response(
            JSON.stringify({ error: "No permission to resolve disputes" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { disputeId, resolution, refundToBuyer, notes } = params;
        
        const { data: dispute } = await supabaseService
          .from("p2p_disputes")
          .select("*, transaction:p2p_transactions(*)")
          .eq("id", disputeId)
          .single();

        if (!dispute) throw new Error("Dispute not found");

        const transaction = dispute.transaction as any;

        if (refundToBuyer) {
          // Refund credits to buyer from escrow
          await supabaseService.from("credit_transactions").insert({
            user_id: transaction.buyer_id,
            type: "dispute_refund",
            amount: transaction.credits_amount,
            description: `Dispute resolved in buyer's favor: ${notes || ""}`,
            related_id: dispute.transaction_id,
          });
        } else {
          // Release credits to seller
          await supabaseService.from("credit_transactions").insert({
            user_id: transaction.seller_id,
            type: "dispute_release",
            amount: transaction.credits_amount,
            description: `Dispute resolved in seller's favor: ${notes || ""}`,
            related_id: dispute.transaction_id,
          });
        }

        // Update dispute
        await supabaseService
          .from("p2p_disputes")
          .update({ 
            status: "resolved",
            resolution,
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", disputeId);

        // Update transaction
        await supabaseService
          .from("p2p_transactions")
          .update({ 
            status: refundToBuyer ? "cancelled" : "completed",
            escrow_locked: false,
          })
          .eq("id", dispute.transaction_id);

        // Update escrow
        await supabaseService
          .from("p2p_escrow")
          .update({ status: refundToBuyer ? "refunded" : "released" })
          .eq("transaction_id", dispute.transaction_id);

        await logAction("resolve_dispute", "p2p_dispute", disputeId, undefined, { resolution, refundToBuyer, notes });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ USER ROLE MANAGEMENT ============
      case "get_admin_users": {
        if (!isDeveloper && !adminRole.can_manage_roles) {
          return new Response(
            JSON.stringify({ error: "No permission to view admin users" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: adminUsers, error } = await supabaseService
          .from("user_roles")
          .select(`
            *,
            user:profiles!user_id(display_name, username, avatar_url),
            assigner:profiles!assigned_by(display_name, username)
          `)
          .in("role", ["admin", "moderator", "developer"])
          .order("created_at", { ascending: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, users: adminUsers }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "assign_role": {
        if (!isDeveloper && !adminRole.can_manage_roles) {
          return new Response(
            JSON.stringify({ error: "No permission to assign roles" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { targetUserId, role, permissions, notes } = params;

        // Only developers can assign developer role
        if (role === "developer" && !isDeveloper) {
          return new Response(
            JSON.stringify({ error: "Only developers can assign developer role" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if user already has a role
        const { data: existingRole } = await supabaseService
          .from("user_roles")
          .select("id")
          .eq("user_id", targetUserId)
          .maybeSingle();

        const roleData = {
          user_id: targetUserId,
          role,
          can_manage_p2p: permissions?.canManageP2P ?? false,
          can_manage_disputes: permissions?.canManageDisputes ?? false,
          can_manage_users: permissions?.canManageUsers ?? false,
          can_manage_content: permissions?.canManageContent ?? false,
          can_view_analytics: permissions?.canViewAnalytics ?? false,
          can_manage_roles: permissions?.canManageRoles ?? false,
          assigned_by: user.id,
          notes,
          updated_at: new Date().toISOString(),
        };

        if (existingRole) {
          await supabaseService
            .from("user_roles")
            .update(roleData)
            .eq("id", existingRole.id);
        } else {
          await supabaseService
            .from("user_roles")
            .insert(roleData);
        }

        // Get username for logging
        const { data: targetProfile } = await supabaseService
          .from("profiles")
          .select("username")
          .eq("id", targetUserId)
          .single();

        await logAction("assign_role", "user_role", targetUserId, targetProfile?.username, { role, permissions });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "revoke_role": {
        if (!isDeveloper && !adminRole.can_manage_roles) {
          return new Response(
            JSON.stringify({ error: "No permission to revoke roles" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { targetUserId } = params;

        // Get target's current role
        const { data: targetRole } = await supabaseService
          .from("user_roles")
          .select("role")
          .eq("user_id", targetUserId)
          .single();

        // Only developers can revoke developer role
        if (targetRole?.role === "developer" && !isDeveloper) {
          return new Response(
            JSON.stringify({ error: "Only developers can revoke developer role" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabaseService
          .from("user_roles")
          .delete()
          .eq("user_id", targetUserId);

        const { data: targetProfile } = await supabaseService
          .from("profiles")
          .select("username")
          .eq("id", targetUserId)
          .single();

        await logAction("revoke_role", "user_role", targetUserId, targetProfile?.username, { previousRole: targetRole?.role });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "search_user": {
        const { username } = params;
        
        const { data: users, error } = await supabaseService
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .ilike("username", `%${username}%`)
          .limit(10);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, users }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_action_logs": {
        if (!isDeveloper && !isAdmin) {
          return new Response(
            JSON.stringify({ error: "No permission to view logs" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { limit = 50 } = params;

        const { data: logs, error } = await supabaseService
          .from("admin_action_logs")
          .select(`
            *,
            admin:profiles!admin_id(display_name, username)
          `)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, logs }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ SUBSCRIPTION MANAGEMENT ============
      case "get_user_subscription": {
        if (!isDeveloper && !isAdmin) {
          return new Response(
            JSON.stringify({ error: "No permission to view subscriptions" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { targetUserId } = params;

        const { data: sub } = await supabaseService
          .from("user_subscriptions")
          .select("*, subscription_tiers(*)")
          .eq("user_id", targetUserId)
          .eq("status", "active")
          .maybeSingle();

        return new Response(
          JSON.stringify({ success: true, subscription: sub }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "upgrade_user_plan": {
        if (!isDeveloper && !isAdmin) {
          return new Response(
            JSON.stringify({ error: "No permission to manage subscriptions" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { targetUserId, tierId, notes } = params;

        // Validate tier exists
        const { data: tier, error: tierError } = await supabaseService
          .from("subscription_tiers")
          .select("*")
          .eq("id", tierId)
          .eq("is_active", true)
          .single();

        if (tierError || !tier) {
          throw new Error("Invalid subscription tier");
        }

        // Deactivate any existing active subscription
        await supabaseService
          .from("user_subscriptions")
          .update({ status: "cancelled", cancel_at_period_end: true, updated_at: new Date().toISOString() })
          .eq("user_id", targetUserId)
          .eq("status", "active");

        // Create new subscription (admin-granted, no payment required)
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const { error: insertError } = await supabaseService
          .from("user_subscriptions")
          .insert({
            user_id: targetUserId,
            tier_id: tierId,
            status: "active",
            payment_provider: "admin_granted",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            cancel_at_period_end: false,
          });

        if (insertError) throw insertError;

        // Grant subscription credits if applicable
        if (tier.subscription_credits && tier.subscription_credits > 0) {
          await supabaseService.rpc("increment_credits", {
            p_user_id: targetUserId,
            p_amount: tier.subscription_credits,
          }).then(() => {}).catch(() => {
            // If RPC doesn't exist, try direct update
            return supabaseService
              .from("user_credits")
              .update({ balance: supabaseService.rpc ? undefined : tier.subscription_credits })
              .eq("user_id", targetUserId);
          });
        }

        // Get username for logging
        const { data: targetProfile } = await supabaseService
          .from("profiles")
          .select("username")
          .eq("id", targetUserId)
          .single();

        await logAction("upgrade_user_plan", "subscription", targetUserId, targetProfile?.username, { 
          tierName: tier.name, 
          tierId, 
          notes,
          credits: tier.subscription_credits 
        });

        return new Response(
          JSON.stringify({ success: true, tierName: tier.name }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error("Invalid action");
    }
  } catch (error: any) {
    console.error("Admin action error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
