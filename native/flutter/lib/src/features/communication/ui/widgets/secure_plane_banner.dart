import 'package:flutter/material.dart';

import '../../theme/communication_theme.dart';

/// The emerald "secure plane" banner from the UX north-star: shield glyph,
/// transport identity, and a live status chip. Purely presentational.
class SecurePlaneBanner extends StatelessWidget {
  const SecurePlaneBanner({super.key, this.online = true});

  final bool online;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(CommunicationTheme.spaceLg),
      decoration: BoxDecoration(
        gradient: CommunicationTheme.secureBanner,
        borderRadius: BorderRadius.circular(CommunicationTheme.radiusLg),
        border: Border.all(color: const Color(0x4D10B981)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0x3310B981),
              borderRadius: BorderRadius.circular(CommunicationTheme.radiusMd),
            ),
            child: const Icon(
              Icons.shield_rounded,
              color: CommunicationTheme.secureEmerald,
              size: 20,
            ),
          ),
          const SizedBox(width: CommunicationTheme.spaceMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'LiveKit SFU Secure Plane',
                  style: TextStyle(
                    color: CommunicationTheme.ink,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  online
                      ? 'Encrypted media • 1:1 & Group Active'
                      : 'Encrypted media • Waiting for connection',
                  style: CommunicationTheme.secureLabel,
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0x3310B981),
              borderRadius: BorderRadius.circular(
                CommunicationTheme.radiusPill,
              ),
            ),
            child: Text(
              online ? 'ONLINE' : 'OFFLINE',
              style: TextStyle(
                color: online
                    ? CommunicationTheme.secureEmerald
                    : CommunicationTheme.inkSubtle,
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
