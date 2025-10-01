# 📁 临时文件共享服务

一个简单、快速、安全的临时文件分享服务，支持文件上传、下载和自动过期删除。

## ✨ 功能特性

- 🚀 **简单易用** - 拖拽或点击上传文件，无需注册
- 📱 **响应式设计** - 完美支持桌面端和移动端
- ⏰ **自动过期** - 文件上传后24小时自动删除
- 🔒 **安全可靠** - 文件存储在本地，支持大文件上传（最大100MB）
- 📊 **实时状态** - 显示文件剩余时间和上传状态
- 🎨 **现代UI** - 美观的界面设计，良好的用户体验

## 🛠️ 技术栈

- **后端**: Node.js + Express
- **文件处理**: Multer
- **前端**: 原生 HTML/CSS/JavaScript
- **样式**: 现代CSS3 + 响应式设计

## 📦 安装和运行

### 环境要求

- Node.js 14.0 或更高版本
- npm 或 yarn

### 快速开始

1. **克隆项目**
```bash
git clone https://github.com/your-username/temp-file-share.git
cd temp-file-share
```

2. **安装依赖**
```bash
npm install
```

3. **启动服务**
```bash
npm start
# 或者
node server.js
```

4. **访问服务**
- 本地访问: http://localhost:8000
- 服务启动后会显示访问地址

## 📖 使用说明

### 上传文件
1. 打开网页界面
2. 拖拽文件到上传区域，或点击选择文件
3. 支持多文件同时上传
4. 上传完成后可以看到文件列表

### 下载文件
1. 在文件列表中找到需要的文件
2. 点击"📥 下载"按钮
3. 文件会直接下载到本地

### 删除文件
1. 在文件列表中找到需要删除的文件
2. 点击"🗑️ 删除"按钮
3. 确认删除操作

## 🔧 配置说明

### 服务器配置
- **端口**: 默认8000，可通过环境变量 `PORT` 修改
- **上传目录**: `./uploads/`
- **文件大小限制**: 100MB
- **文件过期时间**: 24小时

### 自定义配置
可以修改 `server.js` 中的以下配置：

```javascript
// 文件大小限制（字节）
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// 文件过期时间（毫秒）
const FILE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24小时

// 服务器端口
const PORT = process.env.PORT || 8000;
```

## 📡 API 文档

### 上传文件
```
POST /upload
Content-Type: multipart/form-data

参数:
- file: 要上传的文件

响应:
{
  "success": true,
  "message": "文件上传成功",
  "file": {
    "filename": "生成的文件名",
    "originalName": "原始文件名",
    "size": 文件大小,
    "uploadTime": "上传时间",
    "expiryTime": "过期时间",
    "remainingTime": 剩余时间毫秒,
    "remainingTimeFormatted": "格式化的剩余时间"
  }
}
```

### 获取文件列表
```
GET /files

响应:
{
  "files": [
    {
      "filename": "文件名",
      "originalName": "原始文件名",
      "size": 文件大小,
      "mimetype": "文件类型",
      "uploadTime": "上传时间",
      "expiryTime": "过期时间",
      "remainingTime": 剩余时间毫秒,
      "remainingTimeFormatted": "格式化的剩余时间"
    }
  ]
}
```

### 下载文件
```
GET /download/:filename

参数:
- filename: 文件名

响应: 文件流
```

### 删除文件
```
DELETE /delete/:filename

参数:
- filename: 文件名

响应:
{
  "success": true,
  "message": "文件删除成功"
}
```

## 📁 项目结构

```
temp-file-share/
├── server.js              # 服务器主文件
├── package.json           # 项目配置
├── package-lock.json      # 依赖锁定文件
├── README.md             # 项目说明
├── .gitignore            # Git忽略文件
├── public/               # 静态文件目录
│   └── index.html        # 前端页面
└── uploads/              # 文件上传目录
    ├── .gitkeep          # 保持目录结构
    └── .metadata/        # 文件元数据目录
```

## ⚠️ 注意事项

1. **文件安全**: 请不要上传敏感或机密文件
2. **存储空间**: 定期清理过期文件，避免磁盘空间不足
3. **网络安全**: 建议在生产环境中配置HTTPS
4. **防火墙**: 确保服务器端口已正确开放
5. **备份**: 重要文件请及时下载备份

## 🚀 部署建议

### 生产环境部署
1. 使用 PM2 或类似工具管理进程
2. 配置 Nginx 反向代理
3. 启用 HTTPS
4. 设置定时任务清理过期文件
5. 配置日志记录和监控

### Docker 部署
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 8000
CMD ["node", "server.js"]
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- GitHub Issues
- Email: your-email@example.com

---

⭐ 如果这个项目对你有帮助，请给个星标支持一下！