import 'package:flutter/widgets.dart';

/// Global route observer used by media surfaces to pause when another route
/// covers them and resume when they become visible again.
final RouteObserver<ModalRoute<void>> feedinRouteObserver =
    RouteObserver<ModalRoute<void>>();
