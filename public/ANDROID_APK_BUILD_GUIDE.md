# 📱 FeedIn Android APK Build Guide
## Complete Step-by-Step Instructions for Mac Users

---

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Install Required Software](#step-1-install-required-software)
3. [Step 2: Export Project to GitHub](#step-2-export-project-to-github)
4. [Step 3: Clone the Repository](#step-3-clone-the-repository)
5. [Step 4: Install Dependencies](#step-4-install-dependencies)
6. [Step 5: Add Android Platform](#step-5-add-android-platform)
7. [Step 6: Build the Web App](#step-6-build-the-web-app)
8. [Step 7: Sync to Android](#step-7-sync-to-android)
9. [Step 8: Open in Android Studio](#step-8-open-in-android-studio)
10. [Step 9: Build the APK](#step-9-build-the-apk)
11. [Step 10: Install on Your Phone](#step-10-install-on-your-phone)
12. [Troubleshooting](#troubleshooting)
13. [Quick Reference Commands](#quick-reference-commands)

---

## Prerequisites

Before you begin, make sure you have:
- ✅ A Mac computer
- ✅ Internet connection
- ✅ GitHub account (free at github.com)
- ✅ At least 10GB free disk space
- ✅ An Android phone for testing

---

## Step 1: Install Required Software

### 1.1 Install Node.js

1. Open your web browser
2. Go to: **https://nodejs.org**
3. Click the **LTS** (Long Term Support) version button
4. Download the `.pkg` file
5. Double-click the downloaded file
6. Follow the installation wizard (click Continue, Agree, Install)
7. Enter your Mac password when prompted

**Verify Installation:**
```bash
# Open Terminal (Cmd + Space, type "Terminal", press Enter)
node --version
# Should show something like: v20.x.x

npm --version
# Should show something like: 10.x.x
```

### 1.2 Install Android Studio

1. Open your web browser
2. Go to: **https://developer.android.com/studio**
3. Click **"Download Android Studio"**
4. Accept the terms and download
5. Open the downloaded `.dmg` file
6. Drag Android Studio to your Applications folder
7. Open Android Studio from Applications
8. Follow the setup wizard:
   - Choose "Standard" installation
   - Accept all licenses (scroll down and click Accept for each)
   - Wait for components to download (this takes 10-20 minutes)

### 1.3 Install Java JDK (if needed)

Android Studio usually installs Java automatically. To verify:
```bash
java --version
# Should show Java 17 or higher
```

If not installed:
1. Go to: **https://adoptium.net**
2. Download Temurin JDK 17 for macOS
3. Install the downloaded package

### 1.4 Install Git (if needed)

```bash
# Check if Git is installed
git --version

# If not installed, macOS will prompt you to install it
# Click "Install" when prompted
```

---

## Step 2: Export Project to GitHub

### 2.1 In Lovable Editor

1. Open your FeedIn project in Lovable
2. Look at the **top menu bar**
3. Click the **"GitHub"** button (has a GitHub icon)
4. Click **"Connect to GitHub"** if not connected
5. A popup will appear - click **"Authorize Lovable"**
6. Select your GitHub account
7. Click **"Create Repository"**
8. Name it: `feedinbeta` (or any name you prefer)
9. Wait for the export to complete (usually 1-2 minutes)
10. You'll see a success message with your repository URL

### 2.2 Copy Your Repository URL

After export, your URL will look like:
```
https://github.com/YOUR-USERNAME/feedinbeta
```

**Write this URL down - you'll need it!**

---

## Step 3: Clone the Repository

### 3.1 Open Terminal

1. Press **Cmd + Space** (opens Spotlight)
2. Type **"Terminal"**
3. Press **Enter**

### 3.2 Navigate to Desktop

```bash
cd ~/Desktop
```

### 3.3 Clone Your Repository

Replace `YOUR-USERNAME` with your actual GitHub username:
```bash
git clone https://github.com/YOUR-USERNAME/feedinbeta.git
```

**Expected Output:**
```
Cloning into 'feedinbeta'...
remote: Enumerating objects: xxx, done.
remote: Counting objects: 100%, done.
...
Receiving objects: 100%, done.
```

### 3.4 Enter the Project Folder

```bash
cd feedinbeta
```

---

## Step 4: Install Dependencies

This downloads all the code packages your app needs.

```bash
npm install
```

**Expected Output:**
```
added xxx packages in xxs
```

⏱️ **This may take 2-5 minutes**

---

## Step 5: Add Android Platform

This sets up the Android-specific files for your app.

```bash
npx cap add android
```

**Expected Output:**
```
✔ Adding native android project in android in x.xxs
✔ Syncing Gradle...
✔ add in x.xxs
```

---

## Step 6: Build the Web App

This compiles your app into optimized files.

```bash
npm run build
```

**Expected Output:**
```
vite build
✓ xxx modules transformed.
dist/index.html          x.xx kB
dist/assets/...
✓ built in x.xxs
```

---

## Step 7: Sync to Android

This copies your built web app into the Android project.

```bash
npx cap sync android
```

**Expected Output:**
```
✔ Copying web assets from dist to android/app/src/main/assets/public in x.xxs
✔ Creating capacitor.config.json in android/app/src/main/assets in x.xxms
✔ copy android in x.xxs
✔ Updating Android plugins in x.xxms
✔ update android in x.xxs
✔ Syncing Gradle in x.xxms
```

---

## Step 8: Open in Android Studio

```bash
npx cap open android
```

**What happens:**
- Android Studio will launch automatically
- It will open your project
- Wait for "Gradle sync" to complete (progress bar at bottom)
- This may take 5-10 minutes the first time

**If Android Studio asks about updates:**
- Click "Remind me later" or "Update" (either is fine)

---

## Step 9: Build the APK

### 9.1 In Android Studio Menu

1. Click **"Build"** in the top menu bar
2. Click **"Build Bundle(s) / APK(s)"**
3. Click **"Build APK(s)"**

### 9.2 Wait for Build

- Look at the bottom of Android Studio
- You'll see "Gradle Build Running..."
- Wait for it to complete (2-5 minutes)

### 9.3 Find Your APK

When the build is done:
1. A popup appears: **"Build APK(s)"** - click **"locate"**
2. Or navigate manually to:
   ```
   ~/Desktop/feedinbeta/android/app/build/outputs/apk/debug/app-debug.apk
   ```

**Your APK file is called: `app-debug.apk`**

---

## Step 10: Install on Your Phone

### Option A: Direct USB Transfer

1. Connect your Android phone to your Mac with a USB cable
2. On your phone, tap **"Allow"** when asked about file access
3. Open **Android File Transfer** on Mac (or use Finder)
4. Copy `app-debug.apk` to your phone's **Downloads** folder
5. On your phone:
   - Open **Files** or **My Files** app
   - Go to **Downloads**
   - Tap `app-debug.apk`
   - Tap **"Install"**
   - If blocked, go to Settings → Security → Allow unknown apps

### Option B: Email/Cloud Transfer

1. Email the APK to yourself
2. Or upload to Google Drive/Dropbox
3. Download on your phone
4. Tap to install

### Option C: ADB Install (Advanced)

```bash
# In Terminal, with phone connected via USB
adb install ~/Desktop/feedinbeta/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Troubleshooting

### ❌ "Repository not found" when cloning

**Cause:** Repository doesn't exist or is private

**Solution:**
1. Make sure you exported from Lovable first
2. Check the URL is correct
3. Try: `git clone https://YOUR-USERNAME@github.com/YOUR-USERNAME/feedinbeta.git`

### ❌ "npm: command not found"

**Cause:** Node.js not installed properly

**Solution:**
1. Close Terminal
2. Reinstall Node.js from nodejs.org
3. Open a new Terminal window

### ❌ "JAVA_HOME is not set"

**Cause:** Java not configured

**Solution:**
```bash
# Add to your ~/.zshrc file:
export JAVA_HOME=$(/usr/libexec/java_home)
export PATH=$JAVA_HOME/bin:$PATH

# Then run:
source ~/.zshrc
```

### ❌ Gradle sync failed

**Cause:** Missing SDK components

**Solution:**
1. In Android Studio, go to **Tools → SDK Manager**
2. Install **Android SDK Platform 34**
3. Install **Android SDK Build-Tools 34**
4. Click **Apply** and wait for download

### ❌ "SDK location not found"

**Cause:** Android SDK path not set

**Solution:**
Create a file called `local.properties` in the `android` folder:
```properties
sdk.dir=/Users/YOUR-MAC-USERNAME/Library/Android/sdk
```

### ❌ Build takes forever

**Cause:** First build downloads many files

**Solution:**
- First build can take 10-20 minutes
- Subsequent builds are faster (1-2 minutes)
- Make sure you have good internet connection

---

## Quick Reference Commands

```bash
# Navigate to Desktop
cd ~/Desktop

# Clone repository (replace YOUR-USERNAME)
git clone https://github.com/YOUR-USERNAME/feedinbeta.git

# Enter project folder
cd feedinbeta

# Install dependencies
npm install

# Add Android platform
npx cap add android

# Build web app
npm run build

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android

# Update after changes (repeat these)
npm run build
npx cap sync android
```

---

## 📞 Getting Help

If you get stuck:
1. **Take a screenshot** of the error
2. **Copy the exact error message** from Terminal
3. **Note which step** you're on
4. Ask for help with these details

---

## ✅ Success Checklist

- [ ] Node.js installed
- [ ] Android Studio installed
- [ ] Project exported to GitHub
- [ ] Repository cloned to Desktop
- [ ] Dependencies installed (npm install)
- [ ] Android platform added
- [ ] Web app built
- [ ] Synced to Android
- [ ] Opened in Android Studio
- [ ] APK built successfully
- [ ] APK installed on phone
- [ ] App running! 🎉

---

**Last Updated:** December 2024
**App:** FeedIn Beta
**Platform:** Android

---

*This guide was created for FeedIn app. For the latest updates, visit your Lovable project.*
