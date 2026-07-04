const fs = require('fs');
const path = require('path');
const { PicGo } = require('picgo');
const crypto = require('crypto');

// 配置参数
const config = {
  uploadInterval: 2000, // 上传间隔(ms)
  maxRetries: 3         // 最大重试次数
};

/**
 * 解码文件路径（处理 URL 编码的路径，如包含空格或中文）
 * @param {string} filePath - 可能编码过的文件路径
 * @returns {string} 解码后的文件路径
 */
function decodeFilePath(filePath) {
  // 先进行 URL 解码，再统一路径分隔符
  return decodeURIComponent(filePath).replace(/\\/g, '/');
}

/**
 * 清理文件名，移除或替换不安全的字符，只保留字母、数字、下划线、连字符和点号
 * @param {string} fileName - 原始文件名
 * @returns {string} 清理后的文件名
 */
function sanitizeFileName(fileName) {
  // 移除路径分隔符、控制字符等，只保留字母、数字、下划线、连字符和点号
  // 同时限制长度以防过长
  const cleanName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 100);
  // 确保扩展名在末尾
  const ext = path.extname(cleanName);
  const nameWithoutExt = path.basename(cleanName, ext);
  // 如果文件名为空或只有扩展名，则生成一个随机名
  if (!nameWithoutExt) {
     const randomString = crypto.randomBytes(4).toString('hex');
     return `picgo_upload_${randomString}${ext}`;
  }
  return cleanName;
}

/**
 * 生成唯一的临时文件名
 * @param {string} originalPath - 原始文件路径
 * @param {string} mdFilePath - 当前 Markdown 文件的路径
 * @returns {string} 新的临时文件名
 */
function generateUniqueFileName(originalPath, mdFilePath) {
  const ext = path.extname(originalPath);
  const baseName = path.basename(originalPath, ext);
  const mdFileName = path.basename(mdFilePath, path.extname(mdFilePath));
  // 创建一个描述性的基础名，然后清理它
  const descriptiveBase = `${sanitizeFileName(mdFileName)}_${sanitizeFileName(baseName)}`;
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(4).toString('hex');
  return `${descriptiveBase}_${timestamp}_${randomString}${ext}`;
}


/**
 * 上传并替换 Markdown 文件中的本地图片
 * @param {string} markdownPath - Markdown 文件路径
 */
