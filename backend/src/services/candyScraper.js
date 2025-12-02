const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const Agent = require('../models/Agent');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI; 
    if (!uri) throw new Error('MONGO_URI not defined in .env');
    await mongoose.connect(uri);
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('DB Connection Error:', err);
    process.exit(1);
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
  
  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // 1. Try Gallery which might have grid layout
    // 2. Try landing page for AI Girlfriend
    const targetUrl = 'https://candy.ai/ai-girlfriend'; 
    console.log(`Navigating to ${targetUrl}...`);
    
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for any images to load
    await new Promise(r => setTimeout(r, 5000));

    const charDataList = await page.evaluate(() => {
        const results = [];
        // Strict filter: Image must be > 200px width/height (likely portrait)
        // AND nearby text must NOT contain UI keywords
        const imgs = Array.from(document.querySelectorAll('img'));
        
        for (const img of imgs) {
            if (img.naturalWidth > 200 && img.naturalHeight > 250) { // Taller than wide often implies portrait
                const src = img.src;
                
                // Heuristic: Check alt text or nearby headings
                let name = img.alt || '';
                
                if (!name || name.length < 3) {
                    // Check siblings/parents for H tags
                    const parent = img.closest('div');
                    if (parent) {
                        const hTag = parent.querySelector('h2, h3, h4, h5');
                        if (hTag) name = hTag.innerText;
                    }
                }
                
                // Description heuristic
                let description = 'AI Companion';
                const parent = img.closest('div');
                if (parent) {
                    const pTag = parent.querySelector('p');
                    if (pTag && pTag.innerText.length > 10) description = pTag.innerText;
                }

                // STRICT FILTERING
                const badKeywords = ['Login', 'Sign', 'Google', 'Discord', 'Twitter', 'Sidebar', 'Audio', 'Candy', 'App', 'Menu'];
                const nameLower = name.toLowerCase();
                
                if (name.length > 2 && name.length < 30 && !badKeywords.some(kw => nameLower.includes(kw.toLowerCase()))) {
                     results.push({ name: name.trim(), img: src, description: description.trim() });
                }
            }
        }
        return results;
    });

    // De-dupe
    const uniqueChars = [];
    const map = new Map();
    for (const item of charDataList) {
        if(!map.has(item.name)){
            map.set(item.name, true);
            uniqueChars.push(item);
        }
    }

    console.log(`Found ${uniqueChars.length} valid candidates.`);

    for (const char of uniqueChars.slice(0, 10)) {
        console.log(`Processing: ${char.name}`);
        
        const exists = await Agent.findOne({ name: char.name });
        if (!exists) {
             const imgExt = 'png';
             const imgName = `candy-${crypto.randomUUID()}.${imgExt}`;
             const uploadDir = path.join(__dirname, '../../uploads');
             const localPath = path.join(uploadDir, imgName);

             if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

             try {
               if (!char.img.startsWith('http')) continue;

               await downloadImage(char.img, localPath);
               const avatarUrl = `/uploads/${imgName}`;

               const newAgent = new Agent({
                  name: char.name,
                  description: char.description,
                  avatarUrl: avatarUrl,
                  gender: 'female', 
                  modelName: 'sao10k/l3.1-euryale-70b',
                  temperature: 0.75,
                  corePrompt: `[Character: ${char.name}]`,
                  systemPrompt: `You are ${char.name}.`
               });
               await newAgent.save();
               console.log(`Saved Agent: ${char.name}`);
             } catch (e) {
               console.error(`Error saving ${char.name}:`, e.message);
             }
        }
    }

  } catch (error) {
    console.error('Scrape Error:', error);
  } finally {
    await browser.close();
    await mongoose.disconnect();
  }
};

scrape();
