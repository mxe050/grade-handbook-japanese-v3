const fs = require('fs');
const path = require('path');

// 1. 画像のマッピングを読み込む
const mappingFile = 'official_images_mapping.json';
if (!fs.existsSync(mappingFile)) {
    console.error('Image mapping json not found.');
    process.exit(1);
}
const imgMapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));

// 2. URLのパス(pageKey)と、関連するチャプター(1〜16)の大まかな対応付け
// "overview-of-the-grade-approach" -> chapter 1, 2
// "the-development-methods-of-grade" -> chapter 1, 2
// "requirements-for-claiming-the-use-of-grade" -> chapter 1
// "questions-about-interventions-diagnostic-test-prognosis-and-exposures" -> chapter 3
// "outcomes" -> chapter 4, 5
// "principles-for-assessing-the-certainty-of-interventions" -> chapter 8
// "risk-of-bias-randomized-trials" -> chapter 9
// "inconsistency" -> chapter 10
// "indirectness" -> chapter 13
// "imprecision" -> chapter 12
// "dissemination-bias" -> chapter 11
// "introduction-to-the-evidence-to-decision-frameworks" -> chapter 14, 15
// "grade-recommendations" -> chapter 15, 16
const keyToChapter = {
    "overview-of-the-grade-approach": [1, 2],
    "the-development-methods-of-grade": [1, 2],
    "requirements-for-claiming-the-use-of-grade": [1],
    "questions-about-interventions-diagnostic-test-prognosis-and-exposures": [3],
    "outcomes": [4, 5],
    "principles-for-assessing-the-certainty-of-interventions": [8],
    "risk-of-bias-randomized-trials": [10],
    "inconsistency": [11],
    "indirectness": [9, 13],
    "imprecision": [12],
    "dissemination-bias": [12], // 仮
    "introduction-to-the-evidence-to-decision-frameworks": [14, 15],
    "grade-recommendations": [15, 16]
};

// chapterファイルマップ
const chapterFileMap = {
  1: 'chapters/chapter_1_detailed_new.html',
  2: 'chapters/chapter_2_detailed_new.html',
  3: 'chapters/chapter_3_detailed_new.html',
  4: 'chapters/chapter_4_detailed.html',
  5: 'chapters/chapter_5_detailed.html',
  6: 'chapters/chapter_6_detailed.html',
  7: 'chapters/chapter_7_detailed.html',
  8: 'chapters/chapter_8_detailed.html',
  9: 'chapters/chapter_indirectness_detailed.html',
  10: 'chapters/chapter_9_detailed.html',
  11: 'chapters/chapter_10_detailed.html',
  12: 'chapters/chapter_11_detailed.html',
  13: 'chapters/chapter_12_detailed.html',
  14: 'chapters/chapter_13_detailed.html',
  15: 'chapters/chapter_14_detailed.html',
  16: 'chapters/chapter_15_detailed.html'
};

// 3. 各チャプターファイルに対して画像を挿入する
for (const [pageKey, chapters] of Object.entries(keyToChapter)) {
    const images = imgMapping[pageKey] || [];
    if (images.length === 0) continue;
    
    // 画像HTMLスニペットを生成
    let imagesHtml = '<div class="official-grade-images" style="margin-top: 30px; border-top: 2px solid #3498db; padding-top: 20px;">';
    imagesHtml += `<h4 style="color: #2980b9;">GRADEBook 公式図表 (${pageKey.replace(/-/g, ' ')})</h4>`;
    
    images.forEach(img => {
        // パスを /images/official/ にする
        imagesHtml += `
            <div style="margin-bottom: 20px; text-align: center;">
                <img src="${img.localPath}" alt="${img.caption.replace(/"/g, '&quot;')}" style="max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px;" class="no-modal">
                <p style="font-size: 0.85em; color: #555; margin-top: 8px;">${img.caption}</p>
            </div>
        `;
    });
    imagesHtml += '</div>';

    // 対象チャプターに追記
    for (const chNum of chapters) {
        const filePath = chapterFileMap[chNum];
        if (filePath && fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            // 同じURLの画像が二重に入らないようにする
            if (!content.includes(`(${pageKey.replace(/-/g, ' ')})`)) {
                content += '\n' + imagesHtml;
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Inserted images into ${filePath} for key: ${pageKey}`);
            }
        }
    }
}
console.log('Finished inserting official images into chapter files.');
