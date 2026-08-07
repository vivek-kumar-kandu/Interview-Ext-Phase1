import fs from 'fs';
import path from 'path';

const iconDir = path.resolve('public/icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// 1x1 PNG base64 string
const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const buffer = Buffer.from(base64Png, 'base64');

['icon-16.png', 'icon-48.png', 'icon-128.png'].forEach((filename) => {
  const filePath = path.join(iconDir, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`Created placeholder icon: ${filePath}`);
});
