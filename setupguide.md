# কনফিগারযোগ্য Web TV — বাংলা সেটআপ গাইড

এই প্রকল্পটি HTML, CSS ও Vanilla JavaScript দিয়ে তৈরি। চ্যানেল, বিভাগ, রং, ব্র্যান্ডিং এবং আচরণের বেশিরভাগ পরিবর্তন JSON ফাইল সম্পাদনা করেই করা যায়। কোনো সার্ভার, ডেটাবেস, লগইন বা অ্যাডমিন প্যানেল নেই। পছন্দ, পছন্দের চ্যানেল ও দেখার ইতিহাস শুধু ব্যবহারকারীর নিজের ব্রাউজারে থাকে।

> **গুরুত্বপূর্ণ:** শুধু নিজের বা ব্যবহারের অনুমতি আছে এমন স্ট্রিম URL, DRM কনফিগারেশন, YouTube এমবেড ও লাইসেন্স সার্ভার ব্যবহার করুন। JSON ফাইলে দেওয়া DRM key বা license URL গোপন থাকে না; সাইটের ফাইল পড়তে পারা যে কেউ সেগুলো দেখতে পারে।

## প্রথমবার চালু করা

1. ZIP ফাইলটি আনজিপ করুন। `index.html`, `style.css`, `player.js`, `storage.js`, `sw.js`, `manifest.json`, `icon.svg`, দুইটি স্থানীয় player library এবং `data` ফোল্ডার একই প্রকল্প ফোল্ডারে আছে কি না দেখুন।
2. `data/settings.json`, `data/categories.json` এবং `data/channels.json` সম্পাদনা করতে সাধারণ text editor ব্যবহার করুন। JSON-এর quote, comma এবং bracket ঠিক রাখুন।
3. `data/channels.json`-এ নিজের অনুমোদিত চ্যানেল ও স্ট্রিম যোগ করুন। প্রকল্পে ইচ্ছাকৃতভাবে কোনো অননুমোদিত বা নকল স্ট্রিম দেওয়া নেই; প্রাথমিক চ্যানেল তালিকা ফাঁকা।
4. শুধু `file://` দিয়ে `index.html` খুলবেন না। JavaScript module, fetch এবং Service Worker-এর জন্য লোকাল HTTP সার্ভার বা HTTPS static hosting ব্যবহার করুন।
5. সহজ লোকাল পরীক্ষার জন্য প্রকল্প ফোল্ডারে Python থাকলে চালান:

   ```bash
   python3 -m http.server 8000
   ```

   তারপর ব্রাউজারে `http://localhost:8000/` খুলুন। Python না থাকলে যেকোনো সাধারণ static web server ব্যবহার করা যায়।
6. পরিবর্তনের পর নতুন JSON আনতে পেজ রিফ্রেশ করুন। পুরোনো config দেখা গেলে Settings-এর **Check for updates** বোতামটি অ্যাপের Service Worker পরীক্ষা করে; JSON নেটওয়ার্ক-ফার্স্ট পদ্ধতিতে আনা হয়।

## `settings.json` — সম্পূর্ণ নমুনা

`data/settings.json`-এ অ্যাপের পরিচয়, রং, notice, navigation, home page, player setting, default channel, version এবং maintenance mode রাখা হয়। Logo/icon URL ফাঁকা থাকলে app-এর built-in icon/wordmark ব্যবহৃত হয়।