async function uploadAndReplaceImages(markdownPath) {
  let text;
  try {
    text = fs.readFileSync(markdownPath, 'utf8');
  } catch (error) {
    console.error(`❌ Error reading file: ${error.message}`);
    process.exit(1);
  }

  // 匹配所有本地图片路径
  const imageRegex = /!\[.*?\]\((.*?)\)/g;
  let rawMatches = [];
  let match;
  while ((match = imageRegex.exec(text)) !== null) {
    if (!match[1].startsWith('http')) {
      rawMatches.push(match);
    }
  }

  if (rawMatches.length === 0) {
    console.log('✅ No local images found to upload.');
    return;
  }

  // 解码匹配到的路径
  const matches = rawMatches.map(m => ({
    originalMatch: m[0], // 完整的 Markdown 图片语法，如 ![alt](path/to/image.png)
    originalPath: m[1],  // 括号内的路径部分
    decodedPath: decodeFilePath(m[1]), // 解码后的路径
    index: m.index       // 在文本中的起始位置
  }));

  console.log(`🔍 Found ${matches.length} local image(s) to upload.`);

  // 创建 PicGo 实例
  const picgo = new PicGo();

  let replacements = [];
  let uploadedCount = 0;
  let failedCount = 0;

  // 处理每张图片
  for (const matchInfo of matches) {
    const { decodedPath, originalMatch, index } = matchInfo;
    const absoluteImagePath = path.isAbsolute(decodedPath)
      ? decodedPath
      : path.resolve(path.dirname(markdownPath), decodedPath);

    // 检查文件是否存在
    if (!fs.existsSync(absoluteImagePath)) {
      console.error(`❌ Image file not found: ${absoluteImagePath} (originally: ${matchInfo.originalPath})`);
      failedCount++;
      continue; // 跳过这个文件，继续处理下一个
    }

    let retries = 0;
    let success = false;

    while (retries < config.maxRetries && !success) {
      try {
        // 生成临时文件名（清理过的，不含特殊字符）
        const newFileName = generateUniqueFileName(absoluteImagePath, markdownPath);
        const newFilePath = path.join(path.dirname(absoluteImagePath), newFileName);

        // 复制文件到临时路径（使用清理后的文件名）
        fs.copyFileSync(absoluteImagePath, newFilePath);

        // 上传图片（PicGo 会处理这个“干净”的文件名，通常不会再次编码）
        const result = await picgo.upload([newFilePath]);

        // 删除临时文件
        fs.unlinkSync(newFilePath);

        // 处理上传结果
        if (Array.isArray(result) && result.length > 0 && result[0].imgUrl) {
          uploadedCount++;
          console.log(`✅ Uploaded: ${path.basename(absoluteImagePath)} -> ${result[0].imgUrl}`); // 显示原始文件名和新链接

          // 记录替换信息
          // 注意：这里替换的是原始匹配的文本，而不是解码后的路径
          replacements.push({
            range: [index, index + originalMatch.length], // 替换的范围是原始匹配的索引和长度
            newText: `![](${result[0].imgUrl})`
          });
          success = true;
        } else {
          throw new Error("Invalid upload result or no URL returned");
        }
      } catch (error) {
        retries++;
        if (retries >= config.maxRetries) {
          failedCount++;
          console.error(`❌ Failed after ${config.maxRetries} retries: ${path.basename(absoluteImagePath)}`);
          console.error(`   Error details: ${error.message}`);
        } else {
          console.log(`🔄 Retrying ${retries}/${config.maxRetries} for ${path.basename(absoluteImagePath)}`);
          await new Promise(resolve => setTimeout(resolve, config.uploadInterval));
        }
      }
    }

    // 每次上传后等待间隔
    await new Promise(resolve => setTimeout(resolve, config.uploadInterval));
  }

  // 应用所有替换
  if (replacements.length > 0) {
    // 按顺序从后往前替换（避免位置偏移）
    replacements.sort((a, b) => b.range[0] - a.range[0]);

    for (const { range, newText } of replacements) {
      const [start, end] = range;
      text = text.substring(0, start) + newText + text.substring(end);
    }

    // 保存修改后的文件
    try {
      fs.writeFileSync(markdownPath, text);
      console.log(`\n🎉 Process completed! ${uploadedCount} image(s) uploaded and replaced in the file.`);
      if (failedCount > 0) {
        console.log(`⚠️  ${failedCount} image(s) failed to upload.`);
      }
    } catch (error) {
      console.error(`❌ Error writing file back: ${error.message}`);
      process.exit(1);
    }
  } else {
     console.log(`\n⚠️  No images were successfully uploaded. The file was not modified.`);
     if (failedCount > 0) {
        console.log(`   ${failedCount} image(s) failed to upload.`);
     }
  }
}

// 主程序
async function main() {
  if (process.argv.length < 3) {
    console.error('Usage: node index.js <markdown-file-path>');
    console.error('Example: node index.js "./README.md"');
    process.exit(1);
  }

  const markdownPath = process.argv[2];

  if (!fs.existsSync(markdownPath)) {
    console.error(`❌ Error: File not found at "${markdownPath}"`);
    process.exit(1);
  }

  console.log(`🔍 Processing file: ${markdownPath}`);

  console.log(`⏳ Uploading images (max retries: ${config.maxRetries}, interval: ${config.uploadInterval}ms)`);

  try {
    await uploadAndReplaceImages(markdownPath);
  } catch (error) {
    console.error('❌ Critical error during processing:', error.message);
    process.exit(1);
  }
}

// 执行主程序
main();