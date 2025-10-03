#!/bin/bash

# 健康检查脚本
# 检查服务器是否正常运行，如果不正常则自动重启

LOG_FILE="/root/logs/health-check.log"
SERVICE_URL="http://localhost:8000"
MAX_RETRIES=3
RETRY_INTERVAL=10

# 创建日志目录
mkdir -p /root/logs

# 记录日志函数
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# 检查服务是否响应
check_service() {
    local retry_count=0
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        # 使用curl检查服务状态
        if curl -f -s --max-time 10 "$SERVICE_URL" > /dev/null 2>&1; then
            log_message "服务正常运行"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        log_message "服务检查失败，重试 $retry_count/$MAX_RETRIES"
        
        if [ $retry_count -lt $MAX_RETRIES ]; then
            sleep $RETRY_INTERVAL
        fi
    done
    
    return 1
}

# 重启服务
restart_service() {
    log_message "开始重启服务..."
    
    # 使用PM2重启服务
    pm2 restart temp-file-share
    
    if [ $? -eq 0 ]; then
        log_message "服务重启成功"
        sleep 5
        
        # 再次检查服务状态
        if check_service; then
            log_message "服务重启后运行正常"
            return 0
        else
            log_message "服务重启后仍然异常"
            return 1
        fi
    else
        log_message "服务重启失败"
        return 1
    fi
}

# 主逻辑
main() {
    log_message "开始健康检查"
    
    if ! check_service; then
        log_message "服务异常，尝试重启"
        
        if restart_service; then
            log_message "健康检查完成，服务已恢复"
        else
            log_message "健康检查失败，服务无法恢复，请手动检查"
            # 可以在这里添加邮件通知或其他告警机制
        fi
    else
        log_message "健康检查完成，服务正常"
    fi
}

# 执行主逻辑
main