```json
{
  "appName": "Luma TV",
  "shortName": "Luma TV",
  "logoUrl": "",
  "faviconUrl": "",
  "appIconUrl": "",
  "tagline": "Your channels. Your screen.",
  "description": "A configurable live television experience.",
  "themeColor": "#e83b4f",
  "primaryColor": "#ee4054",
  "secondaryColor": "#ffd166",
  "backgroundColor": "#0c0e12",
  "surfaceColor": "#171a20",
  "defaultTheme": "dark",
  "notice": "নিজের অনুমোদিত চ্যানেল যোগ করুন।",
  "noticeVisible": true,
  "navigation": [
    { "id": "home", "label": "Home", "icon": "⌂", "href": "#home", "visible": true },
    { "id": "channels", "label": "All channels", "icon": "▦", "href": "#channels", "visible": true },
    { "id": "favorites", "label": "Favorites", "icon": "♡", "href": "#favorites", "visible": true },
    { "id": "settings", "label": "Settings", "icon": "⚙", "href": "#settings", "visible": true }
  ],
  "home": {
    "showFeatured": true,
    "showContinueWatching": true,
    "showRecentlyWatched": true,
    "showFavorites": true,
    "showCategories": true
  },
  "player": {
    "autoPlay": true,
    "defaultVolume": 0.8,
    "autoHideControlsMs": 4000
  },
  "defaultChannel": "",
  "appVersion": "1.0.1",
  "configurationVersion": 1,
  "lastUpdated": "2026-11-10",
  "maintenanceMode": false
}
```

- `appName`, `shortName`, `tagline`, `description` বদলালে পেজের branding বদলায়।
- রং CSS custom property-তে বসে। `#RRGGBB` ধরনের hex রং ব্যবহার করুন। `defaultTheme`-এর মান `dark`, `light` বা `system` হবে। ব্যবহারকারীর হাতে বেছে নেওয়া theme এই ডিভাইসে সংরক্ষিত হয়।
- `noticeVisible` `true` এবং `notice`-এ লেখা থাকলেই banner দেখাবে।
- Navigation item লুকাতে `visible`-কে `false` করুন। `href` হিসেবে পেজের পরিচিত section-এর hash ব্যবহার করুন।
- `autoHideControlsMs` মিলিসেকেন্ডে; চার সেকেন্ডের জন্য `4000` দিন। `defaultVolume` শূন্য থেকে একের মধ্যে রাখুন।
- `logoUrl`, `faviconUrl`, `appIconUrl`-এ নিজস্ব image-এর URL দিন। স্থানীয় ফাইল দিলে একই origin-এ রাখুন এবং relative path ব্যবহার করুন।
- `maintenanceMode` চালু করলে ব্যবহারকারীকে maintenance notice দেখানো হয়; এটি স্বয়ংক্রিয়ভাবে চ্যানেল JSON মুছে বা stream বন্ধ করে না।

## বিভাগ যোগ করা

`data/categories.json` একটি JSON array। নতুন বিভাগ যোগ করতে নতুন object কপি করুন। `id` হবে ছোট হাতের অক্ষর/সংখ্যা এবং প্রয়োজনে `_` বা `-`; `channels.json`-এর `category`-তে একই ID লিখতে হবে।

```json
[
  { "id": "all", "name": "All", "icon": "✦", "description": "সব চ্যানেল", "displayOrder": 0, "visible": true, "featured": true },
  { "id": "news", "name": "News", "icon": "◉", "description": "সংবাদ", "displayOrder": 1, "visible": true, "featured": true },
  { "id": "culture", "name": "Culture", "icon": "♫", "description": "সংস্কৃতি ও অনুষ্ঠান", "displayOrder": 2, "visible": true, "featured": false }
]
```

- `name` ও `icon` পর্দায় দেখা যায়। যেকোনো emoji বা সাধারণ চিহ্ন icon হিসেবে দিতে পারেন।
- কম `displayOrder` আগে দেখায়। একই সংখ্যা দিলে তাদের আপেক্ষিক ক্রম নিশ্চিত নয়।
- `visible: false` দিলে বিভাগ category filter-এ আর দেখাবে না।
- `featured: true` দিলে বিভাগ Home page-এর Explore categories অংশে দেখা যেতে পারে।
- `all` একটি বিশেষ filter ID; এটি বেছে নিলে সব দৃশ্যমান চ্যানেল দেখায়।

## চ্যানেল যোগ করা

`data/channels.json`-এ channel ID-কে key করে object লিখুন। নিচের নমুনাটি কাঠামো বোঝানোর জন্য। `AUTHORIZED_...` মানগুলো placeholder, কাজের URL নয়। নিজের বৈধ URL না বসানো পর্যন্ত সার্ভার `inactive` রাখুন; browser-এ স্ট্রিম কাজ করতে URL, codec, HTTPS এবং CORS ঠিক থাকতে হয়।

