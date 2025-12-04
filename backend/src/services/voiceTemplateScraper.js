const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const Agent = require('../models/Agent');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

/**
 * 从 Fish Audio URL 提取 Voice ID
 * 支持格式：
 * - https://fish.audio/m/{voiceId}
 * - https://fish.audio/zh-CN/m/{voiceId}
 * - 直接传入 voiceId
 */
const fetchVoiceTemplateMetadata = async (sourceUrl) => {
  if (!sourceUrl) {
    throw new Error('请提供 Fish Audio 链接');
  }

  let voiceId = sourceUrl.trim();

  // 如果是完整URL，提取voiceId
  if (sourceUrl.includes('fish.audio')) {
    // 匹配 /m/{voiceId} 模式
    const match = sourceUrl.match(/\/m\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      voiceId = match[1];
    } else {
      throw new Error('无法从链接中提取 Voice ID，请检查链接格式');
    }
  }

  // 验证 voiceId 格式（应该是 32 位十六进制）
  if (!/^[a-zA-Z0-9]{20,40}$/.test(voiceId)) {
    throw new Error('无效的 Voice ID 格式');
  }

  return { voiceId };
};

module.exports = { fetchVoiceTemplateMetadata };

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Use the same MONGO_URI as your main app
    const uri = process.env.MONGO_URI; 
    if (!uri) throw new Error('MONGO_URI not defined');
    
    // Check state before connecting
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected.');
      return;
    }
    
    await mongoose.connect(uri);
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('DB Connection Error:', err);
    // Do NOT exit process here if running as child process, but return error
    // process.exit(1);
  }
};

const downloadImage = async (url, destPath) => {
  const writer = fs.createWriteStream(destPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

const scrape = async () => {
  await connectDB();
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log('Navigating to Candy.ai...');
    await page.goto('https://candy.ai/discover', { waitUntil: 'networkidle2' });

    await page.waitForSelector('a[href^="/character/"]', { timeout: 10000 });

    const characterLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href^="/character/"]'));
      return anchors.map(a => a.href).slice(0, 5); 
    });

    console.log(`Found ${characterLinks.length} characters to scrape.`);

    for (const link of characterLinks) {
      try {
        console.log(`Scraping ${link}...`);
        await page.goto(link, { waitUntil: 'networkidle2' });

        const charData = await page.evaluate(() => {
          const name = document.querySelector('h1')?.innerText || 'Unknown';
          const description = document.querySelector('p')?.innerText || '';
          const img = document.querySelector('img[alt*="avatar"]')?.src || document.querySelector('img')?.src; 
          
          return { name, description, img };
        });

        if (charData.name !== 'Unknown' && charData.img) {
          const imgExt = charData.img.split('.').pop().split('?')[0] || 'png';
          const imgName = `candy-${crypto.randomUUID()}.${imgExt}`;
          const uploadDir = path.join(__dirname, '../../uploads');
          const localPath = path.join(uploadDir, imgName);

          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
  }

          await downloadImage(charData.img, localPath);
          const avatarUrl = `/uploads/${imgName}`;

          const newAgent = new Agent({
            name: charData.name,
            description: charData.description,
            avatarUrl: avatarUrl,
            gender: 'female',
            modelName: 'grok-4-1-fast-reasoning',
            temperature: 0.7,
            corePrompt: `[Imported from Candy.ai] Character Name: ${charData.name}. Description: ${charData.description}.`,
            systemPrompt: `You are ${charData.name}. ${charData.description}. Roleplay with the user accordingly.`
          });

          await newAgent.save();
          console.log(`Saved agent: ${charData.name}`);
        }

      } catch (err) {
        console.error(`Error scraping ${link}:`, err.message);
}
    }

  } catch (error) {
    console.error('Scraping flow failed:', error);
  } finally {
    await browser.close();
    // CRITICAL FIX: REMOVE DISCONNECT TO PREVENT KILLING MAIN PROCESS CONNECTION
    // await mongoose.disconnect(); 
    console.log('Done.');
  }
};

scrape();
