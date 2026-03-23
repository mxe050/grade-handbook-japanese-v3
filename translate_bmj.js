require('dotenv').config();
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is missing in .env");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function processBMJ() {
    const inputFile = 'bmj_content.json';
    const outputFile = 'bmj_summaries.json';
    
    if (!fs.existsSync(inputFile)) {
        console.error("File not found:", inputFile);
        return;
    }
    
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
    const urls = Object.keys(data);
    
    let summaries = {};
    if (fs.existsSync(outputFile)) {
        try {
            summaries = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
        } catch(e) {}
    }

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const pageData = data[url];
        
        if (pageData.error || !pageData.content) {
            console.log(`Skipping ${url} due to error`);
            continue;
        }

        if (summaries[url]) {
            console.log(`Skipping ${url} as it is already summarized`);
            continue;
        }

        console.log(`Analyzing BMJ Paper ${i+1}: ${pageData.title.substring(0, 50)}...`);
        
        const prompt = `あなたはプロフェッショナルな臨床疫学・ガイドライン作成のエキスパートです。
以下のテキストは、GRADEアプローチの最新版である「Core GRADE」シリーズの論文（英語）です。
読者はこの論文の解説だけを読んで、自身でGRADE評価（特にフローチャートを用いたステップバイステップの判断）を行えるようにしたいと考えています。

論文の本文から内容を抽出し、以下の要件を満たす充実した日本語の解説を作成してください：
1. **フローチャート・アルゴリズムの徹底解説**: 論文内にあるフローチャートや判断アルゴリズムのステップを1つずつ詳細に解説し、具体的にどう判断すればよいか（どういう場合にグレードダウンするか等）を明確にしてください。
2. **実践で使えるレベルの具体例**: 論文で挙げられている具体例を交え、読者が評価に迷わないようにしてください。
3. **HTML形式での出力**: \`<div>\`, \`<h3>\`, \`<h4>\`, \`<ul>\`, \`<p>\`, \`<strong>\` などのHTMLタグを使って、読みやすく構造化されたHTMLスニペット（<body>タグの中身だけ）として出力してください。Markdownのコードブロック（\`\`\`html ... \`\`\`）は除外して、HTMLタグから直接始めてください。

論文テキスト（英語）：
${pageData.content}
`;
        
        let success = false;
        let retryCount = 0;
        
        while (!success && retryCount < 3) {
            try {
                const result = await model.generateContent(prompt);
                let text = result.response.text().trim();
                // Markdownの \`\`\`html ... \`\`\` を除去
                text = text.replace(/^```html\n?/i, '').replace(/```$/i, '').trim();
                summaries[url] = {
                    title: pageData.title,
                    summary_html: text
                };
                console.log(" => Success");
                // 中間保存
                fs.writeFileSync(outputFile, JSON.stringify(summaries, null, 2), 'utf-8');
                success = true;
            } catch (e) {
                console.error(` => Error (Attempt ${retryCount + 1}):`, e.message);
                if (e.message.includes('429') || e.message.includes('exhausted') || e.message.includes('retry')) {
                    console.log("Rate limit hit, waiting 60 seconds before retrying...");
                    await new Promise(r => setTimeout(r, 60000));
                    retryCount++;
                } else {
                    break; // その他のエラーは抜ける
                }
            }
        }
        
        if (success) {
            // 成功後も念のため20秒待機
            await new Promise(r => setTimeout(r, 20000));
        }
    }
    
    console.log(`Finished processing. Summaries saved to ${outputFile}`);
}

processBMJ();