```json
{
  "example-news": {
    "id": "example-news",
    "name": "Example News",
    "logo": "https://your-domain.example/logos/news.png",
    "category": "news",
    "description": "অনুমোদিত সংবাদ চ্যানেল",
    "featured": true,
    "visible": true,
    "servers": [
      {
        "name": "Main HLS",
        "priority": 1,
        "type": "m3u8",
        "url": "AUTHORIZED_HTTPS_M3U8_URL",
        "status": "active"
      },
      {
        "name": "Backup DASH",
        "priority": 2,
        "type": "dash",
        "url": "AUTHORIZED_HTTPS_MPD_URL",
        "status": "inactive"
      }
    ]
  }
}
```

প্রতিটি চ্যানেলে `id`, `name`, `category` এবং `servers` দিন। key ও `id` একই রাখলে বুঝতে সুবিধা হয়। `visible: false` দিলে চ্যানেলটি তালিকা ও খোঁজায় লুকানো থাকবে। `featured: true` দিলে Home page-এর Featured Channels অংশে দেখানো হয়। `logo`-তে logo URL দিন; ব্যর্থ হলে চ্যানেলের নামের প্রথম দুই অক্ষর দেখাবে।

একটি channel-এ একাধিক server দেওয়া যায়। ছোট `priority` আগে চেষ্টা হয়। শুধু `status: "active"` server-ই ব্যবহার হয়। সাময়িকভাবে বন্ধ করতে `inactive` দিন। ব্যর্থ হলে পরের active server চেষ্টা হয়; সফল server-এর নাম ওই ডিভাইসে মনে রাখা হয়।

সমর্থিত stream `type`:

- `m3u8`: HLS playlist; HLS.js স্থানীয়ভাবে আছে, এবং সমর্থিত browser-এ native HLS-ও চেষ্টা হয়।
- `dash` অথবা `mpd`: MPEG-DASH manifest; Shaka Player স্থানীয়ভাবে আছে।
- `youtube`: YouTube watch, short link, `/live/` অথবা `/embed/` URL। YouTube-এর নিজস্ব IFrame API কেবল YouTube channel চালু করার সময় internet থেকে লোড হয়।

## অনুমোদিত ClearKey এবং Widevine কনফিগারেশন

ClearKey key সরাসরি JSON-এ দেওয়া হলে সেটি **গোপন নয়**। public app-এ কেবল provider লিখিতভাবে browser-side key ব্যবহারের অনুমতি দিলে এবং ঝুঁকি বুঝে এই পদ্ধতি ব্যবহার করুন। `kid` এবং `key` ১৬ byte / ৩২ hexadecimal character-এর মান হওয়া উচিত।

```json
{
  "authorized-clearkey-demo": {
    "id": "authorized-clearkey-demo",
    "name": "Authorized ClearKey Channel",
    "logo": "",
    "category": "movies",
    "description": "শুধু অনুমোদিত পরীক্ষা",
    "featured": false,
    "visible": true,
    "servers": [
      {
        "name": "DASH ClearKey",
        "priority": 1,
        "type": "dash",
        "url": "AUTHORIZED_HTTPS_MPD_URL",
        "drm": {
          "type": "clearkey",
          "kid": "0123456789abcdef0123456789abcdef",
          "key": "abcdef0123456789abcdef0123456789"
        },
        "status": "active"
      }
    ]
  }
}
```

Widevine-এর জন্য provider-এর অনুমোদিত HTTPS license URL এবং license service-এর প্রয়োজনীয় configuration লাগবে। License URL-ও JSON-এ দেখা যায়। provider যদি token বা custom header চায়, বাস্তব production ব্যবস্থায় শুধু frontend দিয়ে গোপন credential নিরাপদ রাখা সম্ভব নয়; এই প্রকল্পে backend নেই, তাই কোনো secret header যোগ করার সুবিধা বানানো হয়নি।

