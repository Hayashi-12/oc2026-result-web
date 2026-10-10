import './style.css';

const app = document.querySelector('#app');
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const bucket = import.meta.env.VITE_SUPABASE_BUCKET || 'oc2026-results';
const pollMs = Number(import.meta.env.VITE_POLL_MS || 3000);

let pollTimer = null;

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function normalizeNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isInteger(n) || n < 0 || n > 999) return null;
  return String(n).padStart(3, '0');
}

function resultId(number3) {
  return `OC2026_${number3}`;
}

function resultFileName(number3) {
  return `${resultId(number3)}_result.png`;
}

function resultUrl(number3) {
  const file = encodeURIComponent(resultFileName(number3));
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${file}`;
}

function renderStart(message = '') {
  stopPolling();
  app.innerHTML = `
    <div class="brand">熊本大学 OC2026</div>
    <h1>手術スキルチャレンジ</h1>
    <p class="lead">体験番号を入力すると、あなたの採点結果を確認できます。</p>
    <form id="number-form" class="number-form">
      <label for="number">体験番号</label>
      <div class="input-row">
        <span class="prefix">OC2026_</span>
        <input id="number" name="number" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="001" autocomplete="off" autofocus />
      </div>
      ${message ? `<p class="error">${message}</p>` : ''}
      <button type="submit">結果を見る</button>
    </form>
    <p class="note">番号のみ入力してください。例：1 → 001</p>
  `;

  document.querySelector('#number-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const number3 = normalizeNumber(document.querySelector('#number').value);
    if (!number3) {
      renderStart('001〜999の番号を入力してください。');
      return;
    }
    history.replaceState(null, '', `?id=${number3}`);
    renderWaiting(number3);
    checkResult(number3);
  });
}

function renderWaiting(number3) {
  stopPolling();
  app.innerHTML = `
    <div class="brand">熊本大学 OC2026</div>
    <div class="id-badge">${resultId(number3)}</div>
    <h1>ただいま採点中です</h1>
    <div class="loader" aria-hidden="true"><span></span><span></span><span></span></div>
    <p class="lead">画像解析が終わると、この画面に自動で結果が表示されます。</p>
    <p class="note">このまま画面を開いてお待ちください。</p>
    <button class="secondary" id="change-id">番号を変更する</button>
  `;
  document.querySelector('#change-id').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    renderStart();
  });
}

function renderResult(number3, url) {
  stopPolling();
  const freshUrl = `${url}?t=${Date.now()}`;
  app.innerHTML = `
    <div class="brand">熊本大学 OC2026</div>
    <div class="id-badge">${resultId(number3)}</div>
    <h1>採点結果</h1>
    <p class="lead">おつかれさまでした！</p>
    <div class="result-frame">
      <img id="result-image" src="${freshUrl}" alt="${resultId(number3)} の採点結果画像" />
    </div>
    <p class="note">最新の採点結果を表示しています。再採点された場合も自動で更新されます。</p>
    <p class="note">画像はピンチ操作で拡大して確認できます。</p>
    <button class="secondary" id="change-id">別の番号を見る</button>
  `;
  document.querySelector('#change-id').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    renderStart();
  });

  // Python側は初回・retry1・retry2…のローカル画像を残しつつ、
  // Web公開用には常に同じ OC2026_XXX_result.png を最新結果で更新する。
  // そのため、結果表示後も同じURLを定期的に再取得すれば、
  // 参加者がページを開き直さなくても最新retryへ切り替わる。
  pollTimer = setTimeout(() => refreshDisplayedResult(number3, url), pollMs);
}

function imageExists(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = `${url}?t=${Date.now()}`;
  });
}

async function refreshDisplayedResult(number3, url) {
  const exists = await imageExists(url);
  if (!exists) {
    renderWaiting(number3);
    pollTimer = setTimeout(() => checkResult(number3), pollMs);
    return;
  }

  const visible = document.querySelector('#result-image');
  if (visible) {
    visible.src = `${url}?t=${Date.now()}`;
  }
  pollTimer = setTimeout(() => refreshDisplayedResult(number3, url), pollMs);
}

async function checkResult(number3) {
  if (!supabaseUrl) {
    app.insertAdjacentHTML('beforeend', '<p class="error">VITE_SUPABASE_URL が設定されていません。</p>');
    return;
  }

  const url = resultUrl(number3);
  const exists = await imageExists(url);
  if (exists) {
    renderResult(number3, url);
    return;
  }

  pollTimer = setTimeout(() => checkResult(number3), pollMs);
}

const initial = new URLSearchParams(location.search).get('id');
const initialNumber = normalizeNumber(initial);
if (initialNumber) {
  renderWaiting(initialNumber);
  checkResult(initialNumber);
} else {
  renderStart();
}
