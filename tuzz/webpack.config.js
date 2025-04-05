const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    mode: "development",
    devtool: "inline-source-map",
    // 1) Multiple entry points
    entry: {
        background: path.resolve(__dirname, "src/background/index.ts"),
        contentScript: path.resolve(__dirname, "src/content/contentScript.ts"),
        popup: path.resolve(__dirname, "src/popup/index.tsx"),
    },
    // 2) Output everything into dist/,
    //    placing each script in a subfolder
    //    that matches the manifest references.
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: (pathData) => {
            if (pathData.chunk.name === "background") {
                return "background/index.js";
            } else if (pathData.chunk.name === "contentScript") {
                return "content/contentScript.js";
            } else if (pathData.chunk.name === "popup") {
                return "popup/popup.js";
            }
            return "[name].js"; // fallback
        },
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
    module: {
        rules: [
            {
                test: /\.[tj]sx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    // 3) Copy all files/folders from public/ into dist/
    //    so manifest.json, icons, and popup/index.html appear in dist as well.
    plugins: [
        new CopyPlugin({
            patterns: [{ from: "public", to: "." }],
        }),
    ],
};
