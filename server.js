require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 8000;

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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      "style-src": ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      "font-src": ["'self'", "cdn.jsdelivr.net", "data:"],
      "img-src": ["'self'", "data:", "blob:"],
    },
  },
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.static(publicDir));
app.use(express.json());

// 配置
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024; // 默认100MB
const FILE_EXPIRY_HOURS = parseInt(process.env.FILE_EXPIRY_HOURS) || 24;
const FILE_EXPIRY_TIME = FILE_EXPIRY_HOURS * 60 * 60 * 1000;

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名
    // 使用 URL 安全的字符替换文件名中的特殊字符
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = uniqueSuffix + ext;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: function (req, file, cb) {
    // 这里可以添加文件类型过滤逻辑
    cb(null, true);
  }
});

// 保存文件元数据
function saveFileMetadata(filename, originalName, mimetype, size) {
  const metadata = {
    filename,
    originalName,
    mimetype,
    size,
    uploadTime: new Date().toISOString(),
    expiryTime: new Date(Date.now() + FILE_EXPIRY_TIME).toISOString()
  };
  
  const metadataPath = path.join(metadataDir, filename + '.json');
  try {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error('保存元数据失败:', error);
  }
}

// 获取文件元数据
function getFileMetadata(filename) {
  const metadataPath = path.join(metadataDir, filename + '.json');
  try {
    if (fs.existsSync(metadataPath)) {
      const data = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('读取元数据失败:', error);
  }
  return null;
}

// 格式化剩余时间
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

// 清理过期文件的函数
function cleanupExpiredFiles() {
  console.log('开始清理过期文件...');
  
  try {
    if (!fs.existsSync(uploadsDir)) return;

    const files = fs.readdirSync(uploadsDir);
    let cleanedCount = 0;
    
    files.forEach(filename => {
      if (filename === '.metadata' || filename === '.gitkeep') return;
      
      const filePath = path.join(uploadsDir, filename);
      // 检查是否是目录
      try {
          if (fs.lstatSync(filePath).isDirectory()) return;
      } catch (e) {
          return;
      }

      const metadata = getFileMetadata(filename);
      
      if (metadata) {
        const expiryTime = new Date(metadata.expiryTime);
        const now = new Date();
        
        if (now > expiryTime) {
          // 删除文件
          try {
            fs.unlinkSync(filePath);
            // 删除元数据
            const metadataPath = path.join(metadataDir, filename + '.json');
            if (fs.existsSync(metadataPath)) {
              fs.unlinkSync(metadataPath);
            }
            console.log(`已删除过期文件: ${filename}`);
            cleanedCount++;
          } catch (error) {
            console.error('删除文件失败:', error);
          }
        }
      } else {
        // 如果没有元数据，检查文件创建时间
        try {
          const stats = fs.statSync(filePath);
          const fileAge = Date.now() - stats.birthtime.getTime();
          
          if (fileAge > FILE_EXPIRY_TIME) {
            fs.unlinkSync(filePath);
            console.log(`已删除无元数据的过期文件: ${filename}`);
            cleanedCount++;
          }
        } catch (error) {
          console.error('处理无元数据文件失败:', error);
        }
      }
    });
    
    console.log(`清理完成，共删除 ${cleanedCount} 个过期文件`);
  } catch (error) {
    console.error('清理过期文件失败:', error);
  }
}

// 设置定时任务，每小时清理一次过期文件
cron.schedule('0 * * * *', cleanupExpiredFiles);

// 启动时清理一次
cleanupExpiredFiles();

// 路由处理
// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// 文件上传处理
app.post('/upload', (req, res) => {
  // 使用multer中间件处理上传
  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      console.error('Multer错误:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          success: false, 
          message: `文件大小超过限制（最大${MAX_FILE_SIZE / 1024 / 1024}MB）` 
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ 
          success: false, 
          message: '请求中缺少文件字段"file"' 
        });
      }
      return res.status(400).json({ 
        success: false, 
        message: '上传错误: ' + err.message 
      });
    } else if (err) {
      console.error('上传错误:', err);
      return res.status(400).json({ success: false, message: '上传失败' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有文件被上传' });
    }

    try {
      console.log('文件上传:', req.file.originalname);
      
      // 保存文件元数据
      saveFileMetadata(
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size
      );

      const expiryTime = new Date(Date.now() + FILE_EXPIRY_TIME);
      const remainingTime = expiryTime.getTime() - Date.now();

      res.json({
        success: true,
        message: '文件上传成功',
        file: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          uploadTime: new Date().toISOString(),
          expiryTime: expiryTime.toISOString(),
          remainingTime: remainingTime,
          remainingTimeFormatted: formatRemainingTime(remainingTime)
        }
      });
    } catch (error) {
      console.error('处理上传失败:', error);
      res.status(500).json({ success: false, message: '处理上传失败' });
    }
  });
});

// 获取文件列表
app.get('/files', (req, res) => {
  try {
    if (!fs.existsSync(uploadsDir)) {
         return res.json({ files: [] });
    }
    const files = fs.readdirSync(uploadsDir);
    const fileList = [];

    files.forEach(filename => {
      if (filename === '.metadata' || filename === '.gitkeep') return;
      
      const filePath = path.join(uploadsDir, filename);
      
      try {
          if (fs.lstatSync(filePath).isDirectory()) return;
      } catch (e) {
          return;
      }

      const metadata = getFileMetadata(filename);
      
      if (metadata) {
        const expiryTime = new Date(metadata.expiryTime);
        const remainingTime = expiryTime.getTime() - Date.now();
        
        if (remainingTime > 0) { // 只返回未过期的文件
          fileList.push({
            filename: metadata.filename,
            originalName: metadata.originalName,
            size: metadata.size,
            mimetype: metadata.mimetype,
            uploadTime: metadata.uploadTime,
            expiryTime: metadata.expiryTime,
            remainingTime: remainingTime,
            remainingTimeFormatted: formatRemainingTime(remainingTime)
          });
        }
      }
    });

    // 按上传时间排序（最新的在前）
    fileList.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
    
    res.json({ files: fileList });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    res.status(500).json({ success: false, message: '获取文件列表失败' });
  }
});

// 文件下载处理
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);
  
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    const metadata = getFileMetadata(filename);
    if (metadata) {
      const expiryTime = new Date(metadata.expiryTime);
      if (Date.now() > expiryTime.getTime()) {
        return res.status(410).json({ success: false, message: '文件已过期' });
      }
    }

    // 设置下载头
    const originalName = metadata ? metadata.originalName : filename;
    // 使用 encodeURIComponent 编码文件名以支持中文
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
    
    // 发送文件
    res.sendFile(filePath);
  } catch (error) {
    console.error('下载文件失败:', error);
    res.status(500).json({ success: false, message: '下载文件失败' });
  }
});

// 文件删除处理
app.delete('/delete/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);
  const metadataPath = path.join(metadataDir, filename + '.json');
  
  try {
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
    console.error('删除文件失败:', error);
    res.status(500).json({ success: false, message: '删除文件失败' });
  }
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n临时文件共享服务已启动！`);
  console.log(`本地访问: http://localhost:${PORT}`);
  console.log(`文件将在上传后 ${FILE_EXPIRY_HOURS} 小时自动删除`);
  console.log(`最大文件大小: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  console.log('\n按 Ctrl+C 停止服务...');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n正在关闭服务...');
  process.exit(0);
});
