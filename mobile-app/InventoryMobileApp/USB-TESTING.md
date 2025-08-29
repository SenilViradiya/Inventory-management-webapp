# USB Device Testing Instructions

## ✅ Device Detected Successfully!
Your Android device is connected: `cea64a4b`

## Before Running the App

### 1. Enable Developer Options on Your Device
1. Go to **Settings** → **About Phone**
2. Tap **Build Number** 7 times
3. You'll see "You are now a developer!" message

### 2. Enable USB Debugging
1. Go to **Settings** → **Developer Options** (now visible)
2. Enable **USB Debugging**
3. When prompted, allow USB debugging from this computer

### 3. Allow App Installation from Unknown Sources
1. Go to **Settings** → **Security** or **Privacy**
2. Enable **Unknown Sources** or **Install Unknown Apps**
3. Allow installation from development builds

## Running the App

### Current Status:
- ✅ Device connected: `cea64a4b`
- ✅ Metro bundler running on port 8082
- ✅ Java 17 installed and configured
- ✅ Android platform tools installed
- ✅ Android SDK installed and configured
- ✅ Android Studio installed
- 🔄 **Building APK** (Installing NDK and compiling)

### Next Steps:
```bash
# Build and install on your device
cd mobile-app/InventoryMobileApp
npx react-native run-android --deviceId=cea64a4b
```

The first build will take several minutes as it downloads Gradle and builds the Android project.

## Testing the Inventory Scanner

Once the app installs and launches:

1. **Login Screen**: Use your backend credentials
2. **Scanner Tab**: Tap to open camera (will request permissions)
3. **Test Barcode**: Point camera at barcode "ABC-abc-1234"
4. **Stock Management**: App will detect barcode and show stock options

## Troubleshooting

### If app doesn't install:
- Ensure USB debugging is enabled
- Check device trust settings
- Try: `adb devices` to verify connection

### If camera doesn't work:
- Grant camera permission when prompted
- Ensure good lighting
- Hold barcode steady in camera view

### If backend connection fails:
- Update API base URL in `src/services/api.ts`
- Ensure backend is running on port 5001
- Check network connection

## App Features Ready to Test:
- 📱 **Authentication**: Login with your existing credentials
- 📊 **Dashboard**: View inventory analytics
- 📦 **Products**: Browse and search products
- 📸 **Scanner**: Barcode scanning with camera
- 📈 **Analytics**: Sales and inventory reports
- 👤 **Profile**: User settings and logout
