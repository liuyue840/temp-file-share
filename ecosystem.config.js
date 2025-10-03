module.exports = {
  apps: [{
    name: 'temp-file-share',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // 健康检查配置
    health_check_grace_period: 3000,
    health_check_interval: 30000,
    // 自动重启配置
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    // 监控配置
    monitoring: true,
    pmx: true
  }]
};