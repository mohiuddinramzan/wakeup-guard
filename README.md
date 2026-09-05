# Wakeup Guard

একটি অ্যালার্ম অ্যাপ যেখানে অ্যালার্ম বন্ধ করতে হলে সত্যিই জেগে উঠে কিছু একটা করতে হয় — শুধু একবার স্লাইড করলেই হয় না।

## ফিচার

- একাধিক অ্যালার্ম, প্রতিটির আলাদা সময়, লেবেল ও পুনরাবৃত্তির দিন
- প্রতিটি অ্যালার্মে একাধিক "বন্ধ করার চ্যালেঞ্জ" একসাথে চালু করা যায়:
  - ✍️ নির্দিষ্ট বাক্য হুবহু টাইপ করা (ডিফল্ট: *"I'm completely awake now. You can shut down."*, বাক্যটি বদলানো যায়)
  - 🔒 নিজের সেট করা পাসওয়ার্ড
  - 🧮 পরপর ৩টি অংক সঠিকভাবে সমাধান (সহজ/মাঝারি/কঠিন)
  - 📳 ফোন নির্দিষ্ট সংখ্যকবার ঝাঁকানো (devicemotion সেন্সর)
  - 👆 একটি বাটন নির্দিষ্ট সময় ধরে চেপে রাখা
  - 🔗 আগে থেকে সেট করা প্যাটার্ন (৩x৩ গ্রিডে ক্রমানুসারে বিন্দু চাপা)
  - 🙂 ক্যামেরার সামনে কয়েক সেকেন্ড থাকা (লাইভনেস-চেক, প্রকৃত ফেস-রিকগনিশন নয়)
- প্রতিটি অ্যালার্মের জন্য "টেস্ট" বাটন — সময়ের অপেক্ষা না করেই চ্যালেঞ্জ স্ক্রিন যাচাই করা যায়
- স্নুজ (৫ মিনিট) — প্রতিটি অ্যালার্মে আলাদাভাবে চালু/বন্ধ করা যায়
- সাউন্ড Web Audio API দিয়ে তৈরি (কোনো বাইরের mp3/wav ফাইলের দরকার নেই), সাথে ভাইব্রেশন

## ⚠️ Known limitations (দয়া করে ব্যবহারের আগে পড়ুন)

এই প্রজেক্টটি ইচ্ছাকৃতভাবে **কোনো বান্ডলার (webpack/vite) ছাড়া** সরাসরি `www/` ফোল্ডারে প্লেইন HTML/CSS/JS হিসেবে রাখা হয়েছে, যাতে তোমার Termux + `npx cap sync` + GitHub Actions ওয়ার্কফ্লোর সাথে সরাসরি খাপ খায়। এর কিছু বাস্তব সীমাবদ্ধতা আছে, যেগুলো এড়িয়ে না গিয়ে সরাসরি বলা দরকার:

