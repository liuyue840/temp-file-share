const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const app = express();
const PORT = 8000;

// 确保必要的目录存在
const uploadsDir = path.join(__dirname, 'uploads');
const metadataDir = path.join(__dirname, 'uploads', '.metadata');
const publicDir = path.join(__dirname, 'public');

[uploadsDir, metadataDir, publicDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 中间件配置
app.use(express.json());
app.use(express.static('public'));

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名，避免冲突
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const filename = `${name}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB 限制
  }
});

// 工具函数：保存文件元数据
function saveFileMetadata(filename, originalName, size, mimetype) {
  const now = new Date();
  const expiryTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24小时后过期
  
  const metadata = {
    filename,
    originalName,
    size,
    mimetype,
    uploadTime: now.toISOString(),
    expiryTime: expiryTime.toISOString()
  };
  
  const metadataPath = path.join(metadataDir, `${filename}.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  return metadata;
}

// 工具函数：读取文件元数据
function getFileMetadata(filename) {
  const metadataPath = path.join(metadataDir, `${filename}.json`);
  if (fs.existsSync(metadataPath)) {
    try {
      const data = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('读取元数据失败:', error);
      return null;
    }
  }
  return null;
}

// 工具函数：计算剩余时间
function calculateRemainingTime(expiryTime) {
  const now = new Date();
  const expiry = new Date(expiryTime);
  const remaining = expiry.getTime() - now.getTime();
  return Math.max(0, remaining);
}

// 工具函数：格式化剩余时间
function formatRemainingTime(milliseconds) {
  if (milliseconds <= 0) return '已过期';
  
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
}

// 工具函数：检查文件是否过期
function isFileExpired(expiryTime) {
  const now = new Date();
  const expiry = new Date(expiryTime);
  return now > expiry;
}

// 工具函数：清理过期文件
function cleanupExpiredFiles() {
  console.log('开始清理过期文件...');
  
  try {
    const files = fs.readdirSync(uploadsDir);
    let cleanedCount = 0;
    
    files.forEach(filename => {
      if (filename === '.metadata') return;
      
      const metadata = getFileMetadata(filename);
      if (metadata && isFileExpired(metadata.expiryTime)) {
        // 删除文件
        const filePath = path.join(uploadsDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        // 删除元数据
        const metadataPath = path.join(metadataDir, `${filename}.json`);
        if (fs.existsSync(metadataPath)) {
          fs.unlinkSync(metadataPath);
        }
        
        cleanedCount++;
        console.log(`已删除过期文件: ${filename}`);
      }
    });
    
    console.log(`清理完成，共删除 ${cleanedCount} 个过期文件`);
  } catch (error) {
    console.error('清理过期文件时出错:', error);
  }
}

// 路由：主页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 路由：文件上传
app.post('/upload', (req, res) => {
  // 添加调试信息
  console.log('收到上传请求');
  console.log('Content-Type:', req.headers['content-type']);
  
  // 使用动态multer处理，支持更好的错误处理
  const uploadHandler = upload.single('file');
  
  uploadHandler(req, res, (err) => {
    if (err) {
      console.error('Multer错误:', err);
      if (err.code === 'UNEXPECTED_FIELD') {
        return res.status(400).json({ 
          success: false, 
          message: '字段名不匹配，请确保使用正确的字段名"file"' 
        });
      }
      return res.status(400).json({ 
        success: false, 
        message: '文件上传失败: ' + err.message 
      });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '没有文件被上传' });
      }
      
      console.log('文件上传成功:', req.file.originalname);
      
      const metadata = saveFileMetadata(req.file.filename, req.file.originalname, req.file.size, req.file.mimetype);
      const uploadedFile = {
        ...metadata,
        remainingTime: calculateRemainingTime(metadata.expiryTime),
        remainingTimeFormatted: formatRemainingTime(calculateRemainingTime(metadata.expiryTime))
      };
      
      res.json({
        success: true,
        message: '文件上传成功',
        file: uploadedFile
      });
    } catch (error) {
      console.error('文件上传错误:', error);
      res.status(500).json({ success: false, message: '文件上传失败' });
    }
  });
});

// 路由：获取文件列表
app.get('/files', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const fileList = [];
    
    files.forEach(filename => {
      if (filename === '.metadata') return;
      
      const metadata = getFileMetadata(filename);
      if (metadata) {
        const remainingTime = calculateRemainingTime(metadata.expiryTime);
        if (remainingTime > 0) { // 只返回未过期的文件
          fileList.push({
            ...metadata,
            remainingTime,
            remainingTimeFormatted: formatRemainingTime(remainingTime)
          });
        }
      }
    });
    
    // 按上传时间倒序排列
    fileList.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
    
    res.json({ files: fileList });
  } catch (error) {
    console.error('获取文件列表错误:', error);
    res.status(500).json({ success: false, message: '获取文件列表失败' });
  }
});

// 路由：文件下载
app.get('/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }
    
    const metadata = getFileMetadata(filename);
    if (metadata && isFileExpired(metadata.expiryTime)) {
      return res.status(410).json({ success: false, message: '文件已过期' });
    }
    
    // 设置下载头
    const originalName = metadata ? metadata.originalName : filename;
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
    
    // 发送文件
    res.sendFile(filePath);
  } catch (error) {
    console.error('文件下载错误:', error);
    res.status(500).json({ success: false, message: '文件下载失败' });
  }
});

// 路由：删除文件
app.delete('/delete/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    const metadataPath = path.join(metadataDir, `${filename}.json`);
    
    // 删除文件
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // 删除元数据
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }
    
    res.json({ success: true, message: '文件删除成功' });
  } catch (error) {
    console.error('文件删除错误:', error);
    res.status(500).json({ success: false, message: '文件删除失败' });
  }
});

// 定时任务：每小时清理过期文件
cron.schedule('0 * * * *', () => {
  cleanupExpiredFiles();
});

// 启动时清理一次过期文件
cleanupExpiredFiles();

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`临时文件共享服务已启动`);
  console.log(`本地访问: http://localhost:${PORT}`);
  console.log(`公网访问: http://[您的公网IP]:${PORT}`);
  console.log('文件将在上传后24小时自动删除');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n正在关闭服务器...');
  process.exit(0);
});