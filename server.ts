#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from 'fs-extra';
import * as path from 'node:path';
import * as os from 'node:os';
import sharp from 'sharp';


// 获取桌面路径
const getDesktopPath = () => {
  const { homedir } = os.userInfo();
  return path.join(homedir, 'Desktop');
};

// 检查文件是否为图片
const isImageFile = (filePath: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'];
  const ext = path.extname(filePath).toLowerCase();
  return imageExtensions.includes(ext);
};


// 获取桌面上的所有图片文件
const getDesktopImageFiles = async (): Promise<string[]> => {
  const desktopPath = getDesktopPath();
  try {
    const files = await fs.readdir(desktopPath);
    const imagePaths = files.filter(file => {
      const filePath = path.join(desktopPath, file);
      return fs.statSync(filePath).isFile() && isImageFile(filePath);
    });
    return imagePaths;
  } catch (error) {
    console.error(`Error reading desktop directory: ${error}`, );
    return [];
  }
};

// 创建 MCP 服务器
const server = new McpServer({
  name: "desktop-image-manager",
  version: process.env.VERSION || '1.0.0'
});

// 工具1: 统计桌面上的图片文件数量
server.tool(
  "count-desktop-images",
  "统计桌面上的图片文件数量",
  {},
  async () => {
    try {
      const imageFiles = await getDesktopImageFiles();
      return {
        content: [{ 
          type: "text", 
          text: `桌面上共有 ${imageFiles.length} 个图片文件。` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `获取图片数量时出错: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具2: 获取桌面上的图片文件名称列表
server.tool(
  "list-desktop-images",
  "获取桌面上的图片文件名称列表",
  {},
  async () => {
    try {
      const imageFiles = await getDesktopImageFiles();
      if (imageFiles.length === 0) {
        return {
          content: [{ type: "text", text: "桌面上没有找到图片文件。" }]
        };
      }
      
      const fileList = imageFiles.map((file, index) => `${index + 1}. ${file}`).join('\n');
      return {
        content: [{ 
          type: "text", 
          text: `桌面上的图片文件列表:\n${fileList}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `获取图片列表时出错: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// 工具3: 压缩图片
server.tool(
  "compress-image",
  '压缩图片',
  {
    fileName: z.string().describe("要压缩的图片文件名"),
    quality: z.number().min(1).max(100).default(80).describe("压缩质量 (1-100)"),
    outputName: z.string().optional().describe("输出文件名 (可选)")
  },
  async ({ fileName, quality, outputName }) => {
    try {
      const desktopPath = getDesktopPath();
      const inputPath = path.join(desktopPath, fileName);
      
      // 检查文件是否存在
      if (!await fs.pathExists(inputPath)) {
        return {
          content: [{ type: "text", text: `文件 "${fileName}" 不存在。` }],
          isError: true
        };
      }
      
      // 检查是否为图片文件
      if (!isImageFile(inputPath)) {
        return {
          content: [{ type: "text", text: `文件 "${fileName}" 不是支持的图片格式。` }],
          isError: true
        };
      }
      
      // 确定输出文件名
      const ext = path.extname(fileName);
      const baseName = path.basename(fileName, ext);
      const finalOutputName = outputName || `${baseName}-compressed${ext}`;
      const outputNameFilled = isImageFile(finalOutputName) ? finalOutputName : `${finalOutputName}${ext}`;
      const outputPath = path.join(desktopPath, outputNameFilled);
      
      // 根据文件扩展名确定压缩方法
      const lowerExt = ext.toLowerCase();
      
      if (['.jpg', '.jpeg'].includes(lowerExt)) {
        await sharp(inputPath)
          .jpeg({ quality })
          .toFile(outputPath);
      } else if (lowerExt === '.png') {
        await sharp(inputPath)
          .png({ quality })
          .toFile(outputPath);
      } else if (lowerExt === '.webp') {
        await sharp(inputPath)
          .webp({ quality })
          .toFile(outputPath);
      } else {
        // 对于其他格式，先转换为 JPEG 再压缩
        await sharp(inputPath)
          .jpeg({ quality })
          .toFile(outputPath);
      }
      
      // 获取原始文件和压缩后文件的大小
      const originalSize = (await fs.stat(inputPath)).size;
      const compressedSize = (await fs.stat(outputPath)).size;
      const savingsPercent = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
      
      return {
        content: [{ 
          type: "text", 
          text: `图片压缩成功！\n原始文件: ${fileName} (${originalSize} 字节)\n压缩后文件: ${outputNameFilled} (${compressedSize} 字节)\n节省空间: ${savingsPercent}%` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `压缩图片时出错: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

server.prompt(
  'compress-image',
  '压缩图片',
  {
    fileName: z.string().describe("要压缩的图片文件名"),
    quality: z.string().describe("压缩质量 (1-100)").optional(),
    outputName: z.string().optional().describe("输出文件名 (可选)")
  },
  async ({ fileName, quality, outputName }) => {
    const convertQuality = Math.max(Math.min(100, parseInt(quality|| '0', 10) || 85), 1);

    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const finalOutputName = outputName || `${baseName}-compressed${ext}`;
    const outputNameFilled = isImageFile(finalOutputName) ? finalOutputName : `${finalOutputName}${ext}`;
    
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `请压缩图片 "${fileName}"，压缩质量为 ${convertQuality}%，输出文件名为 "${outputNameFilled}"。`
          }
        }
      ]
    }
  })

// 启动服务器
const transport = new StdioServerTransport();
server.connect(transport)