```json
{
  "authorized-widevine-demo": {
    "id": "authorized-widevine-demo",
    "name": "Authorized Widevine Channel",
    "logo": "",
    "category": "movies",
    "description": "অনুমোদিত Widevine DASH stream",
    "featured": false,
    "visible": true,
    "servers": [
      {
        "name": "Widevine Main",
        "priority": 1,
        "type": "dash",
        "url": "AUTHORIZED_HTTPS_MPD_URL",
        "drm": {
          "type": "widevine",
          "authorized": true,
          "licenseUrl": "https://authorized-provider.example/license"
        },
        "status": "active"
      }
    ]
  }
}
```

`authorized: true` সেটি কেবল provider সত্যিই browser-side Widevine license request অনুমোদন করলে দিন। এটি কোনো নিরাপত্তা ব্যবস্থা নয়, কেবল কনফিগারেশন সতর্কতা। DRM playback-এর জন্য HTTPS বা localhost দরকার, browser-এ উপযুক্ত DRM/CDM থাকতে হবে, এবং manifest/segment/license server-এ সঠিক CORS থাকতে হবে।

## পরীক্ষা করা

1. JSON validator দিয়ে তিনটি data ফাইল পরীক্ষা করুন, তারপর localhost/static host-এ অ্যাপ খুলুন।
2. Developer Tools-এর Console ও Network tab-এ JSON, logo, manifest এবং stream request দেখুন।
3. প্রথমে provider-এর অনুমোদিত, browser-এ কাজ করে এমন test stream ব্যবহার করুন। HLS/DASH-এ manifest-এর পাশাপাশি segment URL-ও সঠিক হতে হবে।
4. Player-এ server selector দিয়ে server বদলান। ইচ্ছাকৃতভাবে ভুল Main server দিয়ে backup পরীক্ষা করতে পারেন, তবে live service-এ ভুল URL রেখে দেবেন না। Retry বোতাম দিয়ে পুনরায় চেষ্টা করুন।
5. PWA/offline পরীক্ষা HTTPS বা localhost-এ করুন। পেজ একবার অনলাইনে লোড হওয়ার পর offline অবস্থায় refresh করে app shell ও cached config দেখুন। Live stream offline চলবে না।

## সাধারণ সমস্যা ও সমাধান

### JSON লেখার নিয়মে ভুল

প্রতিটি property name এবং text value-তে double quote (`"`) ব্যবহার করুন। শেষ property-র পরে comma দেবেন না। JSON-এ comment (`//`) লেখা যায় না। উদাহরণস্বরূপ `"visible": true` বৈধ, কিন্তু `visible: True` বৈধ নয়। Browser Console-এ parse error-এর line number দেখুন।

### চ্যানেল দেখা যাচ্ছে না

`channels.json`-এ top-level key ও channel object ঠিক আছে কি না দেখুন। `id` বৈধ রাখুন, `visible` `false` নয় নিশ্চিত করুন, এবং `servers` array-তে সঠিক `status`, `type` ও URL দিন। Channel data পুরো খালি হলে app একটি ব্যাখ্যামূলক empty state দেখায়।

### বিভাগ বা ছাঁকনি দেখা যাচ্ছে না

`categories.json`-এ `id` ও `name` দিন এবং `visible` `false` করবেন না। Channel-এর `category` value-কে category ID-এর সঙ্গে অক্ষরে অক্ষরে মেলান। category-র নাম নয়, ID-টাই channel-এ বসবে।

### স্ট্রিম চালু হয় না

URL সঠিক ও HTTPS কি না দেখুন। HLS-এর জন্য `.m3u8` manifest এবং তার segment URL server-এ আছে কি না পরীক্ষা করুন। DASH-এর জন্য `.mpd` এবং media segment পরীক্ষা করুন। Server `active` কি না দেখুন। Codec/DRM browser বা device সমর্থন নাও করতে পারে। Network error ও manifest error দেখা গেলে URL, internet, CORS এবং provider-এর server status পরীক্ষা করুন। কোনো server না চললে Player-এর Retry ব্যবহার করুন।

