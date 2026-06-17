import 'package:flutter/material.dart';

import '../../data/local/local_messages_repository_contract.dart';
import '../profile/user_profile.dart';
import 'message_models.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({
    super.key,
    required this.messagesRepository,
    required this.profile,
  });

  final LocalMessagesRepositoryContract messagesRepository;
  final UserProfile profile;

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  String? _selectedConversationId;

  @override
  Widget build(BuildContext context) {
    if (_selectedConversationId != null) {
      return ConversationScreen(
        conversationId: _selectedConversationId!,
        messagesRepository: widget.messagesRepository,
        profile: widget.profile,
        onBack: () => setState(() => _selectedConversationId = null),
      );
    }

    return FutureBuilder<List<ConversationSummary>>(
      future: widget.messagesRepository.loadConversations(),
      builder: (context, snapshot) {
        final conversations = snapshot.data;
        if (conversations == null) {
          return const Center(child: CircularProgressIndicator());
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: conversations.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final conversation = conversations[index];
            return Card(
              child: ListTile(
                title: Text(conversation.title),
                subtitle: Text(conversation.lastMessagePreview),
                trailing: conversation.pendingCount > 0
                    ? Chip(label: Text('${conversation.pendingCount}'))
                    : const Icon(Icons.chevron_right),
                onTap: () =>
                    setState(() => _selectedConversationId = conversation.id),
              ),
            );
          },
        );
      },
    );
  }
}

class ConversationScreen extends StatefulWidget {
  const ConversationScreen({
    super.key,
    required this.conversationId,
    required this.messagesRepository,
    required this.profile,
    required this.onBack,
  });

  final String conversationId;
  final LocalMessagesRepositoryContract messagesRepository;
  final UserProfile profile;
  final VoidCallback onBack;

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  final _messageController = TextEditingController();
  late Future<List<LocalMessage>> _messagesFuture;

  @override
  void initState() {
    super.initState();
    _messagesFuture = widget.messagesRepository.loadMessages(
      widget.conversationId,
    );
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _sendMessage() async {
    await widget.messagesRepository.queueMessage(
      conversationId: widget.conversationId,
      senderName: widget.profile.displayName,
      body: _messageController.text,
    );
    _messageController.clear();
    if (!mounted) return;
    setState(() {
      _messagesFuture = widget.messagesRepository.loadMessages(
        widget.conversationId,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ListTile(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: widget.onBack,
          ),
          title: const Text('Conversation'),
          subtitle: const Text('Offline messages queue locally'),
        ),
        Expanded(
          child: FutureBuilder<List<LocalMessage>>(
            future: _messagesFuture,
            builder: (context, snapshot) {
              final messages = snapshot.data;
              if (messages == null) {
                return const Center(child: CircularProgressIndicator());
              }

              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: messages.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final message = messages[index];
                  return Align(
                    alignment: message.senderName == widget.profile.displayName
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 320),
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                message.senderName,
                                style: Theme.of(context).textTheme.labelMedium,
                              ),
                              const SizedBox(height: 4),
                              Text(message.body),
                              const SizedBox(height: 6),
                              Text(
                                message.deliveryState.name,
                                style: Theme.of(context).textTheme.labelSmall
                                    ?.copyWith(
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.onSurfaceVariant,
                                    ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _messageController,
                  minLines: 1,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    hintText: 'Message',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: _sendMessage,
                icon: const Icon(Icons.send),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
