const fs = require("fs");
const { createCanvas } = require("canvas");
const path = require("path");

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

// Generate icons of different sizes
const sizes = [16, 48, 128];

sizes.forEach((size) => {
  // Create canvas
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Draw background
  ctx.fillStyle = "#4285F4"; // Google Blue
  ctx.fillRect(0, 0, size, size);

  // Draw text
  ctx.fillStyle = "white";
  ctx.font = `bold ${size * 0.5}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("T", size / 2, size / 2);

  // Save to file
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buffer);

  console.log(`Generated icon${size}.png`);
});

console.log("All icons generated successfully!");
