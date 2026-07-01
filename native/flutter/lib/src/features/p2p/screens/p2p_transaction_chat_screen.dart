import 'package:flutter/material.dart';

import '../data/p2p_models.dart';
import '../data/p2p_remote_data_source.dart';
import '../p2p_theme.dart';
import '../widgets/p2p_common.dart';

/// Per-transaction chat thread between buyer and seller, ported from the web
/// `P2PChat`. Text messages only (the live `p2p_chat_messages` table has no
/// media columns — see backend gaps). Role badges label who is the buyer/seller.
class P2PTransactionChatScreen extends StatefulWidget {
  const P2PTransactionChatScreen({
    super.key,
    required this.dataSource,
    required this.transaction,
    required this.currentUserId,
  });

  final P2PRemoteDataSource dataSource;
  final P2PTransaction transaction;
  final String currentUserId;

  @override
  State<P2PTransactionChatScreen> createState() =>
      _P2PTransactionChatScreenState();
}

class _P2PTransactionChatScreenState extends State<P2PTransactionChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  late Future<List<P2PChatMessage>> _messagesFuture;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _messagesFuture = widget.dataSource.fetchChat(widget.transaction.id);
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    await widget.dataSource.sendChatMessage(
      transactionId: widget.transaction.id,
      content: text,
    );
    _controller.clear();
    if (!mounted) return;
    setState(() {
      _sending = false;
      _messagesFuture = widget.dataSource.fetchChat(widget.transaction.id);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
      }
    });
  }

  String _roleFor(String senderId) {
    if (senderId == widget.transaction.buyerId) return 'Buyer';
    if (senderId == widget.transaction.sellerId) return 'Seller';
    return 'Moderator';
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: P2PTheme.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Header(onBack: () => Navigator.of(context).maybePop()),
            Expanded(
              child: FutureBuilder<List<P2PChatMessage>>(
                future: _messagesFuture,
                builder: (context, snapshot) {
                  final messages = snapshot.data;
                  if (messages == null) {
                    return const Center(
                      child: CircularProgressIndicator(color: P2PTheme.primary),
                    );
                  }
                  if (messages.isEmpty) {
                    return const P2PEmptyState(
                      icon: Icons.forum_outlined,
                      title: 'No messages yet',
                      subtitle:
                          'Start the conversation with the other party to '
                          'coordinate payment.',
                    );
                  }
                  return ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(P2PTheme.lg),
                    itemCount: messages.length,
                    itemBuilder: (context, index) {
                      final msg = messages[index];
                      final isMine = msg.senderId == widget.currentUserId;
                      return _MessageBubble(
                        message: msg,
                        isMine: isMine,
                        role: _roleFor(msg.senderId),
                      );
                    },
                  );
                },
              ),
            ),
            _Composer(
              controller: _controller,
              sending: _sending,
              onSend: _send,
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: P2PTheme.border)),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back, color: P2PTheme.foreground),
          ),
          const Expanded(
            child: Text('Transaction chat', style: P2PTheme.sectionTitle),
          ),
          Padding(
            padding: const EdgeInsets.only(right: P2PTheme.lg),
            child: Row(
              children: const [
                Icon(Icons.shield_outlined, size: 14, color: P2PTheme.success),
                SizedBox(width: 4),
                Text('Escrow protected', style: P2PTheme.meta),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.isMine,
    required this.role,
  });

  final P2PChatMessage message;
  final bool isMine;
  final String role;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: P2PTheme.md),
      child: Row(
        mainAxisAlignment:
            isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMine) ...[
            P2PAvatar(
              label: message.sender?.label ?? role,
              avatarUrl: message.sender?.avatarUrl,
              size: 28,
            ),
            const SizedBox(width: P2PTheme.sm),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment:
                  isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 2, left: 4, right: 4),
                  child: Text(
                    isMine ? 'You · $role' : role,
                    style: P2PTheme.meta,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: P2PTheme.md,
                    vertical: P2PTheme.sm,
                  ),
                  decoration: BoxDecoration(
                    gradient: isMine ? P2PTheme.brandGradient : null,
                    color: isMine ? null : P2PTheme.card,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isMine ? 16 : 4),
                      bottomRight: Radius.circular(isMine ? 4 : 16),
                    ),
                    border: isMine
                        ? null
                        : Border.all(color: P2PTheme.border),
                  ),
                  child: Text(
                    message.content,
                    style: P2PTheme.body.copyWith(
                      color: isMine ? Colors.white : P2PTheme.foreground,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 2, left: 4, right: 4),
                  child: Text(
                    p2pTimeAgo(message.createdAtMillis),
                    style: P2PTheme.meta,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.all(P2PTheme.sm),
        decoration: const BoxDecoration(
          color: P2PTheme.card,
          border: Border(top: BorderSide(color: P2PTheme.border)),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                style: P2PTheme.body,
                cursorColor: P2PTheme.primary,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onSend(),
                decoration: InputDecoration(
                  hintText: 'Type a message…',
                  hintStyle: P2PTheme.muted
                      .copyWith(color: P2PTheme.faintForeground),
                  filled: true,
                  fillColor: P2PTheme.surface,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: P2PTheme.md,
                    vertical: 10,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: const BorderSide(color: P2PTheme.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: const BorderSide(color: P2PTheme.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: const BorderSide(color: P2PTheme.primary),
                  ),
                ),
              ),
            ),
            const SizedBox(width: P2PTheme.sm),
            GestureDetector(
              onTap: sending ? null : onSend,
              child: Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  gradient: P2PTheme.brandGradient,
                  shape: BoxShape.circle,
                ),
                child: sending
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send, color: Colors.white, size: 20),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
