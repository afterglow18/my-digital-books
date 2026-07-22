import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mydigitalbooks.app',
  appName: 'My Books',
  webDir: 'dist/public',

  // -------------------------------------------------------------------------
  // iOS-specific configuration
  // -------------------------------------------------------------------------
  ios: {
    // Allow the WKWebView to scroll; the app manages its own scroll areas
    scrollEnabled: true,
    // Prevents white flash on launch
    backgroundColor: '#F9F4EE',
    // Allow inline media playback (used for wardrobe image previews)
    allowsInlineMediaPlayback: true,
    // Privacy usage descriptions — required by iOS TCC; missing any one causes
    // a SIGABRT crash or silent refusal when the camera/photo picker is opened.
    infoPlist: {
      NSCameraUsageDescription:
        'My Digital Books uses your camera to photograph clothing items for your wardrobe.',
      NSPhotoLibraryUsageDescription:
        'My Digital Books reads your photo library so you can add clothing photos to your wardrobe.',
      NSPhotoLibraryAddUsageDescription:
        'My Digital Books saves photos you capture to your photo library.',
    },
  },

  plugins: {
    // Keep the splash screen visible until the React app signals it is ready
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#F9F4EE',
      iosSpinnerStyle: 'small',
      showSpinner: false,
    },

    // Overlay the status bar so the cream background shows through the notch
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F9F4EE',
      overlaysWebView: true,
    },
  },
};

export default config;
