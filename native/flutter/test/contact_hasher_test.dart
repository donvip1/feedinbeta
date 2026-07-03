import 'package:feedin/src/core/contacts/contact_hasher.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ContactHasher.normalize', () {
    test('strips punctuation, spaces, parentheses and +', () {
      expect(ContactHasher.normalize('+1 (555) 123-4567'), '15551234567');
      expect(ContactHasher.normalize('555.123.4567'), '5551234567');
      expect(ContactHasher.normalize('  555 123 4567  '), '5551234567');
    });

    test('empty for input with no digits', () {
      expect(ContactHasher.normalize('not-a-number'), '');
    });
  });

  group('ContactHasher.hashesFor', () {
    test('local and international forms share a candidate hash', () {
      final intl = ContactHasher.hashesFor('+1 555-123-4567');
      final local = ContactHasher.hashesFor('5551234567');

      // The 11-digit international number yields the full form + last-10 form.
      // The last-10 candidate must equal the local 10-digit hash so the two
      // numbers match despite the country-code difference.
      expect(intl.toSet().intersection(local.toSet()), isNotEmpty);
    });

    test('is deterministic across calls', () {
      expect(
        ContactHasher.hashesFor('+1 555-123-4567'),
        ContactHasher.hashesFor('+1 555-123-4567'),
      );
    });

    test('produces lowercase 64-char hex hashes', () {
      final hashes = ContactHasher.hashesFor('5551234567');
      expect(hashes, isNotEmpty);
      for (final hash in hashes) {
        expect(hash, matches(RegExp(r'^[0-9a-f]{64}$')));
      }
    });

    test('11+ digit numbers yield two deduped candidates', () {
      // Full (11) + last-10 => two distinct hashes.
      expect(ContactHasher.hashesFor('15551234567'), hasLength(2));
      // Exactly 10 digits => single candidate.
      expect(ContactHasher.hashesFor('5551234567'), hasLength(1));
    });

    test('junk / too-short numbers hash to empty', () {
      expect(ContactHasher.hashesFor(''), isEmpty);
      expect(ContactHasher.hashesFor('123'), isEmpty);
      expect(ContactHasher.hashesFor('not-a-number'), isEmpty);
      expect(ContactHasher.hashesFor('#*'), isEmpty);
    });
  });

  group('ContactHasher.canonicalHashFor', () {
    test('matches a candidate returned by hashesFor for the same number', () {
      const number = '+1 555-123-4567';
      final canonical = ContactHasher.canonicalHashFor(number);
      expect(canonical, isNotEmpty);
      expect(ContactHasher.hashesFor(number), contains(canonical));
    });

    test('registration and matching agree across local vs international', () {
      // A user registers their own number in international form; a peer has it
      // stored locally. The peer\'s candidate set must contain the canonical
      // registration hash for discovery to work.
      final registered = ContactHasher.canonicalHashFor('+1 555-123-4567');
      final peerCandidates = ContactHasher.hashesFor('555-123-4567');
      expect(peerCandidates, contains(registered));
    });

    test('is deterministic', () {
      expect(
        ContactHasher.canonicalHashFor('5551234567'),
        ContactHasher.canonicalHashFor('5551234567'),
      );
    });

    test('junk / too-short numbers produce an empty hash', () {
      expect(ContactHasher.canonicalHashFor('123'), isEmpty);
      expect(ContactHasher.canonicalHashFor('junk'), isEmpty);
    });
  });
}
