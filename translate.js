require('dotenv').config();
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Check for API key
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("Error: GEMINI_API_KEY environment variable is not set.");
    console.error("Create a .env file and add your GEMINI_API_KEY.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
// Use a fast and cost-effective model for text translation
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function translateText(text) {
    const prompt = `あなたはプロフェッショナルな医療翻訳者です。以下の医学・ヘルスケア系のガイドライン（GRADEアプローチに関する文章）のテキストを、自然で高品質な日本語に翻訳してください。専門用語は日本の医学系ガイドラインで一般的に使われる用語（例：certainty of evidence -> エビデンスの確実性、risk of bias -> バイアスリスク）に合わせて翻訳してください。

テキスト：
${text}`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (e) {
        console.error("Translation API error:", e);
        return null;
    }
}

async function main() {
    const inputFile = 'scraped_content.json';
    const outputFile = 'translated_content.json';
    
    if (!fs.existsSync(inputFile)) {
        console.error("Input file not found:", inputFile);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
    const translatedData = {};

    const urls = Object.keys(data);
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const pageData = data[url];
        
        console.log(`Processing ${i + 1}/${urls.length}: ${url}`);
        
        if (pageData.error || !pageData.content || pageData.content.includes("Could not fetch data") || pageData.content.trim() === "GRADE Book") {
            console.log(`  Skipping due to error or missing content.`);
            translatedData[url] = { ...pageData, translated_title: "翻訳スキップ", translated_content: "取得エラーのため翻訳スキップ" };
            continue;
        }

        console.log(`  Translating title: ${pageData.title}`);
        const translatedTitle = await translateText(pageData.title);
        
        console.log(`  Translating content... (length: ${pageData.content.length})`);
        
        // 非常に長いコンテンツの場合、分割が必要になる可能性もあるが
        // "gemini-2.5-flash" は非常に大きなコンテキストウィンドウを持つので、今回はそのまま送信
        const translatedContent = await translateText(pageData.content);
        
        if (translatedTitle && translatedContent) {
            translatedData[url] = {
                title: pageData.title,
                content: pageData.content,
                translated_title: translatedTitle.trim(),
                translated_content: translatedContent.trim()
            };
            console.log("  => Translation successful.");
        } else {
            console.log("  => Translation failed.");
            translatedData[url] = pageData; // Keep original on failure
        }
        
        // API rate limit対策（念のため2秒待つ）
        await new Promise(r => setTimeout(r, 2000));
    }

    fs.writeFileSync(outputFile, JSON.stringify(translatedData, null, 2), 'utf-8');
    console.log(`Translation complete. Saved to ${outputFile}`);
}

main();
