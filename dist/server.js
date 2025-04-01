#!/usr/bin/env node

// server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs-extra";
import * as path from "node:path";
import * as os from "node:os";
import sharp from "sharp";
var getDesktopPath = () => {
  const { homedir } = os.userInfo();
  return path.join(homedir, "Desktop");
};
var isImageFile = (filePath) => {
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".svg"];
  const ext = path.extname(filePath).toLowerCase();
  return imageExtensions.includes(ext);
};
var getDesktopImageFiles = async () => {
  const desktopPath = getDesktopPath();
  try {
    const files = await fs.readdir(desktopPath);
    const imagePaths = files.filter((file) => {
      const filePath = path.join(desktopPath, file);
      return fs.statSync(filePath).isFile() && isImageFile(filePath);
    });
    return imagePaths;
  } catch (error) {
    console.error(`Error reading desktop directory: ${error}`);
    return [];
  }
};
var server = new McpServer({
  name: "desktop-image-manager",
  version: "1.0.4"
});
server.tool(
  "count-desktop-images",
  "\u7EDF\u8BA1\u684C\u9762\u4E0A\u7684\u56FE\u7247\u6587\u4EF6\u6570\u91CF",
  {},
  async () => {
    try {
      const imageFiles = await getDesktopImageFiles();
      return {
        content: [{
          type: "text",
          text: `\u684C\u9762\u4E0A\u5171\u6709 ${imageFiles.length} \u4E2A\u56FE\u7247\u6587\u4EF6\u3002`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `\u83B7\u53D6\u56FE\u7247\u6570\u91CF\u65F6\u51FA\u9519: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);
server.tool(
  "list-desktop-images",
  "\u83B7\u53D6\u684C\u9762\u4E0A\u7684\u56FE\u7247\u6587\u4EF6\u540D\u79F0\u5217\u8868",
  {},
  async () => {
    try {
      const imageFiles = await getDesktopImageFiles();
      if (imageFiles.length === 0) {
        return {
          content: [{ type: "text", text: "\u684C\u9762\u4E0A\u6CA1\u6709\u627E\u5230\u56FE\u7247\u6587\u4EF6\u3002" }]
        };
      }
      const fileList = imageFiles.map((file, index) => `${index + 1}. ${file}`).join("\n");
      return {
        content: [{
          type: "text",
          text: `\u684C\u9762\u4E0A\u7684\u56FE\u7247\u6587\u4EF6\u5217\u8868:
${fileList}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `\u83B7\u53D6\u56FE\u7247\u5217\u8868\u65F6\u51FA\u9519: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);
server.tool(
  "compress-image",
  "\u538B\u7F29\u56FE\u7247",
  {
    fileName: z.string().describe("\u8981\u538B\u7F29\u7684\u56FE\u7247\u6587\u4EF6\u540D"),
    quality: z.number().min(1).max(100).default(80).describe("\u538B\u7F29\u8D28\u91CF (1-100)"),
    outputName: z.string().optional().describe("\u8F93\u51FA\u6587\u4EF6\u540D (\u53EF\u9009)")
  },
  async ({ fileName, quality, outputName }) => {
    try {
      const desktopPath = getDesktopPath();
      const inputPath = path.join(desktopPath, fileName);
      if (!await fs.pathExists(inputPath)) {
        return {
          content: [{ type: "text", text: `\u6587\u4EF6 "${fileName}" \u4E0D\u5B58\u5728\u3002` }],
          isError: true
        };
      }
      if (!isImageFile(inputPath)) {
        return {
          content: [{ type: "text", text: `\u6587\u4EF6 "${fileName}" \u4E0D\u662F\u652F\u6301\u7684\u56FE\u7247\u683C\u5F0F\u3002` }],
          isError: true
        };
      }
      const ext = path.extname(fileName);
      const baseName = path.basename(fileName, ext);
      const finalOutputName = outputName || `${baseName}-compressed${ext}`;
      const outputNameFilled = isImageFile(finalOutputName) ? finalOutputName : `${finalOutputName}${ext}`;
      const outputPath = path.join(desktopPath, outputNameFilled);
      const lowerExt = ext.toLowerCase();
      if ([".jpg", ".jpeg"].includes(lowerExt)) {
        await sharp(inputPath).jpeg({ quality }).toFile(outputPath);
      } else if (lowerExt === ".png") {
        await sharp(inputPath).png({ quality }).toFile(outputPath);
      } else if (lowerExt === ".webp") {
        await sharp(inputPath).webp({ quality }).toFile(outputPath);
      } else {
        await sharp(inputPath).jpeg({ quality }).toFile(outputPath);
      }
      const originalSize = (await fs.stat(inputPath)).size;
      const compressedSize = (await fs.stat(outputPath)).size;
      const savingsPercent = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
      return {
        content: [{
          type: "text",
          text: `\u56FE\u7247\u538B\u7F29\u6210\u529F\uFF01
\u539F\u59CB\u6587\u4EF6: ${fileName} (${originalSize} \u5B57\u8282)
\u538B\u7F29\u540E\u6587\u4EF6: ${outputNameFilled} (${compressedSize} \u5B57\u8282)
\u8282\u7701\u7A7A\u95F4: ${savingsPercent}%`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `\u538B\u7F29\u56FE\u7247\u65F6\u51FA\u9519: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);
server.prompt(
  "compress-image",
  "\u538B\u7F29\u56FE\u7247",
  {
    fileName: z.string().describe("\u8981\u538B\u7F29\u7684\u56FE\u7247\u6587\u4EF6\u540D"),
    quality: z.string().describe("\u538B\u7F29\u8D28\u91CF (1-100)").optional(),
    outputName: z.string().optional().describe("\u8F93\u51FA\u6587\u4EF6\u540D (\u53EF\u9009)")
  },
  async ({ fileName, quality, outputName }) => {
    const convertQuality = Math.max(Math.min(100, parseInt(quality || "0", 10) || 85), 1);
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const finalOutputName = outputName || `${baseName}-compressed${ext}`;
    const outputNameFilled = isImageFile(finalOutputName) ? finalOutputName : `${finalOutputName}${ext}`;
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `\u8BF7\u538B\u7F29\u56FE\u7247 "${fileName}"\uFF0C\u538B\u7F29\u8D28\u91CF\u4E3A ${convertQuality}%\uFF0C\u8F93\u51FA\u6587\u4EF6\u540D\u4E3A "${outputNameFilled}"\u3002`
          }
        }
      ]
    };
  }
);
var transport = new StdioServerTransport();
server.connect(transport);
