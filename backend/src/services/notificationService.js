/**
 * 通知服务 - AI自进化系统 Phase 4
 * 发送告警通知到各渠道
 */
const Alert = require('../models/Alert');
const AlertRule = require('../models/AlertRule');

class NotificationService {
  
  constructor() {
    // 通知配置（可从环境变量读取）
    this.config = {
      email: {
        enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
        from: process.env.ALERT_EMAIL_FROM || 'alerts@ai-host.com',
        to: process.env.ALERT_EMAIL_TO ? process.env.ALERT_EMAIL_TO.split(',') : [],
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT || 587,
        smtpUser: process.env.SMTP_USER,
        smtpPass: process.env.SMTP_PASS,
      },
      webhook: {
        enabled: process.env.ALERT_WEBHOOK_ENABLED === 'true',
        url: process.env.ALERT_WEBHOOK_URL,
      },
      wechat: {
        enabled: process.env.ALERT_WECHAT_ENABLED === 'true',
        corpId: process.env.WECHAT_CORP_ID,
        agentId: process.env.WECHAT_AGENT_ID,
        secret: process.env.WECHAT_SECRET,
      },
      slack: {
        enabled: process.env.ALERT_SLACK_ENABLED === 'true',
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
      }
    };
    
    // 通知冷却记录
    this.cooldowns = new Map();
  }
  
  // ==================== 主通知入口 ====================
  
  /**
   * 发送告警通知
   */
  async sendAlertNotification(alert, rule = null) {
    // 如果没有规则，尝试获取
    if (!rule) {
      const rules = await AlertRule.getEnabledRules(alert.type);
      rule = rules[0];
    }
    
    if (!rule || !rule.notifications?.channels?.length) {
      console.log(`[Notification] 告警 ${alert._id} 没有配置通知渠道`);
      return { sent: false, reason: 'no_channels' };
    }
    
    // 检查冷却
    const cooldownKey = `${alert.type}:${alert.agentId || 'global'}`;
    const lastSent = this.cooldowns.get(cooldownKey);
    const cooldownMs = (rule.notifications.cooldown || 60) * 60 * 1000;
    
    if (lastSent && (Date.now() - lastSent) < cooldownMs) {
      console.log(`[Notification] 告警 ${alert._id} 在冷却中`);
      return { sent: false, reason: 'cooldown' };
    }
    
    // 发送到各渠道
    const results = [];
    
    for (const channel of rule.notifications.channels) {
      if (!channel.enabled) continue;
      
      try {
        const result = await this.sendToChannel(channel.type, channel.target, alert);
        results.push({
          channel: channel.type,
          success: result.success,
          error: result.error,
        });
        
        // 记录通知
        alert.notifications = alert.notifications || [];
        alert.notifications.push({
          channel: channel.type,
          sentAt: new Date(),
          success: result.success,
          error: result.error,
        });
        
      } catch (err) {
        console.error(`[Notification] 发送到 ${channel.type} 失败:`, err.message);
        results.push({
          channel: channel.type,
          success: false,
          error: err.message,
        });
      }
    }
    
    // 更新告警记录
    await alert.save();
    
    // 更新冷却
    if (results.some(r => r.success)) {
      this.cooldowns.set(cooldownKey, Date.now());
    }
    
    return { sent: results.some(r => r.success), results };
  }
  
  // ==================== 各渠道发送 ====================
  
  /**
   * 发送到指定渠道
   */
  async sendToChannel(channelType, target, alert) {
    switch (channelType) {
      case 'email':
        return this.sendEmail(target, alert);
      case 'webhook':
        return this.sendWebhook(target, alert);
      case 'wechat':
        return this.sendWechat(target, alert);
      case 'slack':
        return this.sendSlack(target, alert);
      default:
        return { success: false, error: `未知渠道: ${channelType}` };
    }
  }
  
  /**
   * 发送邮件
   */
  async sendEmail(to, alert) {
    if (!this.config.email.enabled) {
      return { success: false, error: '邮件通知未启用' };
    }
    
    const emailTo = to || this.config.email.to;
    if (!emailTo || emailTo.length === 0) {
      return { success: false, error: '未配置收件人' };
    }
    
    // 这里使用简化的邮件发送逻辑
    // 实际项目中应使用 nodemailer 等库
    try {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransport({
        host: this.config.email.smtpHost,
        port: this.config.email.smtpPort,
        auth: {
          user: this.config.email.smtpUser,
          pass: this.config.email.smtpPass,
        },
      });
      
      const severityEmoji = {
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🚨',
      };
      
      const mailOptions = {
        from: this.config.email.from,
        to: Array.isArray(emailTo) ? emailTo.join(',') : emailTo,
        subject: `${severityEmoji[alert.severity] || '📢'} [AI-Host] ${alert.title}`,
        html: this.formatEmailBody(alert),
      };
      
      await transporter.sendMail(mailOptions);
      console.log(`[Notification] 邮件发送成功: ${alert.title}`);
      return { success: true };
      
    } catch (err) {
      console.error('[Notification] 邮件发送失败:', err.message);
      return { success: false, error: err.message };
    }
  }
  
