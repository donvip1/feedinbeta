import 'package:feedin/src/features/auth/data/google_auth_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('GoogleAuthService.hasClientId', () {
    // The auth UI gates the "Sign in with Google" button on this, so the
    // combinations matter: the flow can only mint a Supabase-compatible ID
    // token when a server (or explicit) client id is configured.
    test('false when neither serverClientId nor clientId is set', () {
      expect(GoogleAuthService().hasClientId, isFalse);
      expect(GoogleAuthService(serverClientId: '').hasClientId, isFalse);
      expect(GoogleAuthService(clientId: '').hasClientId, isFalse);
    });

    test('true when a serverClientId is provided', () {
      expect(
        GoogleAuthService(serverClientId: 'web-client.apps.googleusercontent.com')
            .hasClientId,
        isTrue,
      );
    });

    test('true when a clientId is provided', () {
      expect(
        GoogleAuthService(clientId: 'android-client.apps.googleusercontent.com')
            .hasClientId,
        isTrue,
      );
    });
  });

  group('GoogleAuthTokens', () {
    test('idToken is required; other fields optional/default null', () {
      const tokens = GoogleAuthTokens(idToken: 'id-123');
      expect(tokens.idToken, 'id-123');
      expect(tokens.accessToken, isNull);
      expect(tokens.nonce, isNull);
      expect(tokens.email, isNull);
      expect(tokens.displayName, isNull);
    });

    test('carries the optional Supabase/profile fields when supplied', () {
      const tokens = GoogleAuthTokens(
        idToken: 'id-123',
        accessToken: 'access-456',
        email: 'a@b.com',
        displayName: 'Ada',
      );
      expect(tokens.accessToken, 'access-456');
      expect(tokens.email, 'a@b.com');
      expect(tokens.displayName, 'Ada');
    });
  });

  // NOTE: signIn() drives the google_sign_in 7.x singleton via platform
  // channels (initialize/authenticate/authorizationClient). Faithfully faking
  // that surface is an integration-test concern, not a unit test — the
  // cancel-returns-null and idToken-extraction paths are exercised on-device.
}
