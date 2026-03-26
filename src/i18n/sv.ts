import type { TranslationKey } from './en';

const sv: Record<TranslationKey, string> = {
  // App
  'app.title': 'RundLoop',
  'app.tagline': 'Utforska genom att springa',

  // GPS
  'gps.findPosition': 'Hitta min position',
  'gps.searching': 'Soker...',
  'gps.searchingPosition': 'Soker position...',
  'gps.simulatePosition': 'Simulera position istallet',
  'gps.simulatePositionShort': 'Simulera position',
  'gps.simulatedGps': 'Simulerad GPS: {label}',
  'gps.closeSimulation': 'Stang simulering',
  'gps.whereAreYou': 'Var ar du?',
  'gps.needPosition': 'RundLoop behover din position for att skapa loprutter i ditt omrade.',
  'gps.waitingForGps': 'Vantar pa GPS...',
  'gps.fetchingLocation': 'Hamtar plats...',
  'gps.positionMissing': 'GPS-position saknas',
  'gps.defaultError': 'Tillat platsatkomst i telefonens installningar for att anvanda din riktiga GPS-position, eller simulera en position for att testa appen.',
  'gps.permissionDeniedDetail': 'Platsatkomst har nekats. Oppna webblasarens installningar och tillat platsatkomst for den har sidan, eller anvand simulerad position.',
  'gps.retry': 'Forsok igen',
  'gps.browserNotSupported': 'Din webblasare stoder inte GPS',
  'gps.couldNotGet': 'Kunde inte hamta din position. Forsok igen.',
  'gps.permissionDenied': 'Du behover tillata platsatkomst i webblasarens installningar',
  'gps.positionUnavailable': 'Kunde inte hitta din position. Kontrollera att GPS ar aktiverat.',
  'gps.timeout': 'Det tog for lang tid att hitta din position. Forsok igen.',
  'gps.unknownError': 'Ett okant GPS-fel uppstod. Forsok igen.',
  'gps.deactivate': 'Avaktivera',

  // Route
  'route.generate': 'Generera {distance} km rutt',
  'route.generating': 'Genererar rutt...',
  'route.save': 'Spara rutt',
  'route.saved': 'Sparad!',
  'route.newRoute': 'Ny rutt',
  'route.startRun': 'Starta lopning',

  // Scenic modes
  'scenic.standard': 'Standard',
  'scenic.nature': 'Natur',
  'scenic.explore': 'Utforska',

  // Navigation
  'nav.starting': 'Startar...',
  'nav.then': 'Sedan: {instruction}',
  'nav.offRoute': 'Utanfor rutten',
  'nav.headToRejoin': 'Ga {direction} for att aterga till rutten',
  'nav.backOnRoute': 'Tillbaka pa rutten.',
  'nav.offRouteVoice': 'Utanfor rutten. Ga {direction} for att aterga.',
  'nav.stop': 'Stopp',
  'nav.pause': 'Paus',
  'nav.resume': 'Fortsatt',
  'nav.end': 'Avsluta',
  'nav.paused': 'PAUSAD',
  'nav.dismiss': 'Stang',

  // Metrics
  'metrics.pace': 'Tempo',
  'metrics.avgPace': 'Snittempo',
  'metrics.distance': 'Distans',
  'metrics.time': 'Tid',
  'metrics.remaining': 'Kvar',
  'metrics.calories': 'Kalorier',

  // Landmarks
  'landmarks.title': 'Landmarken langs rutten ({count})',
  'landmarks.fromRoute': '{distance}m fran rutten',

  // Saved routes
  'routes.title': 'Rutter',
  'routes.noSaved': 'Inga sparade rutter',
  'routes.noSavedHint': 'Generera en rutt och tryck Spara for att lagga till den har',
  'routes.delete': 'Radera',
  'routes.run': 'Kor',
  'routes.loading': 'Laddar...',

  // History
  'history.title': 'Historik',
  'history.noRuns': 'Inga lopningar annu',
  'history.noRunsHint': 'Genomfor din forsta lopning for att se den har',
  'history.loading': 'Laddar...',
  'history.at': 'kl',

  // Settings
  'settings.title': 'Installningar',
  'settings.claudeSubscription': 'Claude via ditt abonnemang',
  'settings.noApiKeyNeeded': 'Ingen API-nyckel behovs',
  'settings.voiceNavigation': 'Rostnavigering',
  'settings.voiceNavigationHint': 'Las upp svanginstruktioner',
  'settings.voiceStyle': 'Roststil',
  'settings.voiceConcise': 'Kortfattad',
  'settings.voiceConciseExample': '1 km avklarat',
  'settings.voiceWithPace': 'Med tempo',
  'settings.voiceWithPaceExample': '1 km avklarat. Tempo: 5:30/km',
  'settings.voiceMotivational': 'Motiverande',
  'settings.voiceMotivationalExample': 'Bra jobbat! 1 km klart',
  'settings.units': 'Enheter',
  'settings.kilometers': 'Kilometer',
  'settings.miles': 'Miles',
  'settings.defaultDistance': 'Standarddistans: {distance} km',
  'settings.runningPace': 'Loptempo',
  'settings.paceHint': 'Anvands for beraknad loptid. Standard: 6:00/km',
  'settings.bodyWeight': 'Kroppsvikt',
  'settings.save': 'Spara installningar',
  'settings.saved': 'Sparat!',
  'settings.language': 'Sprak',

  // Dialogs
  'dialog.endRun.title': 'Avsluta lopning?',
  'dialog.endRun.message': 'Din lopning sparas i historiken.',
  'dialog.endRun.keepGoing': 'Fortsatt',
  'dialog.endRun.confirm': 'Avsluta',

  'dialog.crashRecovery.title': 'Oavslutad lopning hittad',
  'dialog.crashRecovery.distance': 'Distans',
  'dialog.crashRecovery.time': 'Tid',
  'dialog.crashRecovery.started': 'Startad',
  'dialog.crashRecovery.discard': 'Kasta',
  'dialog.crashRecovery.resume': 'Ateruppta',

  'dialog.deleteRoute.title': 'Radera rutt?',
  'dialog.deleteRoute.message': 'Den sparade rutten tas bort permanent.',
  'dialog.deleteRoute.keep': 'Behall',
  'dialog.deleteRoute.confirm': 'Radera',

  'dialog.deleteRun.title': 'Radera lopning?',
  'dialog.deleteRun.message': 'Lopningen tas bort permanent fran din historik.',
  'dialog.deleteRun.keep': 'Behall',
  'dialog.deleteRun.confirm': 'Radera',

  'dialog.discardRun.title': 'Kasta lopning?',
  'dialog.discardRun.message': 'Lopningen raderas permanent.',
  'dialog.discardRun.keep': 'Behall',
  'dialog.discardRun.confirm': 'Kasta',

  // Run summary
  'summary.saveRun': 'Spara lopning',
  'summary.discard': 'Kasta',
  'summary.calorieNoteKm': 'Baserat pa 70 kg -- uppdatera vikt i Installningar',
  'summary.calorieNoteMi': 'Baserat pa 154 lbs -- uppdatera vikt i Installningar',

  // Run detail
  'detail.deleteRun': 'Radera lopning',

  // Tab bar
  'tab.map': 'Karta',
  'tab.history': 'Historik',
  'tab.routes': 'Rutter',

  // Offline
  'offline.message': 'Du ar offline',
};

export default sv;
