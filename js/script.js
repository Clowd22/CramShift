const WebApp_URL = "https://script.google.com/macros/s/AKfycbwVzIP-tCTEoO2yjpAXdbFaqFcpnm9T_0JOiFEiXtflycGzgeHy7CysVg2Y7hjMXJpJbQ/exec"
const SHIFTS_MAIN = ['A', 'B', 'C', 'D'];
const SHIFTS_EXTRA = ['X', 'Y', 'Z'];
let showXYZ = false;

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

// UTCを使わず、日本時間で文字列を生成する関数を使う
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
    date.setDate(date.getDate() + 1); // 翌日に進める（元バグ原因の可能性）
}
}

// XYZの表示切替
function toggleXYZ() {
showXYZ = !showXYZ;
document.getElementById('toggleXYZ').innerText = showXYZ ? 'X, Y, Z コマを非表示にする' : 'X, Y, Z コマを表示する';
generateCalendar();
}

// シフト送信処理
function submitData() {
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

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.innerText = '処理中...';
  submitBtn.disabled = true;

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
}

// 初期実行
generateMonthOptions();
generateCalendar();
document.getElementById('monthSelector').addEventListener('change', generateCalendar);
    
