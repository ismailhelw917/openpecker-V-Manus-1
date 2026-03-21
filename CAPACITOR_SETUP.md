# OpenPecker iOS & Android App Setup Guide

## Timeline: 2-3 weeks to App Store/Play Store submission

### Phase 1: Capacitor Setup (Days 1-2)

```bash
# 1. Install Capacitor CLI
npm install -g @capacitor/cli

# 2. Initialize Capacitor in the project
npx cap init

# When prompted:
# - App name: OpenPecker
# - App ID: com.openpecker.app
# - Web dir: dist

# 3. Install Capacitor core and plugins
npm install @capacitor/core @capacitor/app @capacitor/splash-screen @capacitor/status-bar

# 4. Add iOS and Android platforms
npx cap add ios
npx cap add android
```

### Phase 2: Build Web App (Day 2-3)

```bash
# Build the web app for production
npm run build

# Copy web assets to native projects
npx cap copy
```

### Phase 3: iOS Setup (Days 3-5)

**Requirements:**
- macOS (required for iOS development)
- Xcode 14+
- Apple Developer Account ($99/year)

```bash
# Open iOS project in Xcode
npx cap open ios

# In Xcode:
# 1. Select OpenPecker target
# 2. Go to Signing & Capabilities
# 3. Select your team
# 4. Update Bundle ID to: com.openpecker.app
# 5. Set minimum iOS version to 13.0
# 6. Add app icons (1024x1024 PNG)
# 7. Add launch screen images
```

**App Store Submission:**
- Create App Store Connect entry
- Add screenshots (5 per device type)
- Write app description & keywords
- Set pricing tier
- Submit for review (1-7 days)

### Phase 4: Android Setup (Days 5-7)

**Requirements:**
- Android Studio
- Google Play Developer Account ($25 one-time)
- JDK 11+

```bash
# Open Android project in Android Studio
npx cap open android

# In Android Studio:
# 1. Select app module
# 2. Go to Build > Generate Signed Bundle/APK
# 3. Create keystore (save securely!)
# 4. Generate signed APK
# 5. Add app icons (192x192, 512x512 PNG)
```

**Play Store Submission:**
- Create Google Play Console entry
- Upload signed APK
- Add screenshots (5 per device type)
- Write app description & keywords
- Set pricing tier
- Submit for review (2-3 hours)

### Phase 5: Configuration Files

**capacitor.config.ts:**
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.openpecker.app',
  appName: 'OpenPecker',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
```

### Phase 6: Native Features (Optional)

Add native capabilities as needed:
- Push notifications: `@capacitor/push-notifications`
- Camera: `@capacitor/camera`
- Geolocation: `@capacitor/geolocation`
- Storage: `@capacitor/preferences`

### Required Assets

**App Icons:**
- 1024x1024 PNG (App Store)
- 512x512 PNG (Play Store)
- 192x192 PNG (Android)

**Screenshots:**
- 5 screenshots per device type
- Recommended: 1242x2688 (iPhone 12 Pro Max)
- Recommended: 1440x2960 (Android)

**Metadata:**
- App name: OpenPecker
- Tagline: "Master opening tactics through deliberate repetition"
- Description: Full description of features
- Keywords: chess, training, puzzles, openings, tactics
- Support email: support@openpecker.com
- Privacy policy URL: https://openpecker.com/privacy
- Terms of service URL: https://openpecker.com/terms

### Testing Checklist

- [ ] All features work on iOS
- [ ] All features work on Android
- [ ] Offline functionality tested
- [ ] Performance acceptable
- [ ] No console errors
- [ ] Responsive design verified
- [ ] Touch interactions work properly
- [ ] App icons display correctly
- [ ] Splash screen shows properly

### Estimated Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Capacitor Setup | 2 days | Pending |
| Build & Config | 1 day | Pending |
| iOS Development | 2 days | Pending |
| Android Development | 2 days | Pending |
| Testing | 2 days | Pending |
| App Store Submission | 1-7 days | Pending |
| Play Store Submission | 2-3 hours | Pending |
| **Total** | **2-3 weeks** | **Pending** |

### Next Steps

1. Ensure macOS is available for iOS development
2. Create Apple Developer Account
3. Create Google Play Developer Account
4. Prepare app icons and screenshots
5. Run `npm run build` to create production bundle
6. Follow Phase 1 setup commands
7. Test on iOS simulator and Android emulator
8. Submit to both app stores

### Support

For issues:
- Check Capacitor docs: https://capacitorjs.com/docs
- iOS issues: Check Xcode build logs
- Android issues: Check Android Studio logcat
- Web issues: Check browser console
