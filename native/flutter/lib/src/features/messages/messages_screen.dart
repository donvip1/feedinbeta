import 'package:flutter/material.dart';

import '../../core/sync/conversation_starter.dart';
import '../../data/local/local_messages_repository_contract.dart';
import '../profile/user_profile.dart';
import 'message_models.dart';
import 'message_recipient.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({
    super.key,
    required this.messagesRepository,
    required this.conversationStarter,
    required this.profile,
    required this.realtimeVersion,
    this.initialConversationId,
  });

  final LocalMessagesRepositoryContract messagesRepository;
  final ConversationStarter conversationStarter;
  final UserProfile profile;
  final int realtimeVersion;
  final String? initialConversationId;

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  final _recipientSearchController = TextEditingController();
  String? _selectedConversationId;
  late Future<List<ConversationSummary>> _conversationsFuture;
  Future<List<MessageRecipient>>? _recipientsFuture;
  bool _isStartingConversation = false;

  @override
  void initState() {
    super.initState();
    _selectedConversationId = widget.initialConversationId;
    _conversationsFuture = widget.messagesRepository.loadConversations();
  }

  @override
  void didUpdateWidget(covariant MessagesScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.realtimeVersion != widget.realtimeVersion) {
      setState(() {
        _conversationsFuture = widget.messagesRepository.loadConversations();
      });
    }
    if (oldWidget.initialConversationId != widget.initialConversationId &&
        widget.initialConversationId != null) {
      setState(() {
        _selectedConversationId = widget.initialConversationId;
        _conversationsFuture = widget.messagesRepository.loadConversations();
      });
    }
  }

  @override
  void dispose() {
    _recipientSearchController.dispose();
    super.dispose();
  }

  void _searchRecipients(String query) {
    if (query.trim().length < 2) {
      setState(() => _recipientsFuture = null);
      return;
    }

    setState(() {
      _recipientsFuture = widget.conversationStarter.searchRecipients(query);
    });
  }

  Future<void> _startConversation(MessageRecipient recipient) async {
    if (_isStartingConversation) return;

    setState(() => _isStartingConversation = true);
    final conversation = await widget.conversationStarter.startConversation(
      recipient: recipient,
    );
    _recipientSearchController.clear();
    if (!mounted) return;
    setState(() {
      _isStartingConversation = false;
      _selectedConversationId = conversation.id;
      _recipientsFuture = null;
      _conversationsFuture = widget.messagesRepository.loadConversations();
    });
  }

  Future<void> _createLocalFallbackConversation() async {
    final title = _recipientSearchController.text.trim();
    if (title.isEmpty) return;

    final conversation = await widget.messagesRepository.createConversation(
      title: title,
    );
    _recipientSearchController.clear();
    if (!mounted) return;
    setState(() {
      _selectedConversationId = conversation.id;
      _recipientsFuture = null;
      _conversationsFuture = widget.messagesRepository.loadConversations();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_selectedConversationId != null) {
      return ConversationScreen(
        conversationId: _selectedConversationId!,
        messagesRepository: widget.messagesRepository,
        profile: widget.profile,
        realtimeVersion: widget.realtimeVersion,
        onBack: () => setState(() => _selectedConversationId = null),
      );
    }

    return FutureBuilder<List<ConversationSummary>>(
      future: _conversationsFuture,
      builder: (context, snapshot) {
        final conversations = snapshot.data;
        if (conversations == null) {
          return const Center(child: CircularProgressIndicator());
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: conversations.length + 1,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            if (index == 0) {
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _recipientSearchController,
                              textInputAction: TextInputAction.search,
                              onChanged: _searchRecipients,
                              onSubmitted: _searchRecipients,
                              decoration: const InputDecoration(
                                labelText: 'New chat',
                                hintText: 'Search name or @handle',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.filled(
                            tooltip: 'Create local chat',
                            onPressed: _createLocalFallbackConversation,
                            icon: const Icon(Icons.add_comment_outlined),
                          ),
                        ],
                      ),
                      if (_recipientsFuture != null) ...[
                        const SizedBox(height: 8),
                        FutureBuilder<List<MessageRecipient>>(
                          future: _recipientsFuture,
                          builder: (context, snapshot) {
                            final recipients = snapshot.data;
                            if (recipients == null) {
                              return const LinearProgressIndicator();
                            }
                            if (recipients.isEmpty) {
                              return Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  'No matching FEEDIN users yet.',
                                  style: Theme.of(context).textTheme.bodySmall
                                      ?.copyWith(
                                        color: Theme.of(
                                          context,
                                        ).colorScheme.onSurfaceVariant,
                                      ),
                                ),
                              );
                            }

                            return Column(
                              children: recipients.map((recipient) {
                                return ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  leading: CircleAvatar(
                                    child: Text(
                                      recipient.displayName.characters.first
                                          .toUpperCase(),
                                    ),
                                  ),
                                  title: Text(recipient.displayName),
                                  subtitle: Text('@${recipient.username}'),
                                  trailing: IconButton(
                                    tooltip: 'Start chat',
                                    onPressed: _isStartingConversation
                                        ? null
                                        : () => _startConversation(recipient),
                                    icon: const Icon(Icons.chat_outlined),
                                  ),
                                );
                              }).toList(),
                            );
                          },
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }

            final conversation = conversations[index - 1];
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
    required this.realtimeVersion,
    required this.onBack,
  });

  final String conversationId;
  final LocalMessagesRepositoryContract messagesRepository;
  final UserProfile profile;
  final int realtimeVersion;
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
  void didUpdateWidget(covariant ConversationScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.realtimeVersion != widget.realtimeVersion ||
        oldWidget.conversationId != widget.conversationId) {
      setState(() {
        _messagesFuture = widget.messagesRepository.loadMessages(
          widget.conversationId,
        );
      });
    }
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
