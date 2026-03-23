const fs = require('fs');
const path = require('path');

const inputFile = 'translated_content.json';
const outputDir = 'dist';

if (!fs.existsSync(inputFile)) {
    console.error("Input file not found:", inputFile);
    process.exit(1);
}

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
const urls = Object.keys(data);

// ナビゲーションリンク用オブジェクト作成
const navLinks = urls.map(url => {
    const slug = url.split('/').pop();
    const pageData = data[url];
    return {
        slug: `${slug}.html`,
        originalTitle: pageData.title,
        title: pageData.translated_title || pageData.title || slug
    };
});

function generateSidebar(currentSlug) {
    let linksHtml = navLinks.map(link => {
        const isActive = link.slug === currentSlug ? 'class="active"' : '';
        return `<li><a href="${link.slug}" ${isActive}>${link.title}</a></li>`;
    }).join('\n        ');

    return `
    <nav class="sidebar">
      <h2>GRADE Handbook</h2>
      <ul>
        ${linksHtml}
      </ul>
    </nav>
    `;
}

function generateHtml(slug, title, originalContent, translatedContent) {
    const isErrorOrSkip = (translatedContent === "取得エラーのため翻訳スキップ" || translatedContent === "GRADE Book" || !translatedContent);
    
    // Markdownを簡易的にHTMLに変換（改行を<br>、見出しを<h3>などに）
    // 本格的な変換はmarked等のライブラリが必要ですが今回は簡易的に
    const formattedContent = isErrorOrSkip 
        ? `<p class="error">このページは取得できませんでした。後ほど手動で追加してください。</p><pre>${originalContent}</pre>`
        : translatedContent.split('\n').map(line => {
             if(line.startsWith('## ')) return `<h3>${line.substring(3)}</h3>`;
             if(line.startsWith('# ')) return `<h2>${line.substring(2)}</h2>`;
             return `<p>${line}</p>`;
          }).join('\n');

    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | GRADE Handbook (日本語版)</title>
    <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; display: flex; color: #333; }
        .sidebar { width: 300px; background-color: #f4f4f4; padding: 20px; height: 100vh; overflow-y: auto; box-sizing: border-box; flex-shrink: 0; }
        .sidebar h2 { font-size: 1.2rem; margin-top: 0; }
        .sidebar ul { list-style: none; padding: 0; }
        .sidebar li { margin-bottom: 10px; }
        .sidebar a { text-decoration: none; color: #0056b3; font-size: 0.95rem; }
        .sidebar a:hover { text-decoration: underline; }
        .sidebar a.active { font-weight: bold; color: #000; }
        .content { flex-grow: 1; padding: 40px; max-width: 800px; overflow-y: auto; height: 100vh; box-sizing: border-box; }
        h1 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        p { margin-bottom: 1em; }
        .error { color: red; font-weight: bold; }
        @media (max-width: 768px) {
            body { flex-direction: column; }
            .sidebar { width: 100%; height: auto; }
            .content { height: auto; }
        }
    </style>
</head>
<body>
    ${generateSidebar(slug)}
    <main class="content">
        <h1>${title}</h1>
        ${formattedContent}
    </main>
</body>
</html>`;
}

// 各ページのHTMLを生成して保存
navLinks.forEach(link => {
    const originalUrl = urls.find(u => u.endsWith(link.slug.replace('.html', '')));
    const pageData = data[originalUrl];
    
    const htmlContent = generateHtml(
        link.slug, 
        link.title, 
        pageData.content, 
        pageData.translated_content
    );
    
    fs.writeFileSync(path.join(outputDir, link.slug), htmlContent, 'utf-8');
    console.log(`Generated: ${link.slug}`);
});

// index.html も一番最初のページにリダイレクトさせる等で作っておく
if(navLinks.length > 0) {
    const indexHtml = `<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="refresh" content="0; url=${navLinks[0].slug}">
    <title>Redirecting...</title>
</head>
<body>
    <p><a href="${navLinks[0].slug}">Redirecting to Introduction...</a></p>
</body>
</html>`;
    fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml, 'utf-8');
    console.log("Generated: index.html (Redirect)");
}

console.log("Build complete. Output generated in 'dist' directory.");
