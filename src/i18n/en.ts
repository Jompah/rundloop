const en = {
  // App
  'app.title': 'Drift',
  'app.tagline': 'Explore by running',

  // GPS
  'gps.findPosition': 'Find my position',
  'gps.searching': 'Searching...',
  'gps.searchingPosition': 'Searching for position...',
  'gps.simulatePosition': 'Simulate position instead',
  'gps.simulatePositionShort': 'Simulate position',
  'gps.simulatedGps': 'Simulated GPS: {label}',
  'gps.closeSimulation': 'Close simulation',
  'gps.whereAreYou': 'Where are you?',
  'gps.needPosition': 'Drift needs your position to create running routes in your area.',
  'gps.waitingForGps': 'Waiting for GPS...',
  'gps.fetchingLocation': 'Fetching location...',
  'gps.positionMissing': 'GPS position missing',
  'gps.defaultError': 'Could not get your position. Please allow location access in your phone settings to use your real GPS position, or simulate a position to test the app.',
  'gps.permissionDeniedDetail': 'Location access has been denied. You need to enable it in your browser/phone settings:',
  'gps.permissionGuide.iosSafari': 'iPhone/Safari: Settings > Safari > Location > Allow',
  'gps.permissionGuide.iosChrome': 'iPhone/Chrome: Settings > Chrome > Location > "While Using"',
  'gps.permissionGuide.androidChrome': 'Android/Chrome: Tap the lock icon in the address bar > Location > Allow',
  'gps.permissionGuide.desktopChrome': 'Desktop Chrome: Click the lock icon left of the URL > "Location" > Allow',
  'gps.permissionGuide.or': 'Or use a simulated position to test the app.',
  'gps.retry': 'Try again',
  'gps.browserNotSupported': 'Your browser does not support GPS',
  'gps.couldNotGet': 'Could not get your position. Try again.',
  'gps.permissionDenied': 'You need to allow location access in your browser settings',
  'gps.positionUnavailable': 'Could not find your position. Make sure Location Services are enabled in Settings.',
  'gps.timeout': 'GPS timed out. Make sure Location Services are enabled and try again outdoors for best results.',
  'gps.unknownError': 'An unknown GPS error occurred. Try again.',
  'gps.deactivate': 'Deactivate',

  // Route
  'route.generate': 'Generate {distance} km route',
  'route.generating': 'Generating route...',
  'route.generationFailed': 'Failed to generate route. Please try again.',
  'route.networkError': 'Could not connect to the route server. Check your internet connection and try again. Some in-app browsers (like Telegram) may block this -- try opening in Chrome or Safari instead.',
  'route.save': 'Save route',
  'route.saved': 'Saved!',
  'route.newRoute': 'New route',
  'route.startRun': 'Start run',
  'route.showControls': 'Show controls',
  'route.hideControls': 'Hide controls',

  // Scenic modes
  'scenic.standard': 'Standard',
  'scenic.nature': 'Nature',
  'scenic.explore': 'Explore',

  // Navigation
  'nav.starting': 'Starting...',
  'nav.then': 'Then: {instruction}',
  'nav.offRoute': 'Off route',
  'nav.headToRejoin': 'Head {direction} to rejoin',
  'nav.backOnRoute': 'Back on route.',
  'nav.offRouteVoice': 'Off route. Head {direction} to rejoin.',
  'nav.stop': 'Stop',
  'nav.pause': 'Pause',
  'nav.resume': 'Resume',
  'nav.end': 'End',
  'nav.paused': 'PAUSED',
  'nav.dismiss': 'Dismiss',

  // Metrics
  'metrics.pace': 'Pace',
  'metrics.avgPace': 'Avg Pace',
  'metrics.distance': 'Distance',
  'metrics.time': 'Time',
  'metrics.remaining': 'Remaining',
  'metrics.calories': 'Calories',

  // Landmarks
  'landmarks.title': 'Landmarks along route ({count})',
  'landmarks.fromRoute': '{distance}m from route',

  // Saved routes
  'routes.title': 'Routes',
  'routes.noSaved': 'No saved routes',
  'routes.noSavedHint': 'Generate a route and tap Save to add it here',
  'routes.delete': 'Delete',
  'routes.run': 'Run',
  'routes.loading': 'Loading...',

  // History
  'history.title': 'History',
  'history.noRuns': 'No runs yet',
  'history.noRunsHint': 'Complete your first run to see it here',
  'history.loading': 'Loading...',
  'history.at': 'at',

  // Settings
  'settings.title': 'Settings',
  'settings.claudeSubscription': 'Claude via your subscription',
  'settings.noApiKeyNeeded': 'No API key needed',
  'settings.voiceNavigation': 'Voice Navigation',
  'settings.voiceNavigationHint': 'Read turn instructions aloud',
  'settings.voiceStyle': 'Voice Style',
  'settings.voiceConcise': 'Concise',
  'settings.voiceConciseExample': '1 km completed',
  'settings.voiceWithPace': 'With Pace',
  'settings.voiceWithPaceExample': '1 km completed. Pace: 5:30/km',
  'settings.voiceMotivational': 'Motivational',
  'settings.voiceMotivationalExample': 'Great work! 1 km done',
  'settings.units': 'Units',
  'settings.kilometers': 'Kilometers',
  'settings.miles': 'Miles',
  'settings.defaultDistance': 'Default Distance: {distance} km',
  'settings.runningPace': 'Running Pace',
  'settings.paceHint': 'Used for estimated run time. Default: 6:00/km',
  'settings.bodyWeight': 'Body Weight',
  'settings.save': 'Save Settings',
  'settings.saved': 'Saved!',
  'settings.language': 'Language',

  // Dialogs
  'dialog.endRun.title': 'End Run?',
  'dialog.endRun.message': 'Your run will be saved to history.',
  'dialog.endRun.keepGoing': 'Keep Going',
  'dialog.endRun.confirm': 'End Run',

  'dialog.crashRecovery.title': 'Unfinished Run Found',
  'dialog.crashRecovery.distance': 'Distance',
  'dialog.crashRecovery.time': 'Time',
  'dialog.crashRecovery.started': 'Started',
  'dialog.crashRecovery.discard': 'Discard',
  'dialog.crashRecovery.resume': 'Resume Run',

  'dialog.deleteRoute.title': 'Delete Route?',
  'dialog.deleteRoute.message': 'This saved route will be permanently removed.',
  'dialog.deleteRoute.keep': 'Keep It',
  'dialog.deleteRoute.confirm': 'Delete',

  'dialog.deleteRun.title': 'Delete Run?',
  'dialog.deleteRun.message': 'This run will be permanently removed from your history.',
  'dialog.deleteRun.keep': 'Keep It',
  'dialog.deleteRun.confirm': 'Delete',

  'dialog.discardRun.title': 'Discard Run?',
  'dialog.discardRun.message': 'This run will be permanently deleted.',
  'dialog.discardRun.keep': 'Keep It',
  'dialog.discardRun.confirm': 'Discard',

  // Run summary
  'summary.saveRun': 'Save Run',
  'summary.discard': 'Discard',
  'summary.calorieNoteKm': 'Based on 70 kg -- update weight in Settings',
  'summary.calorieNoteMi': 'Based on 154 lbs -- update weight in Settings',

  // Run detail
  'detail.deleteRun': 'Delete Run',

  // Tab bar
  'tab.map': 'Map',
  'tab.history': 'History',
  'tab.routes': 'Routes',

  // Offline
  'offline.message': 'You are offline',
} as const;

export type TranslationKey = keyof typeof en;
export default en;
