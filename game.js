let currentPlayer = "";
let currentWord = {};
let isBossMode = false;
let bossWordList = [];

const synth = window.speechSynthesis;

// 👇 新增：加權隨機抽題核心函數 👇
function getWeightedRandomItem(list, getWeightFunc) {
    let totalWeight = 0;
    // 1. 計算所有單字的總權重
    for (let item of list) {
        totalWeight += getWeightFunc(item);
    }
    
    // 2. 在總權重範圍內抽取一個隨機數字
    let randomNum = Math.random() * totalWeight;
    let weightSum = 0;
    
    // 3. 依序累加權重，直到超過隨機數字即為抽中該單字
    for (let item of list) {
        weightSum += getWeightFunc(item);
        if (randomNum <= weightSum) {
            return item;
        }
    }
    return list[list.length - 1]; // 備用回傳，防止意外錯誤
}

function startGame() {
    currentPlayer = document.getElementById("playerName").value.trim() || "小勇士";
    document.getElementById("gameArea").style.display = "block";
    document.getElementById("uploadArea").style.display = "block"; 
    updateScoreBoard();
    checkBossAvailable();
    nextQuestion();
}

function getCombinedWordList() {
    let customWords = JSON.parse(localStorage.getItem(`SpellingHero_CustomWords_${currentPlayer}`)) || [];
    
    // 👇 修改：幫自行上傳的自訂單字加上標記，方便後續提高出題權重 👇
    customWords = customWords.map(word => ({ ...word, isCustom: true }));
    
    let fullList = wordList.concat(customWords);
    let start = parseInt(document.getElementById("startIdx").value) || 1;
    let end = parseInt(document.getElementById("endIdx").value) || fullList.length;

    if (start < 1) start = 1;
    if (end > fullList.length) end = fullList.length;
    if (start > end) start = end;

    return fullList.slice(start - 1, end);
}

function nextQuestion() {
    document.getElementById("submitBtn").style.display = "inline-block";
    document.getElementById("nextBtn").style.display = "none";
    document.getElementById("englishInput").disabled = false;
    document.getElementById("englishInput").value = "";
    document.getElementById("feedbackMsg").innerText = "";
    document.getElementById("englishInput").focus();

    if (isBossMode) {
        if (bossWordList.length === 0) {
            alert("🎉 太棒了！魔王被打敗了！你把常錯單字都學會了！");
            isBossMode = false;
            checkBossAvailable();
            nextQuestion();
            return;
        }
        // 👇 修改：魔王模式下，錯誤次數 (count) 越高的單字，出題權重與機率就越大 👇
        currentWord = getWeightedRandomItem(bossWordList, word => word.count);
    } else {
        const combinedList = getCombinedWordList();
        // 👇 修改：一般模式下，自訂單字 (isCustom) 權重為 3 倍，原本的舊單字為 1 倍 👇
        currentWord = getWeightedRandomItem(combinedList, word => word.isCustom ? 3 : 1);
    }

    document.getElementById("chineseHint").innerText = currentWord.chinese;
    
    // 例句挖空處理邏輯
    const sentenceHint = document.getElementById("sentenceHint");
    if (currentWord.sentence) {
        // 取出乾淨的單字用來比對 (過濾 a, an, the, to 跟括號)
        const cleanTarget = currentWord.english.replace(/^(a |an |the |to )/i, '').replace(/\([^)]*\)/g, '').trim();
        // 利用正則表達式，忽略大小寫將句子裡的目標單字挖空
        const regex = new RegExp(cleanTarget, 'gi');
        const blankedSentence = currentWord.sentence.replace(regex, "________");
        
        sentenceHint.innerText = blankedSentence;
        sentenceHint.style.display = "block";
    } else {
        sentenceHint.style.display = "none";
        sentenceHint.innerText = "";
    }

    speakWord(); 
}

function speakWord() {
    if (synth.speaking) { return; }
    let textToSpeak = currentWord.english.replace(/^(a |an |the |to )/i, '').replace(/\([^)]*\)/g, '').trim();
    const utterThis = new SpeechSynthesisUtterance(textToSpeak);
    utterThis.lang = 'en-US'; 
    utterThis.rate = 0.8;     
    synth.speak(utterThis);
}

