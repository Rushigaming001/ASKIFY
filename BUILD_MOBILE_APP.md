# Building Askify Mobile App (Full Native APK)

## What You Get
- **Full native mobile app** (not a tiny PWA wrapper — full APK with all native features)
- **Loads from minequest.fun** (your custom domain)
- **Full permissions**: Camera, Microphone, Video Call, Storage, Notifications

## Prerequisites
- [Android Studio](https://developer.android.com/studio) installed
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

### 3. Add Required Permissions

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

<!-- Storage -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

<!-- Notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />

<!-- WebRTC -->
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
<uses-feature android:name="android.hardware.microphone" android:required="false" />
```

### 4. Enable WebRTC in WebView

Open `android/app/src/main/java/.../MainActivity.java` and update it:

```java
package fun.minequest.askify;

import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
}
```

Then create a custom WebChromeClient. In `android/app/src/main/java/fun/minequest/askify/` create `WebChromeClientCustom.java`:

```java
package fun.minequest.askify;

import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

public class WebChromeClientCustom extends WebChromeClient {
    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        request.grant(request.getResources());
    }
}
```

### 5. Build the APK

```bash
# Open in Android Studio
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync to complete
2. Go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### 6. Build a Signed Release APK (Larger, Production)

For a full production APK:
1. In Android Studio: **Build** → **Generate Signed Bundle / APK**
2. Choose **APK**
3. Create a new keystore or use existing
4. Select **release** build type
5. The signed APK will be much larger and optimized

## Making the APK Larger (Full App)

The APK was small (1.19 MB) because it only loaded from a URL. To make it a full offline-capable app:

```bash
# In capacitor.config.ts, temporarily remove the server.url to bundle everything locally:
# Comment out the server block, then:
npm run build
npx cap sync android
```

This bundles all HTML/CSS/JS/assets INTO the APK, making it 15-50MB+ (a real full app).

Then rebuild in Android Studio.

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

## Need Help?
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Studio Guide](https://developer.android.com/studio/intro)
- Contact: opgamer012321@gmail.com