  /**
   * 发送 Webhook
   */
  async sendWebhook(url, alert) {
    const webhookUrl = url || this.config.webhook.url;
    
    if (!webhookUrl) {
      return { success: false, error: 'Webhook URL 未配置' };
    }
    
    try {
      const payload = {
        type: 'alert',
        alert: {
          id: alert._id,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          data: alert.data,
          createdAt: alert.createdAt,
        },
        timestamp: new Date().toISOString(),
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      console.log(`[Notification] Webhook 发送成功: ${alert.title}`);
      return { success: true };
      
    } catch (err) {
      console.error('[Notification] Webhook 发送失败:', err.message);
      return { success: false, error: err.message };
    }
  }
  
  /**
   * 发送企业微信
   */
  async sendWechat(userId, alert) {
    if (!this.config.wechat.enabled) {
      return { success: false, error: '企业微信通知未启用' };
    }
    
    try {
      // 获取 access_token
      const tokenUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.config.wechat.corpId}&corpsecret=${this.config.wechat.secret}`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();
      
      if (tokenData.errcode !== 0) {
        throw new Error(tokenData.errmsg);
      }
      
      // 发送消息
      const messageUrl = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tokenData.access_token}`;
      
      const severityEmoji = {
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🚨',
      };
      
      const message = {
        touser: userId || '@all',
        msgtype: 'text',
        agentid: this.config.wechat.agentId,
        text: {
          content: `${severityEmoji[alert.severity] || '📢'} ${alert.title}\n\n${alert.message}\n\n时间: ${new Date(alert.createdAt).toLocaleString('zh-CN')}`,
        },
      };
      
      const msgRes = await fetch(messageUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      
      const msgData = await msgRes.json();
      
      if (msgData.errcode !== 0) {
        throw new Error(msgData.errmsg);
      }
      
      console.log(`[Notification] 企业微信发送成功: ${alert.title}`);
      return { success: true };
      
    } catch (err) {
      console.error('[Notification] 企业微信发送失败:', err.message);
      return { success: false, error: err.message };
    }
  }
  
  /**
   * 发送 Slack
   */
  async sendSlack(channel, alert) {
    const webhookUrl = this.config.slack.webhookUrl;
    
    if (!this.config.slack.enabled || !webhookUrl) {
      return { success: false, error: 'Slack 通知未启用或未配置' };
    }
    
    try {
      const colorMap = {
        info: '#36a64f',
        warning: '#ffcc00',
        critical: '#ff0000',
      };
      
      const payload = {
        channel: channel || undefined,
        attachments: [{
          color: colorMap[alert.severity] || '#808080',
          title: alert.title,
          text: alert.message,
          fields: [
            { title: '类型', value: alert.type, short: true },
            { title: '级别', value: alert.severity, short: true },
          ],
          footer: 'AI-Host Alert System',
          ts: Math.floor(new Date(alert.createdAt).getTime() / 1000),
        }],
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      console.log(`[Notification] Slack 发送成功: ${alert.title}`);
      return { success: true };
      
    } catch (err) {
      console.error('[Notification] Slack 发送失败:', err.message);
      return { success: false, error: err.message };
    }
  }
  
  // ==================== 格式化 ====================
  
  /**
   * 格式化邮件正文
   */
  formatEmailBody(alert) {
    const severityColor = {
      info: '#17a2b8',
      warning: '#ffc107',
      critical: '#dc3545',
    };
    
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${severityColor[alert.severity] || '#6c757d'}; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
    .footer { background: #e9ecef; padding: 10px; text-align: center; font-size: 12px; border-radius: 0 0 5px 5px; }
    .metric { background: white; padding: 10px; margin: 10px 0; border-radius: 5px; }
    .label { font-weight: bold; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">${alert.title}</h2>
      <p style="margin:5px 0 0 0;">级别: ${alert.severity.toUpperCase()}</p>
    </div>
    <div class="content">
      <p>${alert.message}</p>
      
      ${alert.data ? `
      <div class="metric">
        <p class="label">指标详情:</p>
        <ul>
          ${alert.data.metric ? `<li>指标: ${alert.data.metric}</li>` : ''}
          ${alert.data.currentValue !== undefined ? `<li>当前值: ${alert.data.currentValue}</li>` : ''}
          ${alert.data.threshold !== undefined ? `<li>阈值: ${alert.data.threshold}</li>` : ''}
          ${alert.data.changePercent !== undefined ? `<li>变化: ${alert.data.changePercent > 0 ? '+' : ''}${alert.data.changePercent.toFixed(1)}%</li>` : ''}
        </ul>
      </div>
      ` : ''}
      
      <p class="label">告警时间: ${new Date(alert.createdAt).toLocaleString('zh-CN')}</p>
      ${alert.duplicateCount > 1 ? `<p class="label">重复次数: ${alert.duplicateCount}</p>` : ''}
    </div>
    <div class="footer">
      AI-Host 自动告警系统 | <a href="#">查看详情</a>
    </div>
  </div>
</body>
</html>
    `;
  }
  
  // ==================== 批量通知 ====================
  
  /**
   * 发送所有待通知的告警
   */
  async sendPendingNotifications() {
    // 获取新创建且未通知的告警
    const pendingAlerts = await Alert.find({
      status: 'active',
      'notifications.0': { $exists: false }, // 没有发过通知
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // 1小时内
    }).limit(50);
    
    let sent = 0;
    
    for (const alert of pendingAlerts) {
      const result = await this.sendAlertNotification(alert);
      if (result.sent) sent++;
    }
    
    console.log(`[Notification] 批量发送完成: ${sent}/${pendingAlerts.length}`);
    return { total: pendingAlerts.length, sent };
  }
}

// 导出单例
module.exports = new NotificationService();
