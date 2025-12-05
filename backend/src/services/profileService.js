/**
 * 用户画像服务
 * 
 * 负责：
 * 1. 获取和更新用户画像
 * 2. 从对话中自动提取用户信息
 * 3. 生成用于 AI 的画像提示文本
 */

const UserProfile = require('../models/UserProfile');

class ProfileService {
  
  /**
   * 获取或创建用户画像
   */
  async getOrCreate(userId, agentId) {
    let profile = await UserProfile.findOne({ userId, agentId });
    
    if (!profile) {
      profile = await UserProfile.create({ userId, agentId });
    }
    
    return profile;
  }
  
  /**
   * 获取用于注入 AI 系统提示的画像文本
   */
  async getProfilePrompt(userId, agentId) {
    const profile = await this.getOrCreate(userId, agentId);
    return profile.toPromptText();
  }
  
  /**
   * 从用户消息中提取关键信息并更新画像
   * 使用关键词匹配 + 简单 NLP
   */
  async extractAndUpdate(userId, agentId, userMessage) {
    const profile = await this.getOrCreate(userId, agentId);
    const msg = userMessage.toLowerCase();
    const updates = {};
    const memories = [];
    
    // ========== 姓名提取 ==========
    const namePatterns = [
      /我叫(.{1,10}?)(?:，|。|！|$|\s)/,
      /我的名字是(.{1,10}?)(?:，|。|！|$|\s)/,
      /我是(.{1,6}?)(?:，|。|！|$|\s)/,
      /叫我(.{1,8}?)(?:吧|就行|可以|好了|$)/,
      /你可以叫我(.{1,8}?)(?:$|，|。)/,
      /my name is (\w+)/i,
      /i'?m (\w+)/i,
      /call me (\w+)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1] && match[1].length <= 10) {
        const name = match[1].trim();
        // 排除一些常见的非名字词
        if (!['男', '女', '人', '学生', '上班族', '自由职业'].includes(name)) {
          updates.nickname = name;
          memories.push({ content: `用户说叫他/她 ${name}`, category: 'personal' });
          break;
        }
      }
    }
    
    // ========== 年龄提取 ==========
    const agePatterns = [
      /我(\d{1,3})岁/,
      /我今年(\d{1,3})/,
      /(\d{1,3})岁了/,
      /i'?m (\d{1,3}) years old/i,
      /i am (\d{1,3})/i
    ];
    
    for (const pattern of agePatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        const age = parseInt(match[1]);
        if (age > 0 && age < 150) {
          updates.age = match[1];
          break;
        }
      }
    }
    
    // ========== 性别提取 ==========
    if (/我是男(的|生|人|孩)/.test(msg) || /i'?m a (guy|man|boy|male)/i.test(msg)) {
      updates.gender = '男';
    } else if (/我是女(的|生|人|孩)/.test(msg) || /i'?m a (girl|woman|female)/i.test(msg)) {
      updates.gender = '女';
    }
    
    // ========== 生日提取 ==========
    const birthdayPatterns = [
      /我(的)?生日(是)?(\d{1,2}月\d{1,2}[日号]?)/,
      /(\d{1,2}月\d{1,2}[日号]?)是我(的)?生日/,
      /我(\d{1,2})月(\d{1,2})[日号]?生/,
      /my birthday is (\w+ \d+)/i
    ];
    
    for (const pattern of birthdayPatterns) {
      const match = userMessage.match(pattern);
      if (match) {
        const birthday = match[3] || match[1] || `${match[1]}月${match[2]}日`;
        updates.birthday = birthday;
        memories.push({ content: `用户的生日是 ${birthday}`, category: 'personal' });
        break;
      }
    }
    
    // ========== 地点提取 ==========
    const locationPatterns = [
      /我在(.{2,15}?)(?:住|工作|上班|上学|生活)/,
      /我是(.{2,10}?)人/,
      /我住在(.{2,15}?)(?:$|，|。)/,
      /我来自(.{2,15}?)(?:$|，|。)/,
      /i(?:'m| am) (?:from|in|at) (.{2,20})/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        updates.location = match[1].trim();
        break;
      }
    }
    
    // ========== 职业提取 ==========
    const occupationPatterns = [
      /我是(?:一名|一个)?(.{2,15}?)(?:$|，|。|！)/,
      /我(做|干|从事)(.{2,10}?)(?:的|工作|$)/,
      /我的(?:工作|职业)是(.{2,15}?)(?:$|，|。)/,
      /i(?:'m| am) a(?:n)? (.{2,20})/i,
      /i work as a(?:n)? (.{2,20})/i
    ];
    
    // 职业关键词白名单
    const occupationKeywords = [
      '程序员', '工程师', '设计师', '医生', '护士', '教师', '老师', '学生',
      '律师', '会计', '销售', '经理', '总监', 'CEO', '创业者', '自由职业',
      '作家', '记者', '演员', '歌手', '画家', '摄影师', '厨师', '司机',
      'developer', 'engineer', 'designer', 'doctor', 'teacher', 'student'
    ];
    
    for (const pattern of occupationPatterns) {
      const match = userMessage.match(pattern);
      if (match) {
        const occ = (match[2] || match[1]).trim();
        if (occupationKeywords.some(k => occ.includes(k))) {
          updates.occupation = occ;
          break;
        }
      }
    }
    
    // ========== 喜好提取 ==========
    // 食物
    const foodPatterns = [
      /我(?:喜欢|爱)吃(.{1,20}?)(?:$|，|。|！)/,
      /我最喜欢(?:的食物|吃的)是(.{1,20}?)(?:$|，|。)/,
      /(.{2,10}?)(?:是我的最爱|我特别喜欢)/,
      /i (?:love|like) (?:eating |to eat )?(.{2,20})/i
    ];
    
    for (const pattern of foodPatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        const food = match[1].trim();
        if (food.length <= 15 && !profile.favoriteFood?.includes(food)) {
          updates.$addToSet = updates.$addToSet || {};
          updates.$addToSet.favoriteFood = food;
          memories.push({ content: `用户喜欢吃 ${food}`, category: 'preference' });
        }
        break;
      }
    }
    
    // 兴趣爱好
    const hobbyPatterns = [
      /我(?:喜欢|爱|的爱好是)(.{2,20}?)(?:$|，|。|！)/,
      /我平时(?:喜欢|爱|会)(.{2,20}?)(?:$|，|。)/,
      /我的兴趣是(.{2,20}?)(?:$|，|。)/,
      /i (?:love|like|enjoy) (.{2,30})/i
    ];
    
    const hobbyKeywords = [
      '看书', '读书', '游戏', '打游戏', '运动', '健身', '跑步', '游泳',
      '音乐', '听歌', '唱歌', '弹琴', '钢琴', '吉他', '画画', '绘画',
      '摄影', '旅游', '旅行', '电影', '看电影', '追剧', '动漫', '二次元',
      '编程', '代码', '写作', '烹饪', '做饭', '钓鱼', '登山', '瑜伽',
      'gaming', 'reading', 'music', 'sports', 'travel', 'cooking', 'movies'
    ];
    
    for (const pattern of hobbyPatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        const hobby = match[1].trim();
        if (hobbyKeywords.some(k => hobby.includes(k)) && !profile.hobbies?.includes(hobby)) {
          updates.$addToSet = updates.$addToSet || {};
          updates.$addToSet.hobbies = hobby;
          memories.push({ content: `用户喜欢 ${hobby}`, category: 'preference' });
        }
        break;
      }
    }
    
    // ========== 宠物提取 ==========
    const petPatterns = [
      /我养了(?:一只|一条|一个)?(.{1,10}?)(?:$|，|。|！)/,
      /我有(?:一只|一条|一个)?(.{1,10}?)(?:叫|名字)/,
      /我家(?:的)?(.{2,6}?)(?:叫|很|特别)/,
      /i have a(?:n)? (.{2,15})/i
    ];
    
    const petKeywords = ['猫', '狗', '狗狗', '猫咪', '仓鼠', '兔子', '鹦鹉', '金鱼', 'cat', 'dog', 'pet'];
    
    for (const pattern of petPatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        const pet = match[1].trim();
        if (petKeywords.some(k => pet.includes(k)) && !profile.pets?.includes(pet)) {
          updates.$addToSet = updates.$addToSet || {};
          updates.$addToSet.pets = pet;
          memories.push({ content: `用户养了 ${pet}`, category: 'personal' });
        }
        break;
      }
    }
    
    // ========== 感情状态提取 ==========
    if (/我(有|交了)(女朋友|男朋友|对象)/.test(msg) || /我(恋爱|脱单)了/.test(msg)) {
      updates.relationshipStatus = '恋爱中';
    } else if (/我(单身|没有对象|没对象)/.test(msg)) {
      updates.relationshipStatus = '单身';
    } else if (/我(结婚|已婚)/.test(msg)) {
      updates.relationshipStatus = '已婚';
    }
    
    // ========== 更新画像 ==========
    if (Object.keys(updates).length > 0 || memories.length > 0) {
      // 添加重要记忆
      if (memories.length > 0) {
        updates.$push = updates.$push || {};
        updates.$push.importantMemories = { $each: memories };
      }
      
      // 更新活跃时间
      updates.lastActiveAt = new Date();
      updates.$inc = { totalMessages: 1 };
      
      await UserProfile.findOneAndUpdate(
        { userId, agentId },
        updates,
        { upsert: true, new: true }
      );
      
      console.log(`[Profile] 更新用户画像: userId=${userId}, updates=`, 
        Object.keys(updates).filter(k => !k.startsWith('$')));
    } else {
      // 只更新消息计数
      await UserProfile.findOneAndUpdate(
        { userId, agentId },
        { 
          lastActiveAt: new Date(),
          $inc: { totalMessages: 1 }
        },
        { upsert: true }
      );
    }
    
    return updates;
  }
  
  /**
   * 手动添加一条重要记忆
   */
  async addMemory(userId, agentId, content, category = 'general') {
    await UserProfile.findOneAndUpdate(
      { userId, agentId },
      {
        $push: {
          importantMemories: {
            content,
            category,
            createdAt: new Date()
          }
        }
      },
      { upsert: true }
    );
  }
  
  /**
   * 手动设置用户信息
   */
  async setField(userId, agentId, field, value) {
    const allowedFields = [
      'nickname', 'realName', 'gender', 'age', 'birthday', 
      'location', 'occupation', 'relationshipStatus'
    ];
    
    if (!allowedFields.includes(field)) {
      throw new Error(`Field ${field} is not allowed`);
    }
    
    await UserProfile.findOneAndUpdate(
      { userId, agentId },
      { [field]: value },
      { upsert: true }
    );
  }
  
  /**
   * 获取完整用户画像
   */
  async getProfile(userId, agentId) {
    return await UserProfile.findOne({ userId, agentId });
  }
  
  /**
   * 清除用户画像
   */
  async clearProfile(userId, agentId) {
    await UserProfile.deleteOne({ userId, agentId });
  }
}

module.exports = new ProfileService();
