#!/bin/bash
set -e

echo "=== 1. Setting up Java 21 (Eclipse Temurin) ==="
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
if [ ! -f "$JAVA_HOME/bin/javac" ]; then
    echo "Downloading and installing Eclipse Temurin Java 21..."
    mkdir -p "$JAVA_HOME"
    wget -qO- https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jdk_x64_linux_hotspot_21.0.5_11.tar.gz | tar -xz -C "$JAVA_HOME" --strip-components=1
fi

export PATH=$JAVA_HOME/bin:$PATH
java -version
javac -version

echo "=== 2. Checking Android SDK ==="
export ANDROID_HOME=/opt/android-sdk
mkdir -p "$ANDROID_HOME/cmdline-tools"

if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
    echo "Downloading Android Command-Line Tools..."
    cd "$ANDROID_HOME/cmdline-tools"
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
    unzip -q commandlinetools-linux-11076708_latest.zip
    mv cmdline-tools latest
    rm -f commandlinetools-linux-11076708_latest.zip
fi

export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin

echo "=== 3. Accepting Android Licenses & Installing SDK Packages ==="
yes | sdkmanager --licenses > /dev/null 2>&1 || true

if [ ! -d "$ANDROID_HOME/platforms/android-35" ] && [ ! -d "$ANDROID_HOME/platforms/android-36" ]; then
    echo "Installing Android platforms and build tools..."
    sdkmanager "platforms;android-35" "build-tools;35.0.0" "platforms;android-36" "build-tools;36.0.0"
fi

echo "=== 4. Configuring local.properties ==="
cd /app/applet
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

echo "=== 5. Building Web Assets & Syncing Capacitor ==="
npm run build
npx cap sync android

echo "=== 6. Building Android Debug APK ==="
cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

APK_SRC="/app/applet/android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_SRC" ]; then
    echo "=== 7. Copying APK for Download ==="
    mkdir -p /app/applet/public/download /app/applet/dist/download
    cp "$APK_SRC" /app/applet/public/download/FIELD-VISIT-TRACKER.apk
    cp "$APK_SRC" /app/applet/dist/download/FIELD-VISIT-TRACKER.apk
    cp "$APK_SRC" /app/applet/public/FIELD-VISIT-TRACKER.apk
    cp "$APK_SRC" /app/applet/dist/FIELD-VISIT-TRACKER.apk
    
    FILE_SIZE=$(ls -lh "$APK_SRC" | awk '{print $5}')
    echo "SUCCESS! APK built successfully. Size: $FILE_SIZE"
    echo "Download URL: /download/FIELD-VISIT-TRACKER.apk"
else
    echo "ERROR: APK file not found at $APK_SRC"
    exit 1
fi
