// ─────────────────────────────────────────────────────────────
// 1. 定数定義
// ─────────────────────────────────────────────────────────────

// シフトごとの開始・終了時刻（JavaScript 版）
const SHIFT_TIMES = {
  X: { start: '09:00', end: '10:30' },
  Y: { start: '10:35', end: '12:05' },
  Z: { start: '12:10', end: '13:40' },
  A: { start: '14:55', end: '16:25' },
  B: { start: '16:30', end: '18:00' },
  C: { start: '18:05', end: '19:35' },
  D: { start: '19:40', end: '21:10' },
};

// シフト種類
const SHIFTS_MAIN = ['A', 'B', 'C', 'D'];
const SHIFTS_EXTRA = ['X', 'Y', 'Z'];
let showXYZ = false;

// OAuth 用
let accessToken = null;
let tokenClient = null;

// 画像解析の一時結果（確認用）
let pendingAnalysisResult = null;

// Gemini API 設定（Google Apps Script経由でAPIキーを安全に管理）
// APIキーはGASのスクリプトプロパティで管理されているため、クライアント側には露出しません
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwHM9XoghZjKHjBlmt_vwEE6IKgJRRXLn8JEdK_l9NmkOv-g9QH5evw7zp0DX_Q6oo8/exec';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_API_MODEL = 'gemini-2.5-flash';

// デバッグ用:コンソールに設定を出力
console.log('🔧 Gemini API Configuration loaded:');
console.log('  Model:', GEMINI_API_MODEL);
console.log('  GAS Endpoint:', GAS_ENDPOINT);
console.log('  Security: API key managed by GAS Script Properties');

// ページ読み込み時に一度だけ実行
window.onload = () => {
  // 1) OAuth クライアントを初期化
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: '522781888329-7tte6vtlcea2u3bbn4shd1tivl2u451n.apps.googleusercontent.com',
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar',
    callback: (tokenResponse) => {
      accessToken = tokenResponse.access_token;
      // トークン取得後、シフト登録を続行
      submitData();
    }
  });

  // 2) カレンダー描画用の初期化
  generateMonthOptions();
  generateCalendar();
  document.getElementById('monthSelector').addEventListener('change', generateCalendar);
};


// ─────────────────────────────────────────────────────────────
// 2. ボタン押下時のハンドラ
// ─────────────────────────────────────────────────────────────
function onShiftSubmitButtonClick() {
  if (!accessToken) {
    // 未ログインなら OAuth ポップアップを出す
    tokenClient.requestAccessToken();
  } else {
    // すでにトークンを持っていればそのままシフト登録を行う
    submitData();
  }
}


// ─────────────────────────────────────────────────────────────
// 3. Google Calendar API でイベントを作成する関数
// ─────────────────────────────────────────────────────────────
function addCalendarEvent(title, startDateTime, endDateTime) {
  fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      summary: title,
      start: { dateTime: startDateTime, timeZone: "Asia/Tokyo" },
      end: { dateTime: endDateTime, timeZone: "Asia/Tokyo" }
    })
  })
    .then(response => response.json())
    .then(data => {
      console.log("Event created:", data);
    })
    .catch(error => {
      console.error("Error creating event:", error);
    });
}


