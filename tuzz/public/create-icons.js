const fs = require("fs");
const path = require("path");

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

// Simple blue square with 'T' as a placeholder icon
// This is a minimal 1x1 pixel blue PNG encoded as base64
const bluePixelPNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// Generate icons of different sizes
const sizes = [16, 48, 128];

sizes.forEach((size) => {
  // For simplicity, we'll just copy the same 1x1 pixel for all sizes
  // In a real extension, you'd want proper sized icons
  const iconPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(iconPath, Buffer.from(bluePixelPNG, "base64"));
  console.log(`Created ${iconPath}`);
});

console.log("All icons created successfully!");
