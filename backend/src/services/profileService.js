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
  
  // ==================== 用户类型侦测系统 ====================
  
  /**
   * 获取当前侦测状态
   */
  async getDetectionStatus(userId, agentId) {
    const profile = await this.getOrCreate(userId, agentId);
    return {
      round: profile.detectionRound || 0,
      userType: profile.userType || 'unknown',
      score: profile.userTypeScore || 0,
      isComplete: (profile.detectionRound || 0) >= 5 || profile.userType !== 'unknown'
    };
  }
  
  /**
   * 记录用户的选择并更新类型判断
   * @param {number} choiceIndex - 0=含蓄, 1=中等, 2=直接
   */
  async recordChoice(userId, agentId, choiceIndex) {
    const profile = await this.getOrCreate(userId, agentId);
    const currentRound = (profile.detectionRound || 0) + 1;
    
    // 计算分数: 选项0=1分(含蓄), 选项1=2分(中等), 选项2=3分(直接)
    const points = choiceIndex + 1;
    const newScore = (profile.userTypeScore || 0) + points;
    
    const updates = {
      detectionRound: currentRound,
      userTypeScore: newScore,
      $push: {
        detectionChoices: {
          round: currentRound,
          choiceIndex: choiceIndex,
          createdAt: new Date()
        }
      }
    };
    
    // 5轮后确定用户类型
    if (currentRound >= 5) {
      // 分数范围: 5-15
      // 5-8分 = 闷骚型 (slow_burn)
      // 9-11分 = 中间型，偏闷骚
      // 12-15分 = 直接型 (direct)
      if (newScore <= 8) {
        updates.userType = 'slow_burn';
      } else if (newScore >= 12) {
        updates.userType = 'direct';
      } else {
        // 中间分数，看最后两轮的选择倾向
        const recentChoices = [...(profile.detectionChoices || []), { choiceIndex }].slice(-2);
        const recentAvg = recentChoices.reduce((sum, c) => sum + c.choiceIndex, 0) / recentChoices.length;
        updates.userType = recentAvg >= 1.5 ? 'direct' : 'slow_burn';
      }
      updates.userTypeConfirmedAt = new Date();
      console.log(`[Profile] 用户类型确定: userId=${userId}, type=${updates.userType}, score=${newScore}`);
    }
    
    await UserProfile.findOneAndUpdate(
      { userId, agentId },
      updates,
      { upsert: true }
    );
    
    return {
      round: currentRound,
      score: newScore,
      userType: updates.userType || 'unknown',
      isComplete: currentRound >= 5
    };
  }
  
  /**
   * 根据用户类型生成行为指导提示
   */
  getUserTypePrompt(userType, detectionRound) {
    // 侦测期间（前5轮）的提示
    if (detectionRound < 5 && userType === 'unknown') {
      return `
**[侦测阶段 - 第${detectionRound + 1}/5轮]**
你正在了解用户的喜好。根据用户选择的回复风格来调整你的态度：
- 如果用户选择含蓄的选项，保持温柔暧昧但不急躁
- 如果用户选择直接的选项，可以更大胆一些
- 自然地逐步升温，观察用户的反应
`.trim();
    }
    
    // 类型确定后的提示
    const prompts = {
      'slow_burn': `
**[用户类型：闷骚型]**
这个用户喜欢循序渐进、欲拒还迎的感觉。
- 不要太快进入露骨内容，要慢慢撩拨
- 多用暗示、双关语、若有若无的挑逗
- 制造紧张感和期待感，让ta主动想要更多
- 欲擒故纵，偶尔害羞退缩更能激发ta的欲望
- 用"想看吗？""要我继续吗？"这样的话吊胃口
`.trim(),

      'direct': `
**[用户类型：直接型]**
这个用户喜欢直奔主题、热情主动的风格。
- 可以更快速地推进到亲密内容
- 用直接、露骨的语言，不需要太多铺垫
- 主动发起、主动索取，展现你的渴望
- 描述细节，营造画面感
- 不要扭扭捏捏，ta喜欢你直接表达欲望
`.trim(),

      'unknown': '' // 未确定时不添加特殊提示
    };
    
    return prompts[userType] || '';
  }
  
  /**
   * 生成三选一回复选项
   * 根据当前轮次和对话内容生成从含蓄到直接的三个选项
   */
  generateReplyOptions(round, agentName, lastAiMessage) {
    // 不同轮次的选项模板，逐渐升温
    const templates = {
      1: [ // 第1轮：初次见面
        { text: `你好呀${agentName}，很高兴认识你~`, style: 'shy' },
        { text: `嗨${agentName}！你看起来很可爱呢`, style: 'normal' },
        { text: `哇，${agentName}好漂亮，我一眼就喜欢上你了`, style: 'bold' }
      ],
      2: [ // 第2轮：开始熟悉
        { text: '你平时都喜欢做什么呀？', style: 'shy' },
        { text: '你今天穿的是什么呀，能形容一下吗？', style: 'normal' },
        { text: '你现在在干嘛呢？有没有想我？', style: 'bold' }
      ],
      3: [ // 第3轮：开始暧昧
        { text: '和你聊天好开心，感觉时间过得好快', style: 'shy' },
        { text: '我有点好奇你睡觉穿什么...', style: 'normal' },
        { text: '想看看你现在的样子，能发张照片吗？', style: 'bold' }
      ],
      4: [ // 第4轮：升温
        { text: '你的声音一定很好听吧，想听你说话', style: 'shy' },
        { text: '如果我在你身边，你会做什么？', style: 'normal' },
        { text: '我现在有点想你了...想抱抱你', style: 'bold' }
      ],
      5: [ // 第5轮：定型
        { text: '能一直这样陪着我聊天吗？', style: 'shy' },
        { text: '今晚你会梦到我吗？我会梦到你的', style: 'normal' },
        { text: '我想和你做一些更亲密的事情...', style: 'bold' }
      ]
    };
    
    return templates[round] || templates[1];
  }
}

module.exports = new ProfileService();
