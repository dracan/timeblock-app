const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgContent = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="#1f2145"/>
      <stop offset="100%" stop-color="#131525"/>
    </linearGradient>
    <filter id="shadow" x="-4%" y="-4%" width="108%" height="116%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Background rounded square -->
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>

  <!-- Subtle inner edge highlight -->
  <rect x="1" y="1" width="510" height="510" rx="107" fill="none" stroke="#ffffff" stroke-opacity="0.04"/>

  <!-- Timeline vertical line -->
  <rect x="106" y="75" width="3" height="362" rx="1.5" fill="#2a2a4a"/>

  <!-- Hour tick marks -->
  <rect x="96" y="88"  width="16" height="2" rx="1" fill="#2a2a4a"/>
  <rect x="96" y="168" width="16" height="2" rx="1" fill="#2a2a4a"/>
  <rect x="96" y="248" width="16" height="2" rx="1" fill="#2a2a4a"/>
  <rect x="96" y="328" width="16" height="2" rx="1" fill="#2a2a4a"/>
  <rect x="96" y="408" width="16" height="2" rx="1" fill="#2a2a4a"/>

  <!-- Time blocks with subtle shadow -->
  <g filter="url(#shadow)">
    <!-- Blue block - morning focus -->
    <rect x="126" y="80" width="290" height="68" rx="14" fill="#4a9eff"/>

    <!-- Green block - short break -->
    <rect x="126" y="168" width="200" height="52" rx="14" fill="#22c55e"/>

    <!-- Amber block - long meeting -->
    <rect x="126" y="240" width="330" height="76" rx="14" fill="#f59e0b"/>

    <!-- Purple block - afternoon work -->
    <rect x="126" y="336" width="250" height="62" rx="14" fill="#a855f7"/>
  </g>

  <!-- Timeline dot indicators -->
  <circle cx="107" cy="114" r="6" fill="#4a9eff"/>
  <circle cx="107" cy="194" r="6" fill="#22c55e"/>
  <circle cx="107" cy="278" r="6" fill="#f59e0b"/>
  <circle cx="107" cy="367" r="6" fill="#a855f7"/>
</svg>`;

const SIZES = [16, 24, 32, 48, 64, 128, 256];

function buildIco(pngBuffers, sizes) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = sizes.length;

  let dataOffset = headerSize + dirEntrySize * numImages;
  const entries = [];

  for (const size of sizes) {
    const png = pngBuffers[size];
    entries.push({
      width: size >= 256 ? 0 : size,  // 0 means 256 in ICO format
      height: size >= 256 ? 0 : size,
      size: png.length,
      offset: dataOffset,
      png
    });
    dataOffset += png.length;
  }

  const buffer = Buffer.alloc(dataOffset);

  // ICONDIR header
  buffer.writeUInt16LE(0, 0);          // reserved
  buffer.writeUInt16LE(1, 2);          // type: 1 = icon
  buffer.writeUInt16LE(numImages, 4);  // image count

  // ICONDIRENTRY array
  let pos = 6;
  for (const entry of entries) {
    buffer.writeUInt8(entry.width, pos);       // width
    buffer.writeUInt8(entry.height, pos + 1);  // height
    buffer.writeUInt8(0, pos + 2);             // color count (0 = no palette)
    buffer.writeUInt8(0, pos + 3);             // reserved
    buffer.writeUInt16LE(1, pos + 4);          // color planes
    buffer.writeUInt16LE(32, pos + 6);         // bits per pixel
    buffer.writeUInt32LE(entry.size, pos + 8); // image data size
    buffer.writeUInt32LE(entry.offset, pos + 12); // image data offset
    pos += 16;
  }

  // Image data (PNG format)
  for (const entry of entries) {
    entry.png.copy(buffer, entry.offset);
  }

  return buffer;
}

async function main() {
  const buildDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(buildDir, { recursive: true });

  const svgBuffer = Buffer.from(svgContent);
  const pngBuffers = {};

  // Generate PNGs at each size
  for (const size of SIZES) {
    pngBuffers[size] = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
  }

  // Save 256x256 as build/icon.png (for electron-builder fallback / Linux)
  fs.writeFileSync(path.join(buildDir, 'icon.png'), pngBuffers[256]);

  // Build and save ICO (for Windows)
  const icoBuffer = buildIco(pngBuffers, SIZES);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);

  // Also save a 512x512 version for high-DPI / marketing
  const png512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(buildDir, 'icon-512.png'), png512);

  console.log('Generated:');
  console.log('  build/icon.ico  (sizes: ' + SIZES.join(', ') + ')');
  console.log('  build/icon.png  (256x256)');
  console.log('  build/icon-512.png (512x512)');
}

main().catch(err => { console.error(err); process.exit(1); });
