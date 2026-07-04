# picgo-plugin-allinone

[![Node.js](https://img.shields.io/badge/node-v24.11.0-339933?logo=node.js&logoColor=white)](#requirements)
[![PicGo](https://img.shields.io/badge/PicGo-1.8.0-blue)](https://picgo.github.io/PicGo-Core-Doc/)
[![Markdown](https://img.shields.io/badge/Markdown-local%20images-000000?logo=markdown&logoColor=white)](#usage)
[![License](https://img.shields.io/badge/license-not%20specified-lightgrey)](#license)

## English

`picgo-plugin-allinone` is a small Node.js CLI tool that uploads every local image referenced in a Markdown file through PicGo, then replaces those local paths with the uploaded image URLs.

It is useful when you finish writing an article locally and want to publish it to platforms that require public image URLs.

### Features

- Finds Markdown image links such as `![](./assets/demo.png)`.
- Skips image URLs that already start with `http`.
- Supports relative and absolute local image paths.
- Decodes URL-encoded paths, including paths with spaces or Chinese characters.
- Copies each image to a temporary sanitized filename before upload, reducing filename issues with object storage providers.
- Uploads images through PicGo Core, so it works with uploaders supported by PicGo.
- Retries failed uploads up to 3 times with a 2-second interval.
- Rewrites only successfully uploaded image links in the Markdown file.

### Requirements

- Node.js 16 or later. This repository currently includes `.node-version` with `v24.11.0`.
- A configured PicGo uploader.
- One image hosting provider supported by PicGo, such as:
  - SM.MS
  - Qiniu Cloud
  - Tencent Cloud COS
  - Upyun
  - GitHub
  - Imgur
  - Alibaba Cloud OSS

### Installation

```bash
pnpm install
```

If you do not use pnpm, npm also works:

```bash
npm install
```

### Configure PicGo

Create or update the PicGo uploader configuration:

```bash
npx picgo set uploader
```

PicGo stores its configuration in the normal PicGo Core config location. For provider-specific fields, see the official PicGo Core documentation:

- https://picgo.github.io/PicGo-Core-Doc/
- https://picgo.github.io/PicGo-Doc/zh/guide/config

Before processing a Markdown file, verify that your uploader works:

```bash
npx picgo upload ./example.jpg
```

### Usage

Run the script with a Markdown file path:

```bash
node index.js ./README.md
```

Use it with `fzf` to choose a file interactively:

```bash
node index.js "$(find . -type f -name '*.md' | fzf)"
```

The script edits the Markdown file in place. Commit your file or keep a backup before running it if you want an easy rollback.

### Example

Before:

```markdown
![screenshot](./images/screenshot.png)
```

After a successful upload:

```markdown
![](https://your-image-host.example/screenshot.png)
```

### How It Works

1. Reads the target Markdown file.
2. Extracts all Markdown image links whose URL does not start with `http`.
3. Resolves each image path relative to the Markdown file.
4. Uploads images one by one through PicGo.
5. Records successful URL replacements.
6. Applies replacements from the end of the file to the beginning to avoid offset issues.
7. Writes the updated Markdown back to disk.

### Notes

- Non-HTTP image references are treated as local file paths.
- Missing local image files are reported and skipped.
- If no image uploads succeed, the Markdown file is not modified.
- Uploaded images use the PicGo uploader configured on your machine.

### Roadmap

- Package the script as a globally installable npm CLI.
- Build a VS Code extension workflow on top of this tool.

### License

No license has been specified yet.

---

## 中文

`picgo-plugin-allinone` 是一个轻量级 Node.js 命令行工具。它会扫描 Markdown 文件中的本地图片链接，通过 PicGo 上传到图床，然后把原来的本地路径替换成上传后的图片 URL。

当你在本地写完文章，需要发布到微信公众号、博客、知识库等要求公网图片地址的平台时，这个工具可以一次性处理文中的所有本地图片。

### 功能特性

- 识别 `![](./assets/demo.png)` 这类 Markdown 图片链接。
- 跳过已经以 `http` 开头的图片 URL。
- 支持相对路径和绝对路径的本地图片。
- 支持 URL 编码路径解码，可以处理包含空格或中文字符的路径。
- 上传前会复制一份经过清理的临时文件名，减少图床或对象存储对特殊文件名不兼容的问题。
- 基于 PicGo Core 上传，因此支持 PicGo 已支持的图床。
- 上传失败时最多重试 3 次，每次间隔 2 秒。
- 只替换上传成功的图片链接。

### 环境要求

- Node.js 16 或更高版本。本仓库当前的 `.node-version` 为 `v24.11.0`。
- 已配置可用的 PicGo 上传器。
- 任意一种 PicGo 支持的图床，例如：
  - SM.MS
  - 七牛云
  - 腾讯云 COS
  - 又拍云
  - GitHub
  - Imgur
  - 阿里云 OSS

### 安装

```bash
pnpm install
```

如果不使用 pnpm，也可以使用 npm：

```bash
npm install
```

### 配置 PicGo

创建或更新 PicGo 上传器配置：

```bash
npx picgo set uploader
```

PicGo 会把配置写入 PicGo Core 默认配置位置。不同图床的具体配置项可以参考官方文档：

- https://picgo.github.io/PicGo-Core-Doc/zh/
- https://picgo.github.io/PicGo-Doc/zh/guide/config

处理 Markdown 文件前，建议先上传一张图片验证配置是否生效：

```bash
npx picgo upload ./example.jpg
```

### 使用方法

传入需要处理的 Markdown 文件路径：

```bash
node index.js ./README.md
```

也可以配合 `fzf` 交互式选择文件：

```bash
node index.js "$(find . -type f -name '*.md' | fzf)"
```

脚本会直接修改传入的 Markdown 文件。如果需要方便回滚，请在运行前提交文件或保留备份。

### 示例

处理前：

```markdown
![screenshot](./images/screenshot.png)
```

上传成功后：

```markdown
![](https://your-image-host.example/screenshot.png)
```

### 工作流程

1. 读取目标 Markdown 文件。
2. 提取所有 URL 不以 `http` 开头的 Markdown 图片链接。
3. 根据 Markdown 文件所在目录解析每张图片的真实路径。
4. 通过 PicGo 按顺序上传图片。
5. 记录上传成功后的 URL 替换信息。
6. 从文件末尾向前应用替换，避免文本位置偏移。
7. 将更新后的 Markdown 写回磁盘。

### 注意事项

- 所有非 HTTP 图片引用都会被当成本地文件路径处理。
- 找不到的本地图片会被报告并跳过。
- 如果没有任何图片上传成功，Markdown 文件不会被修改。
- 实际上传到哪个图床，取决于本机 PicGo 的当前配置。

### 后续计划

- 封装成可以全局安装的 npm CLI 工具。
- 在这个工具基础上继续封装 VS Code 插件工作流。

### 许可证

当前尚未指定 License。