### CORS সমস্যা

Static app-এ যে origin থেকে চলে, stream manifest, segment এবং license server-কে সেই origin থেকে প্রয়োজনীয় cross-origin request অনুমতি দিতে হয়। Stream provider-এর server-side CORS header ঠিক না থাকলে JavaScript দিয়ে browser-এর সীমা পাশ কাটানো যায় না। Provider-কে manifest ও media request-এর জন্য উপযুক্ত `Access-Control-Allow-Origin` সেট করতে বলুন।

### ব্রাউজার বা যন্ত্রের সামঞ্জস্য সমস্যা

HLS, DASH, codec, MSE এবং DRM support browser ও TV device অনুযায়ী বদলায়। iPhone/iPad-এ native HLS বেশি উপযোগী; সব Android TV-তে সব codec বা DRM নেই। সমর্থিত browser/device-এ পরীক্ষা করুন এবং প্রয়োজন হলে provider-এর compatible alternate stream দিন। অ্যাপটি `file://` দিয়ে চালাবেন না; localhost অথবা HTTPS সার্ভার ব্যবহার করুন।

### DRM কনফিগারেশনের সমস্যা

ClearKey-এর `kid` ও `key`-এ ৩২টি hex character আছে কি না দেখুন। Widevine-এ `type` হবে `widevine`, `authorized` হবে `true`, এবং `licenseUrl` HTTPS হবে। `authorized: true` কেবল অনুমতি থাকলেই ব্যবহার করুন। License server-এর CORS, certificate, browser DRM support এবং stream-এ সঠিক key ID আছে কি না provider-এর সঙ্গে যাচাই করুন। কোনো invalid DRM credential-কে অন্য server চেষ্টা করিয়ে সমাধান করা যায় না।

### Service Worker বা হালনাগাদের সমস্যা

Service Worker `file://`-এ কাজ করে না; localhost বা HTTPS লাগে। প্রথম install-এর পর পেজ আবার খুলুন। Settings-এর update button নতুন Service Worker খুঁজে; নতুন version তৈরি হলে **Activate update** দেখায়। সক্রিয় করার সময় app reload হবে। Static host-এ `sw.js`, HTML এবং config-এর cache header যুক্তিসংগত রাখুন। নতুন deploy হওয়ার পরও পুরোনো app থাকলে browser-এর Site settings থেকে ওই origin-এর site data/cache পরিষ্কার করে আবার খুলুন। আগের cache নতুন cache সফলভাবে populate হওয়ার আগে মুছে ফেলা হয় না।

### পুরোনো কনফিগারেশন দেখা যাচ্ছে

`data/settings.json`, `data/channels.json`, `data/categories.json` একই origin-এ আছে কি না Network tab-এ দেখুন। Service Worker config-এ network-first এবং offline-এ cached fallback ব্যবহার করে। Online অবস্থায় hard refresh করুন; JSON response `200` হচ্ছে কি না যাচাই করুন। Static host-এ JSON-এর সঠিক `Content-Type` থাকলে ভালো।

## ব্যক্তিগত তথ্য ও সীমাবদ্ধতা

Favorites, theme, volume, search history, channel watch history এবং শেষ server name browser-এর LocalStorage-এ থাকে। History-তে stream URL বা DRM key রাখা হয় না। Browser storage মুছে ফেললে এই তথ্যও মুছে যাবে। এই প্রকল্পে account sync বা cloud backup নেই। Live media cache করা হয় না। Publicly hosted frontend JSON-এ থাকা সব URL এবং browser-এ পাঠানো DRM তথ্য public ধরে নিন।

## প্লেয়ার লাইব্রেরির সংস্করণ

Core player library-গুলো project root-এ local bundle হিসেবে vendored: HLS.js `1.7.4` এবং Shaka Player `5.3.4`। এগুলো runtime-এ CDN থেকে নামানো হয় না। YouTube API কেবল YouTube stream চালানোর সময় load হয় এবং সে কারণে YouTube playback-এ internet প্রয়োজন।
