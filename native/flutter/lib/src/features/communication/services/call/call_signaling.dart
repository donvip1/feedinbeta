import '../../domain/call_session.dart';
import '../../domain/result.dart';

/// Control-plane signals a call can receive from the far side.
enum CallSignalKind { incoming, accepted, rejected, busy, cancelled, ended, timeout }

class CallSignal {
  const CallSignal(this.kind, this.session);
  final CallSignalKind kind;
  final CallSession session;
}

/// The provider-agnostic control plane: invite/accept/reject/busy/cancel/end
/// plus the stream of far-side signals. The Supabase adapter implements this
/// over the call-session tables + realtime (with the polling fallback);
/// tests use a fake.
abstract interface class CallSignaling {
  /// Far-side signals addressed to this device's user.
  Stream<CallSignal> get signals;

  /// Create the call row (status: inviting/ringing) and trigger the callee
  /// ring push. Must enforce one-active-call-per-conversation server-side.
  Future<Result<CallSession>> invite(CallSession session);

  Future<Result<void>> accept(String callId);
  Future<Result<void>> reject(String callId);

  /// Callee is already in another call.
  Future<Result<void>> busy(String callId);

  /// Caller cancels before answer.
  Future<Result<void>> cancel(String callId);

  /// Either side hangs up a connected call.
  Future<Result<void>> end(String callId, {required int durationSeconds});

  /// Nobody answered within the ring window.
  Future<Result<void>> markMissed(String callId);

  /// Fetch a call by id (killed-app CallKit accept path).
  Future<CallSession?> fetchCall(String callId);
}
