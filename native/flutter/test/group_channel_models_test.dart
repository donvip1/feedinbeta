import 'package:feedin/src/features/groups/data/group_models.dart';
import 'package:feedin/src/features/groups/view_models/group_view_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('channel view carries ownership and subscription permissions', () {
    const channel = RemoteGroupChannel(
      id: 'channel-1',
      ownerId: 'owner-1',
      name: 'Announcements',
      createdAtMillis: 10,
      subscriberCount: 12,
      isSubscribed: true,
      canPost: true,
    );

    final view = groupChannelToView(channel);

    expect(view.id, 'channel-1');
    expect(view.ownerId, 'owner-1');
    expect(view.subscriberCount, 12);
    expect(view.isSubscribed, isTrue);
    expect(view.canPost, isTrue);
  });

  test('channel post maps to a channel id and preserves content', () {
    const post = RemoteGroupChannelPost(
      id: 'post-1',
      channelId: 'channel-1',
      senderId: 'owner-1',
      senderName: 'Owner',
      body: 'Welcome',
      createdAtMillis: 20,
    );

    final view = groupChannelPostToView(post, currentUserId: 'owner-1');

    expect(view.id, 'post-1');
    expect(view.body, 'Welcome');
    expect(view.isMine, isTrue);
  });
}
