# Mobile App Setup and Testing Instructions

## Environment Setup

### Prerequisites
1. **Node.js**: Already installed (v22.17.0 ✓)
2. **React Native CLI**: Already installed (v20.0.0 ✓)

### Android Development
To test on Android device/emulator:

```bash
# Install Android Studio and SDK
# Download from: https://developer.android.com/studio

# Add to ~/.zshrc or ~/.bash_profile:
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Install Java 11 (required for React Native)
brew install openjdk@11
```

### iOS Development
To test on iOS device/simulator:

```bash
# Install CocoaPods
sudo gem install cocoapods

# Install iOS dependencies
cd ios && pod install
```

## Build and Run

### Android
```bash
# Start Metro bundler
npx react-native start

# In another terminal, run Android
npx react-native run-android
```

### iOS
```bash
# Start Metro bundler
npx react-native start

# In another terminal, run iOS
npx react-native run-ios
```

## Testing Barcode Scanner

### Test Barcode: ABC-abc-1234
- The app is configured to recognize various barcode formats
- Use the test barcode "ABC-abc-1234" that was used in the web version
- Camera permissions are properly configured for both platforms

### Key Features Implemented:
1. **Authentication**: Login screen with AsyncStorage token management
2. **Dashboard**: Analytics and inventory overview
3. **Products**: Product listing with search and stock status
4. **Scanner**: Barcode scanning with camera permissions and stock management
5. **Analytics**: Sales and inventory analytics
6. **Profile**: User information and logout functionality

### API Integration:
- All screens are connected to the same backend API as the web version
- Authentication tokens are stored in AsyncStorage
- API base URL is configurable in `src/services/api.ts`

## Architecture

### Navigation Structure:
- Stack Navigator for authentication flow
- Bottom Tab Navigator for main app screens
- Automatic authentication state management

### Permissions:
- **Android**: Camera, storage, and vibrate permissions in AndroidManifest.xml
- **iOS**: Camera usage description in Info.plist

### Dependencies:
- React Navigation for navigation
- React Native Vision Camera for barcode scanning
- AsyncStorage for data persistence
- Toast messages for user feedback
- React Native Permissions for runtime permissions

## Troubleshooting

### Common Issues:
1. **Metro bundler cache**: `npx react-native start --reset-cache`
2. **Android build issues**: Clean and rebuild in Android Studio
3. **iOS build issues**: `cd ios && pod install && cd ..`
4. **Camera permissions**: Ensure physical device testing (camera doesn't work in simulator)

### Camera Testing:
- Must test on physical device (camera not available in simulators)
- Ensure good lighting conditions
- Hold barcode steady in camera view
- Test with various barcode types (Code 128, Code 39, EAN, etc.)