function checkAnswer() {
    const userInput = document.getElementById("englishInput").value.trim().toLowerCase();
    if (!userInput) return; 

    const correctAnswer = currentWord.english.toLowerCase();
    const correctClean = correctAnswer.replace(/^(a |an |the |to )/i, '').replace(/\([^)]*\)/g, '').trim();

    const feedback = document.getElementById("feedbackMsg");
    let playerRecord = getPlayerRecord();
    let isCorrect = (userInput === correctAnswer || userInput === correctClean);

    if (isCorrect) {
        feedback.innerText = "✨ 答對了！太厲害了！";
        feedback.className = "feedback correct";
        playerRecord.score += 10;
        
        if (playerRecord.mistakes[correctAnswer]) {
            playerRecord.mistakes[correctAnswer].count -= 1;
            if (playerRecord.mistakes[correctAnswer].count <= 0) {
                delete playerRecord.mistakes[correctAnswer]; 
            }
        }
    } else {
        feedback.innerText = `❌ 正確拼法: ${currentWord.english}`;
        feedback.className = "feedback wrong";
        
        if (!playerRecord.mistakes[correctAnswer]) {
            playerRecord.mistakes[correctAnswer] = { ...currentWord, count: 1 };
        } else {
            playerRecord.mistakes[correctAnswer].count += 1;
        }
    }

    // 答題後顯示完整例句，讓小朋友能看著背
    if (currentWord.sentence) {
        document.getElementById("sentenceHint").innerText = currentWord.sentence;
    }

    savePlayerRecord(playerRecord);
    updateScoreBoard();
    checkBossAvailable();

    document.getElementById("englishInput").disabled = true;
    document.getElementById("submitBtn").style.display = "none";

    let autoNext = document.getElementById("autoNext").checked;

    if (autoNext) {
        let delay = isCorrect ? 1500 : 3500;
        setTimeout(() => {
            if(isBossMode) bossWordList = Object.values(getPlayerRecord().mistakes);
            nextQuestion();
        }, delay);
    } else {
        document.getElementById("nextBtn").style.display = "inline-block";
        if(isBossMode) bossWordList = Object.values(getPlayerRecord().mistakes);
    }
}

function handleEnter(event) {
    if (event.key === "Enter") {
        if (document.getElementById("nextBtn").style.display === "inline-block") {
            nextQuestion();
        } else if (document.getElementById("submitBtn").style.display === "inline-block") {
            checkAnswer();
        }
    }
}

function getPlayerRecord() {
    let data = localStorage.getItem(`SpellingHero_${currentPlayer}`);
    return data ? JSON.parse(data) : { score: 0, mistakes: {} };
}
function savePlayerRecord(data) {
    localStorage.setItem(`SpellingHero_${currentPlayer}`, JSON.stringify(data));
}
function updateScoreBoard() { document.getElementById("score").innerText = getPlayerRecord().score; }
function checkBossAvailable() {
    let mistakes = Object.keys(getPlayerRecord().mistakes).length;
    const bossBtn = document.getElementById("bossBtn");
    if (mistakes >= 3 && !isBossMode) {
        bossBtn.style.display = "inline-block";
        bossBtn.innerText = `👿 挑戰魔王 (${mistakes}題)`;
    } else { bossBtn.style.display = "none"; }
}
function startBossBattle() {
    isBossMode = true;
    bossWordList = Object.values(getPlayerRecord().mistakes);
    alert("⚔️ 魔王戰開始！");
    nextQuestion();
}

// 匯出功能
function exportMistakes() {
    let playerRecord = getPlayerRecord();
    let mistakes = Object.values(playerRecord.mistakes);
    if (mistakes.length === 0) { alert("🎉 太棒了！目前沒有常錯單字喔！"); return; }
    
    let csvContent = "\uFEFF英文單字,中文意思,例句,錯誤次數\n";
    mistakes.sort((a, b) => b.count - a.count);
    
    mistakes.forEach(word => {
        let safeEnglish = `"${word.english}"`;
        let safeChinese = `"${word.chinese}"`;
        let safeSentence = word.sentence ? `"${word.sentence}"` : `""`;
        csvContent += `${safeEnglish},${safeChinese},${safeSentence},${word.count}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${currentPlayer}_錯題本.csv`;
    link.click();
}

// 安全的 CSV 解析器，保護句子裡的逗號
function parseCSVRow(str) {
    let arr = [], quote = false, cell = '';
    for (let c = 0; c < str.length; c++) {
        let cc = str[c], nc = str[c+1];
        if (cc === '"' && quote && nc === '"') { cell += '"'; ++c; continue; }
        if (cc === '"') { quote = !quote; continue; }
        if (cc === ',' && !quote) { arr.push(cell); cell = ''; continue; }
        cell += cc;
    }
    if (cell !== undefined) arr.push(cell);
    return arr;
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const rows = text.split('\n');
        let newWords = [];
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;
            
            const cols = parseCSVRow(row);
            if (cols.length >= 2) {
                let eng = cols[0].trim();
                let chi = cols[1].trim();
                let sen = cols[2] ? cols[2].trim() : ""; // 抓取第三欄的例句
                
                if (eng && chi && eng !== "英文單字" && eng !== "english") {
                    newWords.push({ english: eng, chinese: chi, sentence: sen });
                }
            }
        }
        
        if (newWords.length > 0) {
            let existingCustomWords = JSON.parse(localStorage.getItem(`SpellingHero_CustomWords_${currentPlayer}`)) || [];
            existingCustomWords = existingCustomWords.concat(newWords);
            localStorage.setItem(`SpellingHero_CustomWords_${currentPlayer}`, JSON.stringify(existingCustomWords));
            
            document.getElementById("endIdx").value = wordList.length + existingCustomWords.length;
            document.getElementById("uploadStatus").innerText = `✅ 成功為 ${currentPlayer} 擴充 ${newWords.length} 個生字與例句！`;
            event.target.value = ''; 
        } else {
            alert("找不到單字，請確保 CSV 格式第一欄是英文、第二欄是中文！");
        }
    };
    reader.readAsText(file, "UTF-8");
}
