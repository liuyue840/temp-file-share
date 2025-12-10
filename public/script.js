class FileManager {
    constructor() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.fileList = document.getElementById('fileList');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        
        this.initEventListeners();
        this.loadFiles();
    }

    initEventListeners() {
        // 文件选择
        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
            // 重置 input 以便允许再次选择相同文件
            this.fileInput.value = '';
        });

        // 拖拽上传
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        // 点击上传区域
        this.uploadArea.addEventListener('click', (e) => {
            if (e.target === this.uploadArea || e.target.closest('.upload-area')) {
                this.fileInput.click();
            }
        });
    }

    async handleFiles(files) {
        if (files.length === 0) return;

        // 检查文件大小
        const MAX_SIZE = 100 * 1024 * 1024; // 100MB
        const validFiles = Array.from(files).filter(file => {
            if (file.size > MAX_SIZE) {
                this.showToast(`${file.name} 超过100MB限制`, 'error');
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        for (let file of validFiles) {
            try {
                await this.uploadFile(file);
            } catch (error) {
                this.showToast(`${file.name} 上传失败: ${error.message}`, 'error');
            }
        }
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        this.progressContainer.style.display = 'block';
        this.progressFill.style.width = '0%';
        this.progressText.textContent = '准备上传...';

        try {
            const xhr = new XMLHttpRequest();
            
            return new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const progress = (e.loaded / e.total) * 100;
                        this.progressFill.style.width = progress + '%';
                        this.progressText.textContent = `上传中... ${Math.round(progress)}%`;
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        const response = JSON.parse(xhr.responseText);
                        this.progressText.textContent = '上传完成！';
                        this.showToast(`${file.name} 上传成功！`, 'success');
                        setTimeout(() => {
                            this.progressContainer.style.display = 'none';
                            this.loadFiles();
                        }, 1000);
                        resolve(response);
                    } else {
                        reject(new Error('上传失败'));
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new Error('网络错误'));
                });

                xhr.open('POST', '/upload');
                xhr.send(formData);
            });
        } catch (error) {
            this.progressContainer.style.display = 'none';
            throw error;
        }
    }

    async loadFiles() {
        // 显示加载状态
        // 只有当列表为空或者没有正在加载时才显示加载动画
        if (this.fileList.children.length === 0 || this.fileList.querySelector('.loading')) {
             this.fileList.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
        }

        try {
            const response = await fetch('/files');
            const data = await response.json();
            
            if (data.files && data.files.length > 0) {
                this.renderFiles(data.files);
            } else {
                this.fileList.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="ri-folder-open-line"></i></div><p>暂无文件</p></div>';
            }
        } catch (error) {
            this.fileList.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="ri-error-warning-line"></i></div><p>加载文件列表失败</p></div>';
            this.showToast('加载文件列表失败', 'error');
        }
    }

    renderFiles(files) {
        this.fileList.innerHTML = files.map(file => `
            <div class="file-item">
                <div class="file-header">
                    <div class="file-icon">${this.getFileIcon(file.mimetype)}</div>
                    <div class="file-info">
                        <div class="file-name" title="${file.originalName}">${file.originalName}</div>
                        <div class="file-meta">
                            ${this.formatFileSize(file.size)}  
                            <br>
                            ${new Date(file.uploadTime).toLocaleString()}
                        </div>
                    </div>
                </div>
                <div class="time-remaining">
                     剩余时间: ${file.remainingTimeFormatted}
                </div>
                <div class="file-actions">
                    <button class="btn btn-copy" onclick="fileManager.copyLink('${file.filename}')">
                        <i class="ri-file-copy-line"></i> 复制
                    </button>
                    <a href="/download/${file.filename}" class="btn btn-download" download>
                        <i class="ri-download-line"></i> 下载
                    </a>
                    <button class="btn btn-delete" onclick="fileManager.deleteFile('${file.filename}')">
                        <i class="ri-delete-bin-line"></i> 删除
                    </button>
                </div>
            </div>
        `).join('');
    }

    async deleteFile(filename) {
        if (!confirm('确定要删除这个文件吗？')) return;

        try {
            const response = await fetch(`/delete/${filename}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showToast('文件删除成功', 'success');
                this.loadFiles();
            } else {
                throw new Error('删除失败');
            }
        } catch (error) {
            this.showToast('删除失败: ' + error.message, 'error');
        }
    }

    copyLink(filename) {
        const url = `${window.location.origin}/download/${filename}`;
        navigator.clipboard.writeText(url).then(() => {
            this.showToast('下载链接已复制到剪贴板', 'info');
        }).catch(() => {
            this.showToast('复制失败，请手动复制', 'error');
        });
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getFileIcon(mimetype) {
        if (!mimetype) return '<i class="ri-file-line"></i>';
        
        if (mimetype.startsWith('image/')) return '<i class="ri-image-line"></i>';
        if (mimetype.startsWith('video/')) return '<i class="ri-video-line"></i>';
        if (mimetype.startsWith('audio/')) return '<i class="ri-music-line"></i>';
        if (mimetype.includes('pdf')) return '<i class="ri-file-pdf-line"></i>';
        if (mimetype.includes('word') || mimetype.includes('officedocument.wordprocessing')) return '<i class="ri-file-word-line"></i>';
        if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return '<i class="ri-file-excel-line"></i>';
        if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return '<i class="ri-file-ppt-line"></i>';
        if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('7z') || mimetype.includes('tar')) return '<i class="ri-file-zip-line"></i>';
        if (mimetype.includes('text') || mimetype.includes('json') || mimetype.includes('xml')) return '<i class="ri-file-text-line"></i>';
        if (mimetype.includes('javascript') || mimetype.includes('html') || mimetype.includes('css')) return '<i class="ri-code-line"></i>';
        
        return '<i class="ri-file-line"></i>';
    }
}

// 初始化文件管理器
const fileManager = new FileManager();

// 定期刷新文件列表
setInterval(() => {
    fileManager.loadFiles();
}, 30000); // 每30秒刷新一次
