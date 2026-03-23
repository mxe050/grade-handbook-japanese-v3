const puppeteer = require('puppeteer');
const fs = require('fs');

const urls = [
  'https://www.bmj.com/content/389/bmj-2024-081903',
  'https://www.bmj.com/content/389/bmj-2024-081904',
  'https://www.bmj.com/content/389/bmj-2024-081905',
  'https://www.bmj.com/content/389/bmj-2024-083864',
  'https://www.bmj.com/content/389/bmj-2024-083865',
  'https://www.bmj.com/content/389/bmj-2024-083866',
  'https://www.bmj.com/content/389/bmj-2024-083867'
];

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    // Bot対策用の簡易ヘッダー
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
    const results = {};
    
    for (const url of urls) {
        console.log("Scraping BMJ: " + url);
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            await new Promise(r => setTimeout(r, 5000));
            // 論文本文を取得
            const content = await page.evaluate(() => {
                const article = document.querySelector('.article') || document.querySelector('#content') || document.body;
                return article.innerText;
            });
            const title = await page.title();
            results[url] = { title, content };
            console.log(`Success: ${title} (length: ${content.length})`);
        } catch (e) {
            results[url] = { error: e.toString() };
            console.error("Error scraping " + url, e);
        }
    }
    fs.writeFileSync('bmj_content.json', JSON.stringify(results, null, 2));
    await browser.close();
    console.log("BMJ Scraping completed.");
})();
