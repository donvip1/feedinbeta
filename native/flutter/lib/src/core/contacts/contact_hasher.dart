import 'dart:convert';

import 'package:crypto/crypto.dart';

/// Pure phone-number hashing for the "find friends from contacts" flow.
///
/// WhatsApp-style contact discovery never uploads raw phone numbers: each
/// number is normalised and SHA-256 hashed on-device, and only the opaque
/// hashes are sent to the backend to be matched against other users' stored
/// hashes. This file is deliberately plugin-free (only `dart:convert` +
/// `crypto`) so it is fully unit-testable without a Flutter binding.
///
/// ## Normalisation & candidates
/// Phone books store the same number in wildly inconsistent shapes:
/// `+1 (555) 123-4567`, `555-123-4567`, `0055512...`. To survive
/// local-vs-international formatting we normalise to digits only and produce a
/// SMALL set of hash *candidates* per number:
///   1. the full digit string, and
///   2. if it is longer than 10 digits, the LAST 10 digits (drops the country
///      code so a locally-stored `5551234567` matches an internationally-stored
///      `+1 555 123 4567`).
///
/// The user's OWN number is registered under a single [canonicalHashFor] value
/// (last-10 when >10 digits, else the full digits) so registration and matching
/// agree on at least one shared candidate.
class ContactHasher {
  const ContactHasher._();

  /// Numbers shorter than this (after stripping) are treated as junk (short
  /// codes, extensions) and produce no candidates.
  static const int _minDigits = 7;

  /// The "national number" length we trim longer numbers down to, so a locally
  /// formatted number and its international `+CC` form share a candidate.
  static const int _nationalLength = 10;

  /// Strips every non-digit character from [rawNumber].
  ///
  /// Note: a leading `+` is dropped along with everything else, so the country
  /// code survives only as leading digits — that is intentional and why the
  /// last-10 candidate exists.
  static String normalize(String rawNumber) {
    return rawNumber.replaceAll(RegExp(r'[^0-9]'), '');
  }

  /// SHA-256 of [digits] as lowercase hex.
  static String _sha256Hex(String digits) {
    return sha256.convert(utf8.encode(digits)).toString();
  }

  /// The deduped set of hash candidates for [rawNumber], empty for junk.
  ///
  /// Used when hashing the phone book: send every candidate so a match is found
  /// regardless of how either side stored the number.
  static List<String> hashesFor(String rawNumber) {
    final digits = normalize(rawNumber);
    if (digits.length < _minDigits) return const [];

    final candidates = <String>{digits};
    if (digits.length > _nationalLength) {
      candidates.add(digits.substring(digits.length - _nationalLength));
    }

    return [for (final candidate in candidates) _sha256Hex(candidate)];
  }

  /// The single canonical hash used to register the user's OWN number so others
  /// can discover them. Returns an empty string for junk input.
  ///
  /// Uses the last-10-digits form when the number is longer than 10 digits, else
  /// the full digit string — the SAME rule the primary matching candidate uses,
  /// so a peer who has this number stored locally (10 digits) or internationally
  /// (with country code) resolves to a shared candidate.
  static String canonicalHashFor(String rawNumber) {
    final digits = normalize(rawNumber);
    if (digits.length < _minDigits) return '';

    final canonical = digits.length > _nationalLength
        ? digits.substring(digits.length - _nationalLength)
        : digits;
    return _sha256Hex(canonical);
  }
}
