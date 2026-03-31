import { registerProvider } from '../registry';
import { GoogleRouter } from './router';
import { GoogleGeocoder } from './geocoder';
import { GooglePOIProvider } from './poi';

export { GoogleRouter, GoogleGeocoder, GooglePOIProvider };

export function registerGoogleProvider(): void {
  registerProvider('google', {
    router: new GoogleRouter(),
    geocoder: new GoogleGeocoder(),
    poi: new GooglePOIProvider(),
  });
}
