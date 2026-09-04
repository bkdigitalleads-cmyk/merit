const sharp = require('sharp');

// Merit icon: deep evergreen field, a mint award-ribbon badge — circle
// medal with a bold checkmark and two ribbon tails. Reads at 60px.
const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1B2A22"/>
      <stop offset="1" stop-color="#0E1713"/>
    </linearGradient>
    <linearGradient id="medal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5FE6B8"/>
      <stop offset="1" stop-color="#38C595"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.4" r="0.55">
      <stop offset="0" stop-color="#4ED8A9" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#4ED8A9" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="420" r="330" fill="url(#glow)"/>
  <!-- ribbon tails -->
  <path d="M 388 560 L 320 900 L 442 822 L 512 940 L 512 600 Z" fill="#2E9F79"/>
  <path d="M 636 560 L 704 900 L 582 822 L 512 940 L 512 600 Z" fill="#38B98C"/>
  <!-- medal -->
  <circle cx="512" cy="420" r="252" fill="url(#medal)"/>
  <circle cx="512" cy="420" r="252" fill="none" stroke="#0E1713" stroke-opacity="0.18" stroke-width="10"/>
  <circle cx="512" cy="420" r="196" fill="none" stroke="#0E1713" stroke-opacity="0.22" stroke-width="14"/>
  <!-- checkmark -->
  <path d="M 400 428 L 482 512 L 634 340" fill="none" stroke="#101F18" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

(async () => {
  const buf = Buffer.from(svg);
  await sharp(buf).resize(1024, 1024).png().toFile('../assets/icon.png');
  // Android adaptive: foreground = badge art on transparent, background = flat dark
  await sharp(buf).resize(1024, 1024).png().toFile('../assets/android-icon-foreground.png');
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#121815' } })
    .png().toFile('../assets/android-icon-background.png');
  await sharp(buf).resize(1024, 1024).grayscale().png().toFile('../assets/android-icon-monochrome.png');
  await sharp(buf).resize(48, 48).png().toFile('../assets/favicon.png');
  await sharp(buf).resize(512, 512).png().toFile('../assets/splash-icon.png');
  console.log('icons written');
})();
