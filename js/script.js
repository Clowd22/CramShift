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
