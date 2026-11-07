# Chấm Phiếu — phone app

Grades THPT 2025 answer sheets live through the phone camera. Everything (answer keys, results, sheet photos) is saved on the phone and works offline.

## 1. Put it online (GitHub Pages, free)

The phone camera only works for apps opened from an `https://` address, so the app needs a home on the web once. After that it runs offline.

1. On github.com, click **New repository**. Name it `cham-phieu`, set it to **Public**, and click **Create repository**.
2. On the new repository page, click **uploading an existing file**. Drag in **everything from this zip** (`index.html`, `sw.js`, `manifest.webmanifest`, the `fonts`, `icons` and `lib` folders, and the rest). Click **Commit changes**.
3. Go to **Settings → Pages**. Under *Branch*, choose `main` and `/ (root)`, then click **Save**.
4. After about a minute the app is live at **https://hax52.github.io/cham-phieu/**

The repository holds only the app. Answer keys and student results never leave the phone.

## 2. Install it on the phone

- **Android (Chrome):** open the address, then tap **Cài ứng dụng / Install app** in the app's top bar (or ⋮ → *Install app*).
- **iPhone (Safari):** open the address, tap **Share → Add to Home Screen**.

Open it from the home-screen icon from then on. On iPhone, the home-screen app and Safari keep separate data, so stick to the icon.

## 3. Scan

1. **Đáp án & thang điểm:** enter answer keys (or import Excel) and set points.
2. **Chấm bài → Quét trực tiếp:** allow the camera the first time.
3. Hold the phone over a sheet so all **4 black corner squares** are in view. The frame turns green, the app beeps and the score appears. No button press needed.
4. Move to the next sheet. When the old sheet leaves the view, the app is ready for the next one.
   - The same candidate number twice → warning, the new scan is not saved unless you tap *Thay bản cũ*.
   - *Quét lại* drops the last result and reads the sheet again.
   - The round shutter button grades immediately if auto-capture is slow.
   - The ⚡ button turns on the flashlight (on phones that support it).
5. **Xong** → results list → **Xuất Excel**.

## Your data

Saved on this phone in the browser's app storage, including after closing the app or restarting the phone. It is deleted if you uninstall the app or clear the browser's site data, so use **Sao lưu ra file** at the bottom of the app now and then; **Khôi phục từ file** brings it back on any device.

## Updating

Upload changed files to the same repository. The app picks up the new version the next time it is opened with an internet connection.