1. **স্ক্রিন বন্ধ থাকা অবস্থায় ফায়ার করার জন্য এখন `@capacitor/local-notifications` যোগ করা হয়েছে** — অ্যাপের নিজের JS টাইমার শুধু অ্যাপ খোলা থাকা অবস্থাতেই কাজ করে (অ্যান্ড্রয়েড ব্যাকগ্রাউন্ডে গেলে/স্ক্রিন লক হলে JS টাইমার থেমে যায়, এটা সিস্টেম-লেভেল সীমাবদ্ধতা, কোড দিয়ে ঠিক করা যায় না)। তাই প্রতিটি অ্যালার্ম সেভ করার সময় Android-এর নিজস্ব নোটিফিকেশন-শিডিউলার দিয়েও একটা নোটিফিকেশন শিডিউল করা হয়, যেটা OS নিজে ডেলিভার করে — অ্যাপ বন্ধ/ব্যাকগ্রাউন্ডে থাকলেও। এটাই প্লেইন JS/বান্ডলার-ছাড়া সেটআপে সম্ভব সবচেয়ে ভালো সমাধান, তবে **আমি নিজে এটা কোনো অ্যান্ড্রয়েড ডিভাইসে চালিয়ে যাচাই করতে পারিনি** (আমার environment-এ ইন্টারনেট/ডিভাইস নেই) — নিচে "স্ক্রিন বন্ধ থাকলেও অ্যালার্ম বাজানো" অংশে সেটআপ ও টেস্ট করার ধাপ দেওয়া আছে, দয়া করে নিজে যাচাই করে দেখো।
   - এটা সাধারণ স্টক অ্যালার্ম-ক্লক অ্যাপের মতো লক-স্ক্রিনের উপর নিজে থেকে পুরো স্ক্রিন দখল করে বাজবে না (তার জন্য ফুল-স্ক্রিন-ইনটেন্ট + কাস্টম নেটিভ কোড লাগে, যা এই ভার্সনে নেই) — বরং একটা সাউন্ড/ভাইব্রেশনসহ নোটিফিকেশন আসবে, তাতে ট্যাপ করলে অ্যাপ খুলে চ্যালেঞ্জ স্ক্রিন দেখাবে।
   - ব্যাটারি অপ্টিমাইজেশন বন্ধ রাখা এবং অ্যান্ড্রয়েড ১২+ এ "Alarms & reminders" স্পেশাল পারমিশন আলাদাভাবে অন করা (নিচে দেখানো হয়েছে) — দুটোই নির্ভরযোগ্যতা বাড়ায়।
2. **ফেস চেক আসলে ফেস-রিকগনিশন নয়।** এটি শুধু ক্যামেরা চালু করে কয়েক সেকেন্ড অপেক্ষা করায় — কোনো ফেস-ডিটেকশন মডেল ব্যবহার করা হয়নি, কারণ সেটার জন্য একটি ML মডেল ফাইল (কয়েক MB) বান্ডেল করে ইন্টারনেট ছাড়া লোড করার ব্যবস্থা লাগত, যা এই সেটআপে যাচাই করা সম্ভব হয়নি।
3. **🎙️ ভয়েস চ্যালেঞ্জ সম্পূর্ণ সরিয়ে ফেলা হয়েছে।** Android WebView-তে ব্রাউজারের Speech Recognition backend নির্ভরযোগ্যভাবে কাজ করছিল না (permission ঠিকমতো দেওয়ার পরও "মাইক্রোফোন সমস্যা" এরর আসছিল) — এটা একটা প্ল্যাটফর্ম-লেভেল সীমাবদ্ধতা বলে মনে হচ্ছে, তাই এই চ্যালেঞ্জটা বাদ দেওয়া হয়েছে যাতে ভরসাযোগ্য নয় এমন কিছু অ্যাপে না থাকে।
4. AndroidManifest-এ CAMERA, VIBRATE পারমিশন যোগ করা দরকার (নিচের ধাপে দেখানো হয়েছে) — নাহলে ফেস চেক চ্যালেঞ্জ কাজ করবে না। (RECORD_AUDIO আগে ভয়েস চ্যালেঞ্জের জন্য যোগ করা হয়েছিল, এখন আর দরকার নেই — ম্যানিফেস্টে থেকে গেলেও ক্ষতি নেই, চাইলে সরিয়ে দিতে পারো।)

সংক্ষেপে: **এটা একটা মজার কিন্তু আন্তরিক "অলসতা-বিরোধী" অ্যালার্ম অ্যাপ**, তবে এটাকে জীবন-মরণ গুরুত্বপূর্ণ কোনো অ্যালার্মের (যেমন ওষুধ খাওয়ার রিমাইন্ডার) একমাত্র ভরসা বানিও না, যতক্ষণ না ব্যাকগ্রাউন্ড-রিলায়েবল নেটিভ অ্যালার্ম যোগ করা হচ্ছে।

## Termux-এ সেটআপ করার ধাপ

```bash
pkg update && pkg upgrade -y
pkg install git unzip gh -y
termux-setup-storage

cd ~
unzip /sdcard/Download/wakeup-guard.zip -d ~/
cd ~/wakeup-guard

gh auth login

git init
git add .
git commit -m "Initial commit - Wakeup Guard"
git branch -M main
gh repo create wakeup-guard --public --source=. --remote=origin --push

npm install

npx cap add android
npx cap sync android
```

