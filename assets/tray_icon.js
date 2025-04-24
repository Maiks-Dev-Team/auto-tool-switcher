// Placeholder icon generator for development (creates a basic PNG if not present)
const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;

const iconPath = path.join(__dirname, 'tray_icon.png');
if (!fs.existsSync(iconPath)) {
  const png = new PNG({ width: 32, height: 32 });
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const idx = (32 * y + x) << 2;
      png.data[idx] = 0x22;      // R
      png.data[idx + 1] = 0x88;  // G
      png.data[idx + 2] = 0xcc;  // B
      png.data[idx + 3] = 0xff;  // A
    }
  }
  png.pack().pipe(fs.createWriteStream(iconPath));
}
