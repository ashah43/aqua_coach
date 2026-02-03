# Aqua Coach

A React Native / Expo app This README provides instructions for getting the app running on iOS.

---

## 1. Prerequisites

Make sure you have the following installed:

- Node.js (v18+ recommended)
- npm or yarn
- Xcode (for iOS)
- CocoaPods (`sudo gem install cocoapods`)
- Expo CLI (`npm install -g expo-cli`)

---

## 2. Clone the Repository

```bash
git clone <your-repo-url>
cd aqua_coach

## 3. Create your own branch

##install dependencies
%npm install
% cd ios
% install pods
% cd ..
% cp .env.example .env
to navigate to xcode build:
% ios/open rowing.xcworkspace


## Check your Local setupL Bundle_identifier needs to match and BE DIFFERENT FROM MINE. AN ID CAN ONLY BE USED ONCE AND CONNECTED TO YOUR APPLE ID
in app.json: "bundleIdentifier": "com.kaylahall.rowing", replace with your own ID which is connetced to what you named it in Xcode and the developer build on you phone
now check in ios/rowing.xcodeproj/project.xc.workspace/project.pbxproj
also search for "PRODUCT_BUNDLE_IDENTIFIER = com.kaylahall.rowing;" there are two instances that need to match your Xcode Sign in

## Build and run
Connect you rphone to the laptop, make sure laptop and phoen are on the same wifi.
Now make sure you are at the root folder of the project 
% npx expo run:ios --device
and click enter if your device is highlited and the computer recongizes it
this will build the app on your phone and lots of compilations
Now for regualr updates not in ios you can run
% npx expo start --dev-client                             

