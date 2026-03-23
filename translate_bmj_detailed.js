require('dotenv').config();
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// gemini-2.5-flashが無料枠でクオータ制限になる場合、gemini-1.5-proやgemini-1.5-flashへのフォールバックを利用する。
// 今回は長大なテキストと詳細な推論が必要なため gemini-2.5-flash をメインにし、エラー時はAPI制限を疑い十分にSleepする。
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
// SDKのバージョンによっては 2.5 がサポートされていない場合があるため 1.5-pro-latest を試すのも手だが、前回2.5-flash自体は1度通っている。
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" }); 

async function processDetailedBMJ() {
    const inputFile = 'bmj_content.json';
    const outputFile = 'bmj_summaries_detailed.json';
    
    if (!fs.existsSync(inputFile)) {
        console.error("File not found:", inputFile);
        return;
    }
    
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
    const urls = Object.keys(data);
    let summaries = {};
    if (fs.existsSync(outputFile)) {
        try { summaries = JSON.parse(fs.readFileSync(outputFile, 'utf-8')); } catch(e) {}
    }

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const pageData = data[url];
        
        if (pageData.error || !pageData.content) continue;
        if (summaries[url]) {
            console.log(`Skipping ${url} (Already detailed)`);
            continue;
        }

        console.log(`Generating ULTRA DETAILED summary for BMJ Paper ${i+1}: ${pageData.title.substring(0, 40)}...`);
        
        const prompt = `あなたは世界トップクラスの臨床疫学・GRADEアプローチの専門家であり、ガイドライン作成の指導者です。
以下のテキストはGRADEアプローチの最新版「Core GRADE」シリーズの論文（英語）です。
ユーザー（読者）から、次のような非常に強い要望を受けています。
「このフローチャートの解説を、これだけ読めば実際に評価ができるほど、圧倒的に詳細に記載してください。簡単な記載では不十分です。」

論文本文から、読者が他の一切の資料や原文を読まなくても、**完璧に**実際のGRADE評価（特にフローチャートの各ステップでの判断）を実践できるレベルで、極めて具体的かつ詳細に、網羅的に日本語で解説を作成してください。

【必須要件】
1. **フローチャートと判断アルゴリズムの全ステップの網羅的かつ具体的な解説**: どの段階で、どのような情報を基に、YES/NO（あるいはグレードダウン/アップ）を判断するのかを、論文内のすべての基準・閾値・ルールを含めて漏れなく記述してください。
2. **実践的な具体例の提示**: 論文内で紹介されている事例（COVID-19、敗血症など）だけでなく、評価者が迷いやすいポイント（例：非一貫性と不精確性の境界、間接性の判断基準の違いなど）について、論文の記述に基づいて徹底的に解説してください。
3. **HTML形式での出力**: \`<div class="coregrade-ultra-detail">\`, \`<h3>\`, \`<h4>\`, \`<ul>\`, \`<ol>\`, \`<p>\`, \`<div class="example-box">\` などのHTMLタグを駆使して、視覚的にも読みやすく構造化されたHTMLスニペット（<body>の中身のみ）として出力してください。Markdownのコードブロック記法（\`\`\`html など）は絶対に含めないでください。

論文テキスト（英語）：
${pageData.content}
`;

        let success = false;
        let retryCount = 0;
        // APIレートリミット対策のため、最初から十分な間隔（15秒）をあける
        await new Promise(r => setTimeout(r, 15000));
        
        while (!success && retryCount < 5) {
            try {
                // モデルフォールバック: 2.5-pro がダメなら 1.5-pro に下げる
                let currentModel = retryCount < 2 ? model : genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
                
                const result = await currentModel.generateContent(prompt);
                let text = result.response.text().trim();
                text = text.replace(/^```html\n?/i, '').replace(/```$/i, '').trim();
                
                summaries[url] = {
                    title: pageData.title,
                    summary_html: text
                };
                console.log(` => Success! Length: ${text.length} chars`);
                fs.writeFileSync(outputFile, JSON.stringify(summaries, null, 2), 'utf-8');
                success = true;
                // 次のAPIコールまでに60秒待機してQuotaを回復させる
                console.log("Waiting 60s for rate limit safety...");
                await new Promise(r => setTimeout(r, 60000));
            } catch (e) {
                console.error(` => Error (Attempt ${retryCount + 1}):`, e.message);
                if (e.message.includes('429') || e.message.includes('Quota') || e.message.includes('exhausted')) {
                const waitTime = 120000 + (retryCount * 60000); // 2分〜待機
                console.log("Quota hit. Waiting " + (waitTime/1000) + " seconds...");
                await new Promise(r => setTimeout(r, waitTime));
                retryCount++;
                } else if (e.message.includes('not found') || e.message.includes('supported for generateContent')) {
                    console.log("Model not supported, switching model on next retry...");
                    retryCount++;
                } else {
                    console.error("Unknown API error, breaking.");
                    break;
                }
            }
        }
    }
    console.log('Finished comprehensive ultra-detailed processing.');
}

processDetailedBMJ();
