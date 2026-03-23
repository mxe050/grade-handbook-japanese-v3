const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

const urls = [
  "https://book.gradepro.org/guideline/overview-of-the-grade-approach",
  "https://book.gradepro.org/guideline/the-development-methods-of-grade",
  "https://book.gradepro.org/guideline/requirements-for-claiming-the-use-of-grade",
  "https://book.gradepro.org/guideline/questions-about-interventions-diagnostic-test-prognosis-and-exposures",
  "https://book.gradepro.org/guideline/outcomes",
  "https://book.gradepro.org/guideline/principles-for-assessing-the-certainty-of-interventions",
  "https://book.gradepro.org/guideline/risk-of-bias-randomized-trials",
  "https://book.gradepro.org/guideline/inconsistency",
  "https://book.gradepro.org/guideline/indirectness",
  "https://book.gradepro.org/guideline/imprecision",
  "https://book.gradepro.org/guideline/dissemination-bias",
  "https://book.gradepro.org/guideline/introduction-to-the-evidence-to-decision-frameworks",
  "https://book.gradepro.org/guideline/grade-recommendations"
];

const imageDir = path.join(__dirname, 'images', 'official');
if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
}

function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        if (url.startsWith('//')) {
            url = 'https:' + url;
        } else if (url.startsWith('/')) {
            url = 'https://book.gradepro.org' + url;
        }

        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode >= 300) {
                file.close();
                fs.unlink(dest, () => {});
                resolve(false);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(true);
            });
        }).on('error', (err) => {
            file.close();
            fs.unlink(dest, () => {});
            resolve(false);
        });
    });
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    let imgMapping = {};

    for (let i = 0; i < urls.length; i++) {
        const targetUrl = urls[i];
        console.log(`Scraping images from: ${targetUrl}`);
        
        try {
            await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            await new Promise(r => setTimeout(r, 5000));
            
            const imagesInfo = await page.evaluate(() => {
                const imgElements = Array.from(document.querySelectorAll('img'));
                return imgElements.map(img => {
                    let caption = img.alt || "";
                    let p = img.closest('figure');
                    if(p) {
                        let figcap = p.querySelector('figcaption');
                        if (figcap) caption = figcap.innerText;
                    }
                    return { src: img.src, caption: caption, class: img.className };
                });
            });

            console.log(`Found ${imagesInfo.length} images on page.`);
            const pageKey = targetUrl.split('/').pop();
            imgMapping[pageKey] = [];

            for (let j = 0; j < imagesInfo.length; j++) {
                let imgInfo = imagesInfo[j];
                let imgUrl = imgInfo.src;
                
                if (!imgUrl) continue;
                if (imgUrl.includes('logo') || imgUrl.includes('avatar') || imgUrl.includes('icon')) continue;
                if (imgInfo.class && (imgInfo.class.includes('separator') || imgInfo.class.includes('ProseMirror'))) continue;

                let fileName = `${pageKey}-${j}.png`;
                let destPath = path.join(imageDir, fileName);
                
                let success = false;
                if (imgUrl.startsWith('data:image')) {
                    const base64Data = imgUrl.replace(/^data:image\/\w+;base64,/, "");
                    const buffer = Buffer.from(base64Data, 'base64');
                    fs.writeFileSync(destPath, buffer);
                    success = true;
                } else if (!imgUrl.startsWith('data:')) {
                    success = await downloadImage(imgUrl, destPath);
                }
                
                if (success) {
                    imgMapping[pageKey].push({
                        localPath: `images/official/${fileName}`,
                        caption: imgInfo.caption,
                        originalSrc: imgUrl.startsWith('data:') ? 'base64_data' : imgUrl
                    });
                    console.log(` -> Saved: ${fileName}`);
                }
            }
            // 少し待機
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.error(`Failed to process ${targetUrl}:`, e.message);
        }
    }

    fs.writeFileSync('official_images_mapping.json', JSON.stringify(imgMapping, null, 2), 'utf8');
    console.log('Finished downloading all official images.');
    await browser.close();
})();