// ─────────────────────────────────────────────────────────────
// 4. シフト登録処理（submitData）
// ─────────────────────────────────────────────────────────────
function submitData() {
  // ① ボタン・処理中メッセージを切り替え
  const submitBtn = document.getElementById('submitBtn');
  const loadingDiv = document.getElementById('loading');
  submitBtn.disabled = true;
  submitBtn.innerText = '処理中...';
  loadingDiv.style.display = 'block';

  // ② 入力値を収集して entries 配列を作成
  const title = document.getElementById('title').value || '明光義塾勤務';
  const selected = document.getElementById('monthSelector').value;
  const [year, month] = selected.split('-').map(Number);
  const entries = [];
  const date = new Date(year, month - 1, 1);

  while (date.getMonth() === month - 1) {
    const dateStr = date.toISOString().split('T')[0];
    const shifts = getAllShifts().filter(shift => {
      const id = `${dateStr}-${shift}`;
      return document.getElementById(id)?.checked;
    });
    if (shifts.length > 0) {
      entries.push({ date: dateStr, shifts });
    }
    date.setDate(date.getDate() + 1);
  }

  // ③ カレンダーにイベントを順番に登録
  entries.forEach(entry => {
    entry.shifts.forEach(shift => {
      const shiftInfo = SHIFT_TIMES[shift];
      if (!shiftInfo) return;

      const startDateTime = `${entry.date}T${shiftInfo.start}:00+09:00`;
      const endDateTime = `${entry.date}T${shiftInfo.end}:00+09:00`;
      addCalendarEvent(title, startDateTime, endDateTime);
    });
  });

  // ④ 登録後、UIを戻す
  setTimeout(() => {
    // ネットワーク通信のタイムラグを考慮し、簡易的に1秒後に戻す例
    submitBtn.disabled = false;
    submitBtn.innerText = 'シフトを登録';
    loadingDiv.style.display = 'none';
    alert('登録完了しました');
  }, 1000);
}


// ─────────────────────────────────────────────────────────────
// 5. カレンダー描画部分（generateMonthOptions, generateCalendar, toggleXYZ など）
// ─────────────────────────────────────────────────────────────

// 月の選択肢を生成（今月〜3ヶ月後）
function generateMonthOptions() {
  const selector = document.getElementById('monthSelector');
  const now = new Date();
  for (let i = -1; i < 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const month = date.getMonth() + 1;
    const option = document.createElement('option');
    option.value = `${date.getFullYear()}-${String(month).padStart(2, '0')}`;
    option.text = `${date.getFullYear()}年${month}月`;
    selector.appendChild(option);
  }
  selector.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// 曜日を返す関数
function getDayOfWeek(date) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
}

// シフト種類の取得（順序を一元管理）
function getAllShifts() {
  return showXYZ ? [...SHIFTS_EXTRA, ...SHIFTS_MAIN] : SHIFTS_MAIN;
}

