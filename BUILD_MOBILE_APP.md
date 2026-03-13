# Building Askify Mobile App (Full Native APK)

## What You Get
- **Full native mobile app** (not a tiny PWA wrapper — full APK with all native features)
- **Loads from minequest.fun** (your custom domain)
- **Full permissions**: Camera, Microphone, Video Call, Storage, Notifications
- **Compatible with Android 7.0 (API 24) through Android 15 (API 35)**

## Prerequisites
- [Android Studio](https://developer.android.com/studio) installed (latest version recommended — Ladybug or newer)
- [Node.js](https://nodejs.org/) installed
- Your project exported to GitHub

## Step-by-Step Build Guide

### 1. Export & Clone
```bash
# Clone your GitHub repository
git clone [your-github-repo-url]
cd [your-repo-folder]

# Install dependencies
npm install
```

### 2. Build & Add Android
```bash
# Build the web app
npm run build

# Add Android platform
npx cap add android

# Sync everything
npx cap sync android
```

### 3. Fix Android Version Compatibility (CRITICAL for Android 15)

Open `android/app/build.gradle` and update these values:

```gradle
android {
    compileSdk 35          // ← Change to 35
    
    defaultConfig {
        applicationId "fun.minequest.askify"
        minSdkVersion 24      // ← Supports Android 7.0+
        targetSdkVersion 35   // ← Required for Android 15
        versionCode 1
        versionName "1.0"
    }
}
```

Also open `android/variables.gradle` (or `android/build.gradle` root) and ensure:

```gradle
ext {
    minSdkVersion = 24
    compileSdkVersion = 35
    targetSdkVersion = 35
    androidxActivityVersion = '1.9.0'
    androidxAppCompatVersion = '1.7.0'
    androidxCoordinatorLayoutVersion = '1.2.0'
    androidxCoreVersion = '1.15.0'
    androidxFragmentVersion = '1.8.0'
    junitVersion = '4.13.2'
    androidxJunitVersion = '1.2.1'
    androidxEspressoCoreVersion = '3.6.1'
    cordovaAndroidVersion = '10.1.1'
}
```

### 4. Add Required Permissions

Open `android/app/src/main/AndroidManifest.xml` and add these permissions BEFORE the `<application>` tag:

```xml
<!-- Camera & Video -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />

<!-- Video/Voice Call -->
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

<!-- Network -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Storage (scoped storage for Android 10+, legacy for older) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />

<!-- Notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />

<!-- Foreground service (for calls) -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />

<!-- WebRTC -->
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
<uses-feature android:name="android.hardware.microphone" android:required="false" />
```

Also, inside the `<application>` tag, make sure you have:

```xml
<application
    android:usesCleartextTraffic="true"
    android:networkSecurityConfig="@xml/network_security_config"
    ...>
```

### 5. Add Network Security Config (for Android 9+)

Create `android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">minequest.fun</domain>
        <domain includeSubdomains="true">localhost</domain>
    </domain-config>
</network-security-config>
```

### 6. Enable WebRTC in WebView

Open `android/app/src/main/java/fun/minequest/askify/MainActivity.java` and update it:

```java
package fun.minequest.askify;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Enable modern web features
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setAllowFileAccess(true);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(false);
        }
        
        // Set custom WebChromeClient for WebRTC permissions
        webView.setWebChromeClient(new WebChromeClientCustom());
    }
}
```

Create `android/app/src/main/java/fun/minequest/askify/WebChromeClientCustom.java`:

```java
package fun.minequest.askify;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class WebChromeClientCustom extends WebChromeClient {
    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        // Auto-grant WebRTC permissions (camera, microphone)
        request.grant(request.getResources());
    }
}
```

### 7. Build the APK

```bash
# Open in Android Studio
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync to complete
2. If prompted to update AGP (Android Gradle Plugin), accept the update
3. Go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
4. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### 8. Build a Signed Release APK (Production)

For a full production APK:
1. In Android Studio: **Build** → **Generate Signed Bundle / APK**
2. Choose **APK**
3. Create a new keystore or use existing
4. Select **release** build type
5. The signed APK will be optimized

## Android Version Compatibility Chart

| Android Version | API Level | Supported |
|----------------|-----------|-----------|
| Android 7.0    | 24        | ✅        |
| Android 8.0    | 26        | ✅        |
| Android 9.0    | 28        | ✅        |
| Android 10     | 29        | ✅        |
| Android 11     | 30        | ✅        |
| Android 12     | 31-32     | ✅        |
| Android 13     | 33        | ✅        |
| Android 14     | 34        | ✅        |
| Android 15     | 35        | ✅        |

## Making the APK Larger (Full Offline App)

```bash
# In capacitor.config.ts, temporarily remove the server.url to bundle everything locally:
# Comment out the server block, then:
npm run build
npx cap sync android
```

This bundles all HTML/CSS/JS/assets INTO the APK, making it 15-50MB+ (a real full app).

## For iOS

```bash
npx cap add ios
npx cap sync ios
npx cap open ios
```

Requires Mac + Xcode + Apple Developer Account ($99/year).

## Updating the App

After making changes in Lovable:
1. Export to GitHub
2. `git pull`
3. `npm run build`
4. `npx cap sync android`
5. Rebuild in Android Studio

## Troubleshooting

### "App not available for your device" on Play Store / Direct Install
- Make sure `targetSdkVersion` is set to **35** in `build.gradle`
- Make sure `minSdkVersion` is **24** (covers 99%+ of Android devices)
- Rebuild the APK after changing these values

### WebView crashes on older Android
- The `minWebViewVersion` in capacitor.config.ts ensures a compatible WebView is present
- Users on very old devices may need to update Android System WebView from Play Store

### Camera/Mic not working
- Ensure the `WebChromeClientCustom` class is set up correctly
- Check that all permissions are declared in AndroidManifest.xml
- For Android 13+, `POST_NOTIFICATIONS` requires runtime permission

## Need Help?
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Studio Guide](https://developer.android.com/studio/intro)
- Contact: opgamer012321@gmail.com
