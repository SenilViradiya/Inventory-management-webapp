# Android Development Environment Setup

## Quick Setup Guide

### 1. Install Java Development Kit (JDK)
```bash
# Install OpenJDK 17 (recommended)
brew install openjdk@17

# Add to your ~/.zshrc
export JAVA_HOME=/usr/local/opt/openjdk@17
export PATH=$JAVA_HOME/bin:$PATH

# Reload your shell
source ~/.zshrc
```

### 2. Install Android Studio
1. Download from: https://developer.android.com/studio
2. Install Android Studio
3. During setup, install:
   - Android SDK
   - Android SDK Platform
   - Android Virtual Device (AVD)

### 3. Set Environment Variables
Add to your `~/.zshrc`:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

### 4. Create Android Emulator
1. Open Android Studio
2. Go to Tools > AVD Manager
3. Create Virtual Device
4. Choose a device (Pixel 6 recommended)
5. Download system image (API 33+ recommended)
6. Finish setup

### 5. Install CocoaPods (for iOS)
```bash
sudo gem install cocoapods
cd ios && pod install
```

## Alternative: Test Without Emulator

### Option 1: Use Physical Android Device
1. Enable Developer Options on your Android phone
2. Enable USB Debugging
3. Connect via USB
4. Run: `npx react-native run-android`

### Option 2: Test Core Logic
Run the app in Metro bundler and test components individually:
```bash
npx react-native start
```

### Option 3: Use Expo Go (Quick Test)
Though we built without Expo, you can quickly test with:
```bash
npm install -g @expo/cli
npx create-expo-app --template bare-minimum TestApp
# Copy our screens to test functionality
```

## Verification Commands
```bash
# Check Java version
java -version

# Check Android SDK
adb devices

# Check emulators
emulator -list-avds

# Test React Native
npx react-native doctor
```

## Quick Fix Commands
```bash
# Install Watchman (recommended)
brew install watchman

# Install Android command line tools
brew install android-platform-tools
```
