import 'package:flutter/material.dart';

import '../core/config/feedin_config.dart';
import '../features/auth/auth_gate.dart';
import 'feedin_services.dart';

class FeedinApp extends StatelessWidget {
  const FeedinApp({super.key, required this.config, this.servicesOverride});

  final FeedinConfig config;
  final FeedinServices? servicesOverride;

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF22C55E);
    final services = servicesOverride ?? FeedinServices.create(config);

    return MaterialApp(
      title: 'FEEDIN',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: seed,
          brightness: Brightness.dark,
          primary: seed,
          secondary: const Color(0xFF38BDF8),
          tertiary: const Color(0xFFF59E0B),
          surface: const Color(0xFF111111),
        ),
        scaffoldBackgroundColor: const Color(0xFF050505),
        cardTheme: CardThemeData(
          color: const Color(0xFF111111),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
            side: const BorderSide(color: Color(0xFF222222)),
          ),
        ),
      ),
      home: AuthGate(services: services),
    );
  }
}
