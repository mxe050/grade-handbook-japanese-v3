const fs = require('fs');
const path = require('path');

// 1. bmj_summaries.jsonが完了したか確認
let bmjSummaries = {};
if (fs.existsSync('bmj_summaries.json')) {
    try {
        bmjSummaries = JSON.parse(fs.readFileSync('bmj_summaries.json', 'utf8'));
    } catch (e) {
        console.warn("Could not read bmj_summaries.json properly.");
    }
}

// urlのマッピング (bmj_content.json のキーに合わせる)
const bmjMapping = {
    "https://www.bmj.com/content/389/bmj-2024-081903": "1", // Overview (Chapter 1等)
    "https://www.bmj.com/content/389/bmj-2024-081904": "2", // Target and precision (Imprecision) - Chapter 11
    "https://www.bmj.com/content/389/bmj-2024-081905": "3", // Inconsistency - Chapter 10
    "https://www.bmj.com/content/389/bmj-2024-083864": "4", // Risk of bias - Chapter 9
    "https://www.bmj.com/content/389/bmj-2024-083865": "5", // Indirectness - Chapter 13
    "https://www.bmj.com/content/389/bmj-2024-083866": "6", // Summary of findings - Chapter 4, 5
    "https://www.bmj.com/content/389/bmj-2024-083868": "7"  // EtD - Chapter 14, 15
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

// 詳細解説ページにBMJ解説を挿入するマッピング (適当なチャプターに割り当て)
// Target=12(Imprecision), Inconsistency=11(Inconsistency), RoB=10(Risk of bias), Indirectness=9(Indirectness), SoF=4,5, EtD=15
const bmjToChapterUpdate = {
    "https://www.bmj.com/content/389/bmj-2024-081903": [1, 2], // Overview
    "https://www.bmj.com/content/389/bmj-2024-081904": [12], // precision
    "https://www.bmj.com/content/389/bmj-2024-081905": [11], // inconsistency
    "https://www.bmj.com/content/389/bmj-2024-083864": [10], // bias
    "https://www.bmj.com/content/389/bmj-2024-083865": [9, 13], // indirectness
    "https://www.bmj.com/content/389/bmj-2024-083866": [4, 5], // summary of findings
    "https://www.bmj.com/content/389/bmj-2024-083868": [15, 16] // EtD
};

// 詳細HTMLを読み込んでキャッシュ
const detailCache = {};
for (const [chNum, filePath] of Object.entries(chapterFileMap)) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // --- ユーザー要求: 「本文の図が、GRADEBookではありません」 ---
        // ひとまずembedded_img_*.png 等の論文画像と見られるタグを削除する
        content = content.replace(/<img[^>]+src=["']images\/embedded_img_[^>]+>/gi, '<!-- [Removed Non-GRADEBook PDF Image] -->');
        content = content.replace(/<div class="coregrade-figure">[\s\S]*?<\/div>/gi, '<!-- [Removed CoreGRADE PDF Figure Area] -->');
        
        detailCache[chNum] = content;
    } else {
        console.warn('File not found:', filePath);
    }
}

// BMJの内容を各チャプターに追記
for (const [url, bmjData] of Object.entries(bmjSummaries)) {
    const chaptersToUpdate = bmjToChapterUpdate[url];
    if (chaptersToUpdate) {
        for (const chNum of chaptersToUpdate) {
            if (detailCache[chNum]) {
                const appendage = `
<div class="bmj-expert-summary" style="margin-top: 40px; padding: 20px; background-color: #fdfbf7; border-left: 4px solid #d35400; border-radius: 4px;">
    <h3 style="color: #d35400; border-bottom: 1px solid #e1b191; padding-bottom: 10px;">BMJ論文エキスパート解説: ${bmjData.title}</h3>
    <div style="font-size: 0.95em; line-height: 1.8;">
        ${bmjData.summary_html}
    </div>
</div>
                `;
                detailCache[chNum] += appendage;
            }
        }
    }
}

// index.htmlの読み込み
let indexHtml = fs.readFileSync('index.html', 'utf8');

// fetchの置き換え
const inlineJs = `
const detailCache = ${JSON.stringify(detailCache)};

function loadDetailContent(chNum) {
    if (!detailCache[chNum]) {
        document.getElementById('detail-loading-' + chNum).innerHTML = '<p style="color:red;">解説が見つかりません</p>';
        return;
    }
    document.getElementById('detail-content-' + chNum).innerHTML = detailCache[chNum];
    var loadingEl = document.getElementById('detail-loading-' + chNum);
    if(loadingEl) loadingEl.style.display = 'none';

    // 画像クリック対応
    document.getElementById('detail-content-' + chNum).querySelectorAll('img').forEach(function(img) {
      if(!img.classList.contains('no-modal')) {
        img.style.cursor = 'pointer';
        img.addEventListener('click', function() {
          var modal = document.getElementById('imgModal');
          var modalImg = document.getElementById('imgModalImg');
          if(modal && modalImg) {
            modalImg.src = this.src;
            modal.classList.add('show');
          }
        });
      }
    });
}
`;

// index.html 内の `// 詳細解説のfetch読み込み` から `// タブクリック時に詳細解説を読み込む` までの間を置換する
const startMarker = '// 詳細解説のfetch読み込み';
const endMarker = '// タブクリック時に詳細解説を読み込む';
const startIndex = indexHtml.indexOf(startMarker);
const endIndex = indexHtml.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    indexHtml = indexHtml.substring(0, startIndex) + inlineJs + '\n' + indexHtml.substring(endIndex);
    fs.writeFileSync('index.html', indexHtml, 'utf8');
    console.log('Successfully inlined external details into index.html');
} else {
    console.error('Could not find markers to replace fetch logic.');
}
