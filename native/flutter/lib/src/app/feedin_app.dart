import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config/feedin_config.dart';
import '../core/feedin_route_observer.dart';
import '../features/auth/auth_gate.dart';
import '../features/auth/data/google_auth_service.dart';
import 'feedin_services.dart';

class FeedinApp extends StatelessWidget {
  const FeedinApp({super.key, required this.config, this.servicesOverride});

  final FeedinConfig config;
  final FeedinServices? servicesOverride;

  @override
  Widget build(BuildContext context) {
    const primary = Color(0xFFFF3D9A);
    final services = servicesOverride ?? FeedinServices.create(config);

    // Real Google sign-in handler (replaces the coming-soon default). Runs the
    // native chooser, then establishes a Supabase session via the ID token;
    // AuthGate's auth-state listener adopts the session and advances the UI.
    final googleAuth = GoogleAuthService(
      serverClientId: config.googleServerClientId.isEmpty
          ? null
          : config.googleServerClientId,
    );

    return ProviderScope(
      child: MaterialApp(
        title: 'feedIn',
        debugShowCheckedModeBanner: false,
        navigatorObservers: [feedinRouteObserver],
        themeMode: ThemeMode.dark,
        darkTheme: ThemeData(
          useMaterial3: true,
          fontFamily: 'Roboto',
          colorScheme: ColorScheme.fromSeed(
            seedColor: primary,
            brightness: Brightness.dark,
            primary: primary,
            secondary: const Color(0xFFB15CFF),
            tertiary: const Color(0xFFFF7A45),
            surface: const Color(0xFF101521),
            surfaceContainerHighest: const Color(0xFF1B2233),
          ),
          scaffoldBackgroundColor: const Color(0xFF070A12),
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xEE070A12),
            foregroundColor: Colors.white,
            elevation: 0,
            centerTitle: false,
          ),
          navigationBarTheme: NavigationBarThemeData(
            backgroundColor: const Color(0xEE0C1020),
            indicatorColor: primary.withValues(alpha: 0.18),
            labelTextStyle: WidgetStateProperty.resolveWith(
              (states) => TextStyle(
                color: states.contains(WidgetState.selected)
                    ? primary
                    : const Color(0xFF94A3B8),
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
            iconTheme: WidgetStateProperty.resolveWith(
              (states) => IconThemeData(
                color: states.contains(WidgetState.selected)
                    ? primary
                    : const Color(0xFFCBD5E1),
              ),
            ),
          ),
          cardTheme: CardThemeData(
            color: const Color(0xFF101521),
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
              side: const BorderSide(color: Color(0xFF202A3D)),
            ),
          ),
          chipTheme: ChipThemeData(
            backgroundColor: const Color(0xFF171E2E),
            selectedColor: primary.withValues(alpha: 0.2),
            labelStyle: const TextStyle(color: Color(0xFFE2E8F0)),
            side: const BorderSide(color: Color(0xFF263249)),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),
        home: AuthGate(
          services: services,
          onGoogleSignIn: (context) =>
              _signInWithGoogle(context, googleAuth, services),
        ),
      ),
    );
  }

  /// Drive the native Google flow and hand the ID token to Supabase. A null
  /// result means the user cancelled (silent). Any real failure surfaces a
  /// snackbar; success is picked up by AuthGate's auth-state listener.
  static Future<void> _signInWithGoogle(
    BuildContext context,
    GoogleAuthService googleAuth,
    FeedinServices services,
  ) async {
    try {
      final tokens = await googleAuth.signIn();
      if (tokens == null) return; // cancelled
      await services.authRepository.signInWithGoogle(
        idToken: tokens.idToken,
        accessToken: tokens.accessToken,
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            behavior: SnackBarBehavior.floating,
            content: Text("Couldn't sign in with Google. Please try again."),
          ),
        );
    }
  }
}
