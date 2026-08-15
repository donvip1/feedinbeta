import 'package:flutter/material.dart';

class GiftCreditBadge extends StatelessWidget {
  const GiftCreditBadge({super.key, required this.credits});

  final int credits;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xCC14171D),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: const Color(0xFF5A6370)),
        boxShadow: const [BoxShadow(color: Color(0x5535C6C3), blurRadius: 8)],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 14,
              height: 14,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Color(0xFFFFE69A), Color(0xFFB77813)],
                ),
              ),
              child: const Center(
                child: Text(
                  'C',
                  style: TextStyle(
                    color: Color(0xFF322000),
                    fontSize: 8,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 5),
            Text(
              '$credits',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