// UTCを使わず、日本時間で文字列を生成する関数
function formatDateLocal(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// カレンダーを生成
function generateCalendar() {
  const calendar = document.getElementById('calendar');
  calendar.innerHTML = '';
  const selected = document.getElementById('monthSelector').value;
  if (!selected) return;

  const [year, month] = selected.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  while (date.getMonth() === month - 1) {
    const dateStr = formatDateLocal(date);
    const displayDate = `${date.getMonth() + 1}/${date.getDate()}（${getDayOfWeek(date)}）`;
    const div = document.createElement('div');
    div.className = 'day';
    div.innerHTML = `<strong>${displayDate}</strong>`;
    const shiftContainer = document.createElement('div');
    shiftContainer.className = 'shift-select';

    const allShifts = getAllShifts();
    allShifts.forEach(shift => {
      const id = `${dateStr}-${shift}`;
      const label = document.createElement('label');
      label.className = 'shift-btn';
      label.innerHTML = `
        <input type="checkbox" id="${id}" onchange="this.parentElement.classList.toggle('active')">${shift}
      `;
      shiftContainer.appendChild(label);
    });

    div.appendChild(shiftContainer);
    calendar.appendChild(div);
    date.setDate(date.getDate() + 1);
  }

  /*
// ✅ fetchでPOSTリクエスト送信
    fetch(WebApp_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: JSON.stringify({ title, entries })
    })
    .then(response => {
        console.log("HTTP status:", response.status);  // ←★追加
        return response.text();
    })
    .then(result => {
        console.log("サーバーからのレスポンス:", result);  // ←★追加
        alert('登録完了しました');
    })
    .catch(err => {
        console.error("fetch失敗:", err);  // ←★追加
        alert('登録に失敗しました: ' + err);
    });
    */
}

// XYZの表示切替
function toggleXYZ() {
  showXYZ = !showXYZ;
  document.getElementById('toggleXYZ').innerText = showXYZ ? 'X, Y, Z コマを非表示にする' : 'X, Y, Z コマを表示する';
  generateCalendar();
}


// ─────────────────────────────────────────────────────────────
// 6. 画像解析機能（Gemini API 連携）
// ─────────────────────────────────────────────────────────────

/**
 * 画像ファイルを Base64 エンコードする
 */
function encodeImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // data:image/png;base64,... の形式から base64 部分のみを抽出
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 解析結果を確認UIに表示する
 */
function renderAnalysisReview(analysisResult) {
  const review = document.getElementById('analysisReview');
  const summary = document.getElementById('analysisSummary');
  const list = document.getElementById('analysisList');

  if (!review || !summary || !list) return;

  if (!Array.isArray(analysisResult) || analysisResult.length === 0) {
    summary.textContent = '抽出結果が見つかりませんでした。画像を見直して再試行してください。';
    list.innerHTML = '';
    review.classList.remove('hidden');
    return;
  }

  const totalShifts = analysisResult.reduce((sum, item) => {
    if (!item || !Array.isArray(item.shifts)) return sum;
    return sum + item.shifts.length;
  }, 0);

  summary.textContent = `抽出日数: ${analysisResult.length}日 / 合計シフト: ${totalShifts}件`;

  const sorted = [...analysisResult].sort((a, b) => (a.day || 0) - (b.day || 0));
  list.innerHTML = '';

  sorted.forEach(item => {
    const day = item.day ?? '-';
    const shifts = Array.isArray(item.shifts) && item.shifts.length > 0
      ? item.shifts.join(', ')
      : '—';

    const div = document.createElement('div');
    div.className = 'analysis-item';
    div.innerHTML = `
      <span class="analysis-day">${day}日</span>
      <span class="analysis-shifts">${shifts}</span>
    `;
    list.appendChild(div);
  });

  review.classList.remove('hidden');
}

/**
 * 確認済みの解析結果を反映する
 */
function applyPendingAnalysis() {
  if (!pendingAnalysisResult) {
    alert('反映できる結果がありません。先に画像から自動入力を実行してください。');
    return;
  }

  applyAnalysisToCheckboxes(pendingAnalysisResult);
  const summary = document.getElementById('analysisSummary');
  if (summary) {
    summary.textContent = '✅ 反映しました。内容をご確認ください（必要なら手動で調整できます）。';
  }
  alert('自動入力候補を反映しました。内容をご確認ください。');
  pendingAnalysisResult = null;
}

/**
 * 確認パネルをリセット
 */
function resetAnalysisReview() {
  pendingAnalysisResult = null;
  const review = document.getElementById('analysisReview');
  const summary = document.getElementById('analysisSummary');
  const list = document.getElementById('analysisList');

  if (summary) summary.textContent = '';
  if (list) list.innerHTML = '';
  if (review) review.classList.add('hidden');
}

/**
 * Gemini API に画像を送信して、シフト情報を解析する
 */
async function analyzeImage() {
  const fileInput = document.getElementById('shiftImage');
  const file = fileInput.files[0];

  if (!file) {
    alert('画像ファイルを選択してください');
    return;
  }

  // UI フィードバック
  const analyzeBtn = document.getElementById('autoInputBtn');
  const originalText = analyzeBtn ? analyzeBtn.textContent : null;
  if (analyzeBtn) {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '自動入力中...';
  }

  try {
    // 1) 画像を Base64 エンコード
    const base64Image = await encodeImageToBase64(file);
    const mimeType = file.type; // e.g., "image/png"

    // 2) GASからAPIキーを取得
    const gasResponse = await fetch(GAS_ENDPOINT);
    if (!gasResponse.ok) {
      throw new Error(`APIキーの取得に失敗しました (Status: ${gasResponse.status})`);
    }
    
    const gasData = await gasResponse.json();
    const { apiKey } = gasData;

    if (!apiKey) {
      throw new Error('APIキーが見つかりませんでした');
    }
    
    console.log('✅ APIキーを取得しました（GASスクリプトプロパティ経由）');

    // 3) Gemini APIに直接送信
    const requestPayload = {
      contents: [
        {
          parts: [
            {
              text: `あなたはカレンダー画像の視覚解析を行うAIです。
      画像の各日付セルを確認し、以下の条件に合致する「シフト記号（アルファベット）」のみを抽出してください。

      【解析ルール】
      1. **抽出対象（確定シフト）**:
         - **「青色に塗りつぶされた四角い背景」** の中に描かれている **「白い文字」** だけを読み取ってください。
         - アルファベット（A, B, C, D, X, Y, Z など）が対象です。

      2. **除外対象（無視するもの）**:
         - **文字自体が黄色**のもの（背景が白、または透明）。これは「希望シフト」なので絶対に抽出しないでください。
         - 背景が塗りつぶされていない文字。
         - 日付の数字（1, 2, 3...）。

      3. **判定の注意点**:
         - 一つの日付セルの中に、「黄色の文字」と「青背景の白文字」が混在することがあります。その場合、**青背景のものだけ**を選り分けて抽出してください。
         - **絶対に幻覚を見ないでください。** 画像に青い背景の文字が存在しない日付（例：空欄の日や、黄色文字しかない日）は、結果に含めないでください。

      【出力形式】
      結果を以下のJSON形式（配列）**のみ**で出力してください。Markdown記法や説明文は一切不要です。

      [
        {"day": 1, "shifts": ["C", "D"]},
        {"day": 5, "shifts": ["A"]},
        ...
      ]`
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
    };

    const geminiUrl = `${GEMINI_API_URL}/${GEMINI_API_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      let errorData = null;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = await response.text();
      }
      console.error('Gemini API Error Status:', response.status);
      console.error('Gemini API Error Details:', errorData);
      console.error('API URL:', geminiUrl.replace(apiKey, '***'));
      console.error('Model:', GEMINI_API_MODEL);
      
      // より詳しいエラーメッセージを作成
      let errorMessage = `API Error: ${response.status}`;
      if (errorData && errorData.error) {
        errorMessage += ` - ${errorData.error.message}`;
      }
      
      throw new Error(`Gemini ${errorMessage}`);
    }

    const data = await response.json();

    // 4) レスポンスから JSON を抽出・解析
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Gemini Response:', responseText);

    // JSON ブロックを抽出（```json ... ``` または直接 [...] の形式に対応）
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      const arrayMatch = responseText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }
    }

    const analysisResult = JSON.parse(jsonStr);
    console.log('Parsed Result:', analysisResult);

    // 4) 結果を確認パネルに表示（ユーザー確認後に反映）
    pendingAnalysisResult = analysisResult;
    renderAnalysisReview(analysisResult);

    alert('自動入力候補を表示しました。内容を確認して反映してください。');
  } catch (error) {
    console.error('Error analyzing image:', error);
    alert(`エラーが発生しました: ${error.message}`);
  } finally {
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = originalText;
    }
  }
}

/**
 * 解析結果をチェックボックスに反映する
 * @param {Array} analysisResult - [{"day": 1, "shifts": ["B", "C"]}, ...]
 */
function applyAnalysisToCheckboxes(analysisResult) {
  if (!Array.isArray(analysisResult)) {
    console.error('Invalid analysis result format');
    return;
  }

  // 現在選択されている月を取得
  const selected = document.getElementById('monthSelector').value;
  const [year, month] = selected.split('-').map(Number);

  // 解析結果をループして、チェックボックスを ON にする
  analysisResult.forEach(({ day, shifts }) => {
    if (!Array.isArray(shifts)) return;

    shifts.forEach(shift => {
      // 日付を YYYY-MM-DD 形式で作成
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const checkboxId = `${dateStr}-${shift}`;
      const checkbox = document.getElementById(checkboxId);

      if (checkbox) {
        checkbox.checked = true;
        // チェックボックスの親 label に 'active' クラスを付与
        if (checkbox.parentElement && checkbox.parentElement.classList) {
          checkbox.parentElement.classList.add('active');
        }
      } else {
        console.warn(`Checkbox not found: ${checkboxId}`);
      }
    });
  });
}
