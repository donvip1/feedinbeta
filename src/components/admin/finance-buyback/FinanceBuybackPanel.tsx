import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertCircle,
  Banknote,
  Check,
  Clock3,
  Loader2,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const BUYBACK_QUERY_KEY = ["admin-finance-credit-buybacks"] as const;

type BuybackStatus = "pending" | "completed" | "rejected" | "canceled";

interface BuybackProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface FinanceBuybackRow {
  id: string;
  user_id: string;
  credits_amount: number;
  usd_amount_cents: number | null;
  external_payment_reference: string | null;
  notes: string | null;
  status: BuybackStatus;
  requested_at: string;
  updated_at: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  rejected_at: string | null;
  canceled_at: string | null;
}

interface FinanceBuybackRequest extends FinanceBuybackRow {
  profile: BuybackProfile | null;
}

interface FinanceBuybackPanelProps {
  canManageBuybacks: boolean;
}

type BuybackAction =
  | { type: "complete"; request: FinanceBuybackRequest }
  | { type: "reject"; request: FinanceBuybackRequest }
  | null;

function parseUsdToCents(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [dollars, cents = ""] = normalized.split(".");
  const amount = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function formatUsd(cents: number | null): string {
  if (cents === null) return "Not set";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatRequestDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : format(date, "MMM d, yyyy, HH:mm");
}

function getResolvedAt(request: FinanceBuybackRequest): string | null {
  return request.completed_at
    ?? request.rejected_at
    ?? request.canceled_at
    ?? request.reviewed_at
    ?? request.updated_at
    ?? request.requested_at;
}

function RequestUser({ request }: { request: FinanceBuybackRequest }) {
  const displayName = request.profile?.display_name || request.profile?.username || "Unknown user";
  const username = request.profile?.username ? `@${request.profile.username}` : request.user_id.slice(0, 8);

  return (
    <div className="flex min-w-[180px] items-center gap-2.5">
      <Avatar className="h-8 w-8">
        <AvatarImage src={request.profile?.avatar_url ?? undefined} alt="" />
        <AvatarFallback className="text-xs">
          {request.profile?.username?.slice(0, 1).toUpperCase() ?? <UserRound className="h-3.5 w-3.5" />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{displayName}</p>
        <p className="truncate text-xs text-muted-foreground">{username}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BuybackStatus }) {
  if (status === "completed") {
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">
        Completed
      </Badge>
    );
  }

  if (status === "rejected") {
    return <Badge variant="destructive">Rejected</Badge>;
  }

  if (status === "canceled") {
    return <Badge variant="outline">Canceled</Badge>;
  }

  return (
    <Badge variant="secondary" className="gap-1">
      <Clock3 className="h-3 w-3" />
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2" aria-label="Loading buyback requests">
      {[0, 1, 2].map((row) => (
        <div key={row} className="grid min-h-16 grid-cols-[1.4fr_0.7fr_0.8fr_1fr] items-center gap-4 border-b px-3 py-2 last:border-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-28 justify-self-end" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ pending }: { pending: boolean }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center px-4 text-center">
      {pending ? (
        <Check className="mb-2 h-7 w-7 text-muted-foreground" />
      ) : (
        <Clock3 className="mb-2 h-7 w-7 text-muted-foreground" />
      )}
      <p className="text-sm font-medium">{pending ? "No pending buybacks" : "No recent buybacks"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {pending ? "New finance requests will appear here." : "Completed and rejected requests will appear here."}
      </p>
    </div>
  );
}

export function FinanceBuybackPanel({ canManageBuybacks }: FinanceBuybackPanelProps) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<BuybackAction>(null);
  const [usdAmount, setUsdAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");

  const buybacksQuery = useQuery({
    queryKey: BUYBACK_QUERY_KEY,
    queryFn: async () => {
      const [pendingResult, recentResult] = await Promise.all([
        supabase
          .from("finance_credit_buyback_requests" as never)
          .select(
            "id, user_id, credits_amount, usd_amount_cents, external_payment_reference, notes, status, requested_at, reviewed_at, completed_at, rejected_at, canceled_at, updated_at",
          )
          .eq("status", "pending")
          .order("requested_at", { ascending: true })
          .limit(50),
        supabase
          .from("finance_credit_buyback_requests" as never)
          .select(
            "id, user_id, credits_amount, usd_amount_cents, external_payment_reference, notes, status, requested_at, reviewed_at, completed_at, rejected_at, canceled_at, updated_at",
          )
          .neq("status", "pending")
          .order("updated_at", { ascending: false })
          .limit(25),
      ]);

      if (pendingResult.error) throw pendingResult.error;
      if (recentResult.error) throw recentResult.error;

      const rawPending = (pendingResult.data ?? []) as unknown as FinanceBuybackRow[];
      const rawRecent = (recentResult.data ?? []) as unknown as FinanceBuybackRow[];
      const userIds = Array.from(
        new Set([...rawPending, ...rawRecent].map((row) => row.user_id)),
      );

      const profiles = new Map<string, BuybackProfile>();
      if (userIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds);

        if (profilesError) throw profilesError;
        for (const profile of profileRows ?? []) profiles.set(profile.id, profile);
      }

      return {
        pending: rawPending.map((row) => ({ ...row, profile: profiles.get(row.user_id) ?? null })),
        recent: rawRecent.map((row) => ({ ...row, profile: profiles.get(row.user_id) ?? null })),
      };
    },
    staleTime: 15_000,
  });

  const closeDialog = () => {
    setAction(null);
    setUsdAmount("");
    setPaymentReference("");
    setNotes("");
  };

  const refreshBuybacks = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: BUYBACK_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["finance-buybacks"] }),
      queryClient.invalidateQueries({ queryKey: ["platform-wallet"] }),
      queryClient.invalidateQueries({ queryKey: ["credit-statistics"] }),
      queryClient.invalidateQueries({ queryKey: ["platform-transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["user-credits"] }),
      queryClient.invalidateQueries({ queryKey: ["credit-transactions"] }),
    ]);
  };

  const completeMutation = useMutation({
    mutationFn: async ({ requestId, usdAmountCents, reference, actionNotes }: {
      requestId: string;
      usdAmountCents: number;
      reference: string;
      actionNotes: string;
    }) => {
      const { error } = await supabase.rpc("admin_complete_finance_buyback" as never, {
        p_request_id: requestId,
        p_usd_amount_cents: usdAmountCents,
        p_external_payment_reference: reference,
        p_notes: actionNotes || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Buyback marked as completed");
      closeDialog();
      await refreshBuybacks();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to complete buyback");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, actionNotes }: { requestId: string; actionNotes: string }) => {
      const { error } = await supabase.rpc("admin_reject_finance_buyback" as never, {
        p_request_id: requestId,
        p_notes: actionNotes,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Buyback rejected");
      closeDialog();
      await refreshBuybacks();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reject buyback");
    },
  });

  const usdAmountCents = useMemo(() => parseUsdToCents(usdAmount), [usdAmount]);
  const mutationPending = completeMutation.isPending || rejectMutation.isPending;
  const canConfirmComplete = usdAmountCents !== null && paymentReference.trim().length > 0;
  const canConfirmReject = notes.trim().length > 0;

  const openAction = (nextAction: NonNullable<BuybackAction>) => {
    setAction(nextAction);
    setUsdAmount(nextAction.request.usd_amount_cents ? (nextAction.request.usd_amount_cents / 100).toFixed(2) : "");
    setPaymentReference("");
    setNotes("");
  };

  const renderPendingRows = () => {
    const requests = buybacksQuery.data?.pending ?? [];
    if (requests.length === 0) return <EmptyState pending />;

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-left">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="h-9 px-3 font-medium">User</th>
              <th className="h-9 px-3 font-medium">Credits</th>
              <th className="h-9 px-3 font-medium">Requested</th>
              <th className="h-9 px-3 font-medium">Submitted</th>
              <th className="h-9 px-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-b last:border-0">
                <td className="px-3 py-2.5"><RequestUser request={request} /></td>
                <td className="px-3 py-2.5 text-sm font-semibold tabular-nums">
                  {request.credits_amount.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-sm tabular-nums">{formatUsd(request.usd_amount_cents)}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatRequestDate(request.requested_at)}</td>
                <td className="px-3 py-2.5">
                  {canManageBuybacks ? (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openAction({ type: "reject", request })}>
                        <X className="mr-1 h-3.5 w-3.5" />
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => openAction({ type: "complete", request })}>
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Complete
                      </Button>
                    </div>
                  ) : (
                    <p className="text-right text-xs text-muted-foreground">View only</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderRecentRows = () => {
    const requests = buybacksQuery.data?.recent ?? [];
    if (requests.length === 0) return <EmptyState pending={false} />;

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="h-9 px-3 font-medium">User</th>
              <th className="h-9 px-3 font-medium">Status</th>
              <th className="h-9 px-3 font-medium">Credits</th>
              <th className="h-9 px-3 font-medium">Payout</th>
              <th className="h-9 px-3 font-medium">Details</th>
              <th className="h-9 px-3 font-medium">Resolved</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-b last:border-0">
                <td className="px-3 py-2.5"><RequestUser request={request} /></td>
                <td className="px-3 py-2.5"><StatusBadge status={request.status} /></td>
                <td className="px-3 py-2.5 text-sm font-semibold tabular-nums">
                  {request.credits_amount.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-sm tabular-nums">{formatUsd(request.usd_amount_cents)}</td>
                <td className="max-w-56 px-3 py-2.5 text-xs text-muted-foreground">
                  <p className="truncate" title={request.external_payment_reference ?? undefined}>
                    {request.external_payment_reference || "-"}
                  </p>
                  {request.notes && (
                    <p className="mt-0.5 truncate" title={request.notes}>{request.notes}</p>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatRequestDate(getResolvedAt(request))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <Card className="border-emerald-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Banknote className="h-5 w-5 text-emerald-600" />
                Finance Credit Buybacks
              </CardTitle>
              <CardDescription>Review credit returns and record external payouts.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="whitespace-nowrap">
                {buybacksQuery.data?.pending.length ?? 0} pending
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void buybacksQuery.refetch()}
                disabled={buybacksQuery.isFetching}
                title="Refresh buyback requests"
              >
                <RefreshCw className={`h-4 w-4 ${buybacksQuery.isFetching ? "animate-spin" : ""}`} />
                <span className="sr-only">Refresh buyback requests</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {buybacksQuery.isLoading ? (
            <div className="overflow-hidden rounded-md border"><LoadingRows /></div>
          ) : buybacksQuery.isError ? (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-destructive/30 bg-destructive/5 px-4 text-center">
              <AlertCircle className="mb-2 h-7 w-7 text-destructive" />
              <p className="text-sm font-medium">Could not load buyback requests</p>
              <p className="mt-1 max-w-lg text-xs text-muted-foreground">
                {buybacksQuery.error instanceof Error ? buybacksQuery.error.message : "The finance queue is unavailable."}
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void buybacksQuery.refetch()}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Try again
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="pending">
              <TabsList className="grid w-full grid-cols-2 sm:w-72">
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="recent">Recent</TabsTrigger>
              </TabsList>
              <TabsContent value="pending" className="mt-3 overflow-hidden rounded-md border">
                {renderPendingRows()}
              </TabsContent>
              <TabsContent value="recent" className="mt-3 overflow-hidden rounded-md border">
                {renderRecentRows()}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={action?.type === "complete"} onOpenChange={(open) => !open && !mutationPending && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this buyback?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm the external payout for {action?.request.credits_amount.toLocaleString() ?? 0} returned credits.
              This action finalizes the request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid gap-2">
              <Label htmlFor="buyback-usd-amount">USD amount paid</Label>
              <Input
                id="buyback-usd-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={usdAmount}
                onChange={(event) => setUsdAmount(event.target.value)}
                disabled={mutationPending}
                aria-invalid={usdAmount.length > 0 && usdAmountCents === null}
              />
              {usdAmount.length > 0 && usdAmountCents === null && (
                <p className="text-xs text-destructive">Enter a positive USD amount with no more than two decimal places.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="buyback-payment-reference">External payment reference</Label>
              <Input
                id="buyback-payment-reference"
                placeholder="Bank or provider reference"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                disabled={mutationPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="buyback-complete-notes">Notes (optional)</Label>
              <Textarea
                id="buyback-complete-notes"
                className="min-h-20 resize-none"
                placeholder="Internal payout notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={mutationPending}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutationPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirmComplete || mutationPending}
              onClick={(event) => {
                event.preventDefault();
                if (action?.type !== "complete" || usdAmountCents === null) return;
                completeMutation.mutate({
                  requestId: action.request.id,
                  usdAmountCents,
                  reference: paymentReference.trim(),
                  actionNotes: notes.trim(),
                });
              }}
            >
              {completeMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              Confirm completion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={action?.type === "reject"} onOpenChange={(open) => !open && !mutationPending && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this buyback?</AlertDialogTitle>
            <AlertDialogDescription>
              The request will be closed without an external payout. Add a reason for the finance audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-1">
            <Label htmlFor="buyback-rejection-notes">Rejection reason</Label>
            <Textarea
              id="buyback-rejection-notes"
              className="min-h-24 resize-none"
              placeholder="Reason for rejecting this request"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={mutationPending}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutationPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!canConfirmReject || mutationPending}
              onClick={(event) => {
                event.preventDefault();
                if (action?.type !== "reject") return;
                rejectMutation.mutate({ requestId: action.request.id, actionNotes: notes.trim() });
              }}
            >
              {rejectMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <X className="mr-1.5 h-4 w-4" />}
              Confirm rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
