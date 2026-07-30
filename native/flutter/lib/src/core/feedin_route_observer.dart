import 'package:flutter/widgets.dart';

/// Route observer that also exposes the route pushed directly above a media
/// surface. Feed uses this to distinguish a partial, non-opaque comment sheet
/// from a full-screen destination.
class FeedinRouteObserver extends RouteObserver<ModalRoute<void>> {
  final Map<ModalRoute<void>, ModalRoute<void>> _routeAbove = {};

  ModalRoute<void>? routeAbove(ModalRoute<void>? route) =>
      route == null ? null : _routeAbove[route];

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    if (route is ModalRoute<void> && previousRoute is ModalRoute<void>) {
      _routeAbove[previousRoute] = route;
    }
    super.didPush(route, previousRoute);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    if (previousRoute is ModalRoute<void>) _routeAbove.remove(previousRoute);
    super.didPop(route, previousRoute);
  }

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _routeAbove.removeWhere((key, value) => identical(value, route));
    super.didRemove(route, previousRoute);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    if (oldRoute != null) {
      _routeAbove.removeWhere(
        (key, value) => identical(key, oldRoute) || identical(value, oldRoute),
      );
    }
    super.didReplace(newRoute: newRoute, oldRoute: oldRoute);
  }
}

final FeedinRouteObserver feedinRouteObserver = FeedinRouteObserver();
