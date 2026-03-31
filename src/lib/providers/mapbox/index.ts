import { registerProvider } from '../registry';
import { MapboxRouter } from './router';
import { MapboxGeocoder } from './geocoder';
import { MapboxPOIProvider } from './poi';

export { MapboxRouter, MapboxGeocoder, MapboxPOIProvider };

export function registerMapboxProvider(): void {
  registerProvider('mapbox', {
    router: new MapboxRouter(),
    geocoder: new MapboxGeocoder(),
    poi: new MapboxPOIProvider(),
  });
}
