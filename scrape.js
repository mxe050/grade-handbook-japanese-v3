const puppeteer = require('puppeteer');
const fs = require('fs');

const urls = [
  'https://book.gradepro.org/guideline/overview-of-the-grade-approach',
  'https://book.gradepro.org/guideline/the-development-methods-of-grade',
  'https://book.gradepro.org/guideline/requirements-for-claiming-the-use-of-grade',
  'https://book.gradepro.org/guideline/questions',
  'https://book.gradepro.org/guideline/outcomes',
  'https://book.gradepro.org/guideline/principles',
  'https://book.gradepro.org/guideline/risk-of-bias',
  'https://book.gradepro.org/guideline/inconsistency',
  'https://book.gradepro.org/guideline/indirectness',
  'https://book.gradepro.org/guideline/imprecision',
  'https://book.gradepro.org/guideline/dissemination-bias',
  'https://book.gradepro.org/guideline/introduction-to-the-evidence-to-decision-frameworks',
  'https://book.gradepro.org/guideline/grade-recommendations'
];

(async () => {
    let browser;
    try {
        browser = await puppeteer.launch();
    } catch (e) {
        console.log("Puppeteer launch failed, maybe we need to install it first.");
        process.exit(1);
    }
    const page = await browser.newPage();
    const results = {};
    for (const url of urls) {
        console.log("Scraping " + url);
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            // SPAコンテンツのレンダリングを確実に待つため、追加で待機する
            await new Promise(r => setTimeout(r, 5000));
            
            const content = await page.evaluate(() => {
                // メインコンテンツが含まれる可能性が高い要素を優先的に取得
                const mainEl = document.querySelector('main') || document.querySelector('article') || document.querySelector('.content');
                return mainEl ? mainEl.innerText : document.body.innerText;
            });
            const title = await page.title();
            results[url] = { title, content };
        } catch (e) {
            results[url] = { error: e.toString() };
            console.error("Error scraping " + url, e);
        }
    }
    fs.writeFileSync('scraped_content.json', JSON.stringify(results, null, 2));
    await browser.close();
    console.log("Scraping completed.");
})();