তারপর ক্যামেরা/মাইক্রোফোন/ভাইব্রেশন পারমিশন যোগ করো:

```bash
sed -i 's#<application#<uses-permission android:name="android.permission.CAMERA"/>\n    <uses-permission android:name="android.permission.RECORD_AUDIO"/>\n    <uses-permission android:name="android.permission.VIBRATE"/>\n    <application#' android/app/src/main/AndroidManifest.xml

git add .
git commit -m "Add camera/mic/vibrate permissions"
git push
```

GitHub-এ পুশ করার পর `.github/workflows/build-apk.yml` ওয়ার্কফ্লোটি স্বয়ংক্রিয়ভাবে চলবে এবং Actions ট্যাবের artifacts থেকে ডিবাগ APK পাওয়া যাবে।

## স্ক্রিন বন্ধ থাকলেও অ্যালার্ম বাজানো (`@capacitor/local-notifications` ওয়্যার-আপ)

`npm install` করার পর `@capacitor/local-notifications` `node_modules`-এ চলে আসবে, কিন্তু আমাদের সেটআপে কোনো বান্ডলার নেই, তাই এই প্লাগিনটার নিজস্ব ব্রাউজার-বান্ডল ফাইল `www/` ফোল্ডারে কপি করে `<script>` ট্যাগ দিয়ে লোড করাতে হবে (index.html-এ আগে থেকেই `capacitor-local-notifications.js` নামে রেফারেন্স দেওয়া আছে)। আগে দেখে নাও আসল ফাইলের নাম কী:

```bash
cat node_modules/@capacitor/local-notifications/package.json | grep -E '"unpkg"|"jsdelivr"'
```

যে ফাইলের নাম দেখাবে (সাধারণত `dist/plugin.js` জাতীয় কিছু), সেটা কপি করো:

```bash
cp node_modules/@capacitor/local-notifications/dist/plugin.js www/capacitor-local-notifications.js
```

(উপরের ফাইলের path না মিললে, `ls node_modules/@capacitor/local-notifications/dist/` দিয়ে দেখে সঠিক নাম বসাও।)

নোটিফিকেশন ও এক্সাক্ট-অ্যালার্ম পারমিশন যোগ করো:

```bash
sed -i 's#<application#<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>\n    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>\n    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>\n    <application#' android/app/src/main/AndroidManifest.xml

npx cap sync android
git add .
git commit -m "Wire up local-notifications for screen-off alarms"
git push
```

APK ইনস্টল করার পর অ্যান্ড্রয়েড ১২+ ডিভাইসে ম্যানুয়ালি একটা জিনিস অন করতে হবে: **Settings → Apps → Wakeup Guard → Alarms & reminders (বা "Special app access")** — এটা প্লাগিন নিজে থেকে চাইতে পারে না, ব্যবহারকারীকেই অন করতে হয়।

**যেভাবে টেস্ট করবে:** অ্যাপে একটা অ্যালার্ম বসাও ২-৩ মিনিট পরের সময়ে, সেভ করো, তারপর অ্যাপ বন্ধ করে স্ক্রিন লক করে রাখো। নির্ধারিত সময়ে নোটিফিকেশন (সাউন্ড+ভাইব্রেশনসহ) আসা উচিত — ট্যাপ করলে অ্যাপ খুলে চ্যালেঞ্জ স্ক্রিন দেখাবে। যদি না আসে, তাহলে `capacitor-local-notifications.js` ফাইলটা ঠিকমতো কপি হয়েছে কিনা এবং উপরের পারমিশনগুলো সব দেওয়া আছে কিনা যাচাই করো — এই অংশটা আমি নিজে সরাসরি টেস্ট করে দেখাতে পারিনি বলে দোষ কোথায় সেটা প্রথমবার নিজেকেই ধরতে হতে পারে।

## appId / appName বদলাতে চাইলে

```bash
sed -i 's/"appId": ".*"/"appId": "com.yourname.yourapp"/' capacitor.config.json
sed -i 's/"appName": ".*"/"appName": "Your App Name"/' capacitor.config.json
npx cap sync android
```
