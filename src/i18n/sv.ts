import type { TranslationKey } from './en';

const sv: Record<TranslationKey, string> = {
  // App
  'app.title': 'Drift',
  'app.tagline': 'Utforska genom att springa',

  // GPS
  'gps.findPosition': 'Hitta min position',
  'gps.searching': 'Söker...',
  'gps.searchingPosition': 'Söker position...',
  'gps.simulatePosition': 'Simulera position istället',
  'gps.simulatePositionShort': 'Simulera position',
  'gps.simulatedGps': 'Simulerad GPS: {label}',
  'gps.closeSimulation': 'Stäng simulering',
  'gps.whereAreYou': 'Var är du?',
  'gps.needPosition': 'Drift behöver din position för att skapa löprutter i ditt område.',
  'gps.waitingForGps': 'Väntar på GPS...',
  'gps.fetchingLocation': 'Hämtar plats...',
  'gps.positionMissing': 'GPS-position saknas',
  'gps.defaultError': 'Tillåt platsåtkomst i telefonens inställningar för att använda din riktiga GPS-position, eller simulera en position för att testa appen.',
  'gps.permissionDeniedDetail': 'Platsinställningar i Chrome måste vara aktiverade. Så här gör du:',
  'gps.permissionGuide.iosSafari': 'iPhone/Safari: Inställningar > Safari > Plats > Tillåt',
  'gps.permissionGuide.iosChrome': 'iPhone/Chrome: Inställningar > Chrome > Plats > "Vid användning"',
  'gps.permissionGuide.androidChrome': 'Android/Chrome: Tryck på låsikonen i adressfältet > Plats > Tillåt',
  'gps.permissionGuide.desktopChrome': 'Desktop Chrome: Klicka på låsikonen till vänster om URL:en > "Plats" > Tillåt',
  'gps.permissionGuide.or': 'Eller använd simulerad position för att testa appen.',
  'gps.retry': 'Försök igen',
  'gps.browserNotSupported': 'Din webbläsare stöder inte GPS',
  'gps.couldNotGet': 'Kunde inte hämta din position. Försök igen.',
  'gps.permissionDenied': 'Du behöver tillåta platsåtkomst i webbläsarens inställningar',
  'gps.positionUnavailable': 'Kunde inte hitta din position. Kontrollera att Platstjanster ar aktiverat i Installningar.',
  'gps.timeout': 'GPS tog for lang tid. Kontrollera att Platstjanster ar aktiverat och forsok igen utomhus.',
  'gps.unknownError': 'Ett okänt GPS-fel uppstod. Försök igen.',
  'gps.deactivate': 'Avaktivera',
  'gps.orEnterAddress': 'Eller ange adress',
  'gps.addressPlaceholder': 'Gatuadress, stad...',
  'gps.addressGo': 'Sok',
  'gps.addressNotFound': 'Adressen hittades inte',
  'gps.addressSearching': 'Soker...',

  // Route
  'route.generate': 'Generera {distance} km rutt',
  'route.generating': 'Genererar rutt...',
  'route.generationFailed': 'Kunde inte generera rutt. Forsok igen.',
  'route.aiFallback': 'AI-rutt otillgänglig — använder enkel rutt istället.',
  'route.networkError': 'Kunde inte ansluta till ruttservern. Kontrollera din internetanslutning och forsok igen. Vissa appwebbläsare (som Telegram) kan blockera detta -- forsok oppna i Chrome eller Safari istallet.',
  'route.save': 'Spara rutt',
  'route.saved': 'Sparad!',
  'route.newRoute': 'Ny rutt',
  'route.startRun': 'Starta löpning',
  'route.showControls': 'Visa kontroller',
  'route.hideControls': 'Dolj kontroller',

  // Route modes
  'routeMode.standard': 'Snabb',
  'routeMode.ai': 'AI',

  // Scenic modes
  'scenic.standard': 'Standard',
  'scenic.explore': 'Utforska',

  // Navigation
  'nav.starting': 'Startar...',
  'nav.then': 'Sedan: {instruction}',
  'nav.offRoute': 'Utanför rutten',
  'nav.headToRejoin': 'Gå {direction} för att återgå till rutten',
  'nav.backOnRoute': 'Tillbaka på rutten.',
  'nav.offRouteVoice': 'Utanför rutten. Gå {direction} för att återgå.',
  'nav.stop': 'Stopp',
  'nav.pause': 'Paus',
  'nav.resume': 'Fortsätt',
  'nav.end': 'Avsluta',
  'nav.paused': 'PAUSAD',
  'nav.dismiss': 'Stäng',

  // Metrics
  'metrics.pace': 'Tempo',
  'metrics.avgPace': 'Snittempo',
  'metrics.distance': 'Distans',
  'metrics.time': 'Tid',
  'metrics.remaining': 'Kvar',
  'metrics.calories': 'Kalorier',

  // Landmarks
  'landmarks.title': 'Landmärken längs rutten ({count})',
  'landmarks.fromRoute': '{distance}m från rutten',

  // Saved routes
  'routes.title': 'Rutter',
  'routes.noSaved': 'Inga sparade rutter',
  'routes.noSavedHint': 'Generera en rutt och tryck Spara för att lägga till den här',
  'routes.delete': 'Radera',
  'routes.run': 'Kör',
  'routes.loading': 'Laddar...',

  // History
  'history.title': 'Historik',
  'history.noRuns': 'Inga löpningar ännu',
  'history.noRunsHint': 'Genomför din första löpning för att se den här',
  'history.loading': 'Laddar...',
  'history.at': 'kl',

  // Settings
  'settings.title': 'Inställningar',
  'settings.claudeSubscription': 'Claude Haiku API',
  'settings.noApiKeyNeeded': 'Optimerad for hastighet och lag kostnad',
  'settings.voiceNavigation': 'Röstnavigering',
  'settings.voiceNavigationHint': 'Läs upp svänginstruktioner',
  'settings.voiceStyle': 'Röststil',
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
  'settings.runningPace': 'Löptempo',
  'settings.paceHint': 'Används för beräknad löptid. Standard: 6:00/km',
  'settings.bodyWeight': 'Kroppsvikt',
  'settings.save': 'Spara inställningar',
  'settings.saved': 'Sparat!',
  'settings.language': 'Språk',

  // Dialogs
  'dialog.endRun.title': 'Avsluta löpning?',
  'dialog.endRun.message': 'Din löpning sparas i historiken.',
  'dialog.endRun.keepGoing': 'Fortsätt',
  'dialog.endRun.confirm': 'Avsluta',

  'dialog.crashRecovery.title': 'Oavslutad löpning hittad',
  'dialog.crashRecovery.distance': 'Distans',
  'dialog.crashRecovery.time': 'Tid',
  'dialog.crashRecovery.started': 'Startad',
  'dialog.crashRecovery.discard': 'Kasta',
  'dialog.crashRecovery.resume': 'Återuppta',

  'dialog.deleteRoute.title': 'Radera rutt?',
  'dialog.deleteRoute.message': 'Den sparade rutten tas bort permanent.',
  'dialog.deleteRoute.keep': 'Behåll',
  'dialog.deleteRoute.confirm': 'Radera',

  'dialog.deleteRun.title': 'Radera löpning?',
  'dialog.deleteRun.message': 'Löpningen tas bort permanent från din historik.',
  'dialog.deleteRun.keep': 'Behåll',
  'dialog.deleteRun.confirm': 'Radera',

  'dialog.discardRun.title': 'Kasta löpning?',
  'dialog.discardRun.message': 'Löpningen raderas permanent.',
  'dialog.discardRun.keep': 'Behåll',
  'dialog.discardRun.confirm': 'Kasta',

  // Run summary
  'summary.saveRun': 'Spara löpning',
  'summary.discard': 'Kasta',
  'summary.calorieNoteKm': 'Baserat på 70 kg -- uppdatera vikt i Inställningar',
  'summary.calorieNoteMi': 'Baserat på 154 lbs -- uppdatera vikt i Inställningar',

  // Run detail
  'detail.deleteRun': 'Radera löpning',

  // Tab bar
  'tab.map': 'Karta',
  'tab.history': 'Historik',
  'tab.routes': 'Rutter',

  // Offline
  'offline.message': 'Du är offline',

  // Stats
  'stats.title': 'Statistik',
  'stats.totalDistance': 'Total distans',
  'stats.totalRuns': 'Rundor',
  'stats.avgPace': 'Snittempo',
  'stats.fastestPace': 'Snabbaste tempo',
  'stats.longestRun': 'Längsta runda',
  'stats.totalTime': 'Total tid',
  'stats.weeklyDistance': 'Veckodistans',
  'stats.paceTrend': 'Tempoutveckling',
  'stats.streak': '{count} veckor i rad',
  'stats.bestStreak': 'Bäst: {count} veckor',
  'stats.noData': 'Genomför din första runda för att se statistik',
  'stats.personalRecords': 'Personliga rekord',
  'stats.thisWeek': 'Denna vecka',
  'stats.months.short': 'Jan,Feb,Mar,Apr,Maj,Jun,Jul,Aug,Sep,Okt,Nov,Dec',

  // Auth
  'auth.title': 'Logga in på Drift',
  'auth.subtitle': 'Spara dina löpningar och rutter mellan enheter',
  'auth.emailPlaceholder': 'E-postadress',
  'auth.sendLink': 'Skicka inloggningslänk',
  'auth.sending': 'Skickar...',
  'auth.checkEmail': 'Kolla din e-post!',
  'auth.checkEmailHint': 'Vi skickade en inloggningslänk till {email}',
  'auth.tryAgain': 'Prova en annan e-post',
  'auth.error': 'Kunde inte skicka länken. Försök igen.',
  'auth.signOut': 'Logga ut',
  'auth.skipForNow': 'Hoppa över',
};

export default sv;
