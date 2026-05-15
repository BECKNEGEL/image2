const API_BASE = window.APP_API_BASE || localStorage.getItem('APP_API_BASE') || 'http://127.0.0.1:3000';
const TOKEN_KEY = 'ai_image_token';
const USER_KEY = 'ai_image_user';

const RECHARGE_PACKAGES = [
  { amountCents: 1000, points: 100 },
  { amountCents: 2000, points: 220 },
  { amountCents: 3000, points: 360 },
  { amountCents: 6000, points: 780 },
];

const QUALITY_OPTIONS = {
  medium: { label: '标准成品图', cost: 10 },
  high: { label: '高清精修图', cost: 40 },
};

const SIZE_LABELS = {
  '1024x1024': '方图',
  '1024x1536': '竖图',
  '1536x1024': '横图',
};

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

function token() {
  return localStorage.getItem(TOKEN_KEY);
}

function savedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveSession(payload) {
  if (payload.token) localStorage.setItem(TOKEN_KEY, payload.token);
  if (payload.user) localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  updateUserUI(payload.user || savedUser());
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  updateUserUI(null);
}

function currentPageTarget() {
  const file = decodeURIComponent(location.pathname.split('/').pop() || '出图首页.html');
  return `${file}${location.search || ''}`;
}

function safeRedirectTarget() {
  const redirect = new URLSearchParams(location.search).get('redirect');
  if (!redirect || redirect.includes('://') || redirect.startsWith('/') || redirect.includes('\\')) {
    return './出图首页.html';
  }
  return `./${redirect.replace(/^\.\//, '')}`;
}

function loginUrl() {
  return `./登录注册页.html?redirect=${encodeURIComponent(currentPageTarget())}`;
}

function requireLogin() {
  if (token()) return true;
  window.location.href = loginUrl();
  return false;
}

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token()) headers.Authorization = `Bearer ${token()}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || data?.error || '请求失败';
    throw new Error(Array.isArray(message) ? message.join('，') : message);
  }
  return data;
}

async function refreshMe() {
  if (!token()) {
    updateUserUI(null);
    return null;
  }
  try {
    const user = await apiFetch('/auth/me');
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    updateUserUI(user);
    return user;
  } catch {
    clearSession();
    return null;
  }
}

function updateUserUI(user) {
  qsa('[data-points]').forEach((item) => {
    item.textContent = user ? `${user.credits || 0} 积分` : '登录 / 注册';
  });
  qsa('[data-username]').forEach((item) => {
    item.textContent = user?.nickname || user?.username || '未登录';
  });
  qsa('[data-user-id]').forEach((item) => {
    item.textContent = user ? `用户ID ${user.id}` : '登录后保存历史和积分';
  });
  qsa('[data-account-link]').forEach((item) => {
    item.setAttribute('href', user ? './我的页面.html' : loginUrl());
  });
  qsa('.guest-only').forEach((item) => {
    item.hidden = Boolean(user);
  });
  qsa('.user-only').forEach((item) => {
    item.hidden = !user;
  });
}

function setMessage(id, text, type = '') {
  const node = qs(id);
  if (!node) return;
  node.textContent = text;
  node.dataset.type = type;
}

function setActiveNav() {
  const page = document.body.dataset.page;
  qsa('.bottom-nav a').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.page === page);
  });
  qsa('.app-nav-link').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.page === page);
  });
}

function initAppNav() {
  if (document.body.dataset.page === 'auth' || qs('#appNav')) return;

  const nav = document.createElement('aside');
  nav.id = 'appNav';
  nav.className = `app-nav ${localStorage.getItem('app_nav_open') === '1' ? 'is-open' : ''}`;
  nav.innerHTML = `
    <button id="appNavToggle" class="app-nav-toggle" type="button" aria-label="展开导航">
      <span></span>
      <span></span>
      <span></span>
    </button>
    <div class="app-nav-brand">
      <strong>AI</strong>
      <span>图片工作台</span>
    </div>
    <nav class="app-nav-links" aria-label="主导航">
      <a class="app-nav-link nav-use" data-page="home" href="./出图首页.html"><b>✨</b><span>使用页</span></a>
      <a class="app-nav-link nav-history" data-page="history" href="./历史记录页.html"><b>🕘</b><span>历史记录</span></a>
      <a class="app-nav-link nav-plans" data-page="plans" href="./套餐购买页.html"><b>💳</b><span>积分充值</span></a>
      <a class="app-nav-link nav-profile" data-page="profile" href="./我的页面.html"><b>👤</b><span>我的账号</span></a>
    </nav>
    <div class="app-nav-foot">
      <span data-points>登录 / 注册</span>
    </div>
  `;

  document.body.prepend(nav);
  document.body.classList.add('has-app-nav');

  qs('#appNavToggle', nav)?.addEventListener('click', () => {
    nav.classList.toggle('is-open');
    localStorage.setItem('app_nav_open', nav.classList.contains('is-open') ? '1' : '0');
  });

  setActiveNav();
}

function initAuth() {
  const loginBtn = qs('#loginBtn');
  const registerBtn = qs('#registerBtn');
  const logoutBtn = qs('#logoutBtn');
  const usernameInput = qs('#authUsername');
  const passwordInput = qs('#authPassword');
  const nicknameInput = qs('#authNickname');

  async function submitAuth(mode) {
    const username = usernameInput?.value.trim();
    const password = passwordInput?.value.trim();
    const nickname = nicknameInput?.value.trim();
    if (!username || !password) {
      setMessage('#authMessage', '请填写账号和密码。', 'error');
      return;
    }

    setMessage('#authMessage', mode === 'register' ? '正在注册...' : '正在登录...');
    try {
      const payload = await apiFetch(mode === 'register' ? '/auth/register' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, nickname }),
      });
      saveSession(payload);
      setMessage('#authMessage', mode === 'register' ? '注册成功，正在跳转。' : '登录成功，正在跳转。', 'success');
      await refreshMe();
      window.location.href = './出图首页.html';
    } catch (error) {
      setMessage('#authMessage', error.message, 'error');
    }
  }

  loginBtn?.addEventListener('click', () => submitAuth('login'));
  registerBtn?.addEventListener('click', () => submitAuth('register'));
  logoutBtn?.addEventListener('click', () => {
    clearSession();
    window.location.href = './登录注册页.html?redirect=出图首页.html';
  });
}

function initAuthPage(user) {
  const redirectText = qs('#redirectText');
  const continueLink = qs('#continueLink');
  const target = safeRedirectTarget();
  if (redirectText) redirectText.textContent = `登录后返回：${decodeURIComponent(target.replace('./', ''))}`;
  if (redirectText) redirectText.textContent = '登录后进入使用页，再按需要选择生成、历史或充值。';
  if (continueLink) continueLink.href = './出图首页.html';
  if (user) setMessage('#authMessage', '当前账号已登录，可以直接继续。', 'success');
}

let homeState = { mode: 'text', file: null };

function initHome() {
  const prompt = qs('#prompt');
  const fileInput = qs('#imageInput');
  const uploadCard = qs('#uploadCard');
  const preview = qs('#uploadPreview');
  const mainPreview = qs('#mainImagePreview');
  const generateBtn = qs('#generateBtn');
  const clearPrompt = qs('#clearPrompt');
  const shell = qs('.chat-shell');
  const sidebar = qs('#settingsSidebar');
  const sidebarToggle = qs('#sidebarToggle');
  const sizeSelect = qs('#imageSizeSelect');
  const title = qs('#workspaceTitle');
  const subtitle = qs('#workspaceSubtitle');

  if (!prompt || !generateBtn) return;

  qsa('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      homeState.mode = button.dataset.mode || 'text';
      qsa('[data-mode]').forEach((item) => item.classList.toggle('is-active', item === button));
      qsa('.image-only').forEach((item) => {
        item.hidden = homeState.mode !== 'image';
      });
      qsa('[data-kind]').forEach((item) => {
        item.hidden = item.dataset.kind !== homeState.mode;
      });
      if (title) title.textContent = homeState.mode === 'image' ? '上传图片修改' : '开始生成图片';
      if (subtitle) {
        subtitle.textContent =
          homeState.mode === 'image'
            ? '上传原图，再在下方输入想要修改的地方。'
            : '下方输入提示词来生成图片。';
      }
      updateHomeCostState();
    });
  });

  sizeSelect?.addEventListener('change', updateHomeCostState);

  qsa('[data-size]').forEach((button) => {
    button.addEventListener('click', () => {
      qsa('[data-size]').forEach((item) => item.classList.remove('is-selected'));
      button.classList.add('is-selected');
      updateHomeCostState();
    });
  });

  qsa('[data-quality]').forEach((button) => {
    button.addEventListener('click', () => {
      qsa('[data-quality]').forEach((item) => item.classList.remove('is-selected'));
      button.classList.add('is-selected');
      updateHomeCostState();
    });
  });

  qsa('[data-prompt]').forEach((button) => {
    button.addEventListener('click', () => {
      prompt.value = button.dataset.prompt || '';
      qsa('[data-prompt]').forEach((item) => item.classList.remove('is-selected'));
      button.classList.add('is-selected');
      updateHomeCostState();
      prompt.focus();
    });
  });

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('#homeMessage', '请上传图片文件。', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage('#homeMessage', '图片不能超过 10MB。', 'error');
      return;
    }
    homeState.file = file;
    const url = URL.createObjectURL(file);
    if (preview) preview.src = url;
    if (mainPreview) mainPreview.src = url;
    uploadCard?.classList.add('has-image');
    mainPreview?.closest('.preview-slot')?.classList.add('has-image');
    updateHomeCostState();
  });

  prompt.addEventListener('input', updateHomeCostState);
  clearPrompt?.addEventListener('click', () => {
    prompt.value = '';
    qsa('[data-prompt]').forEach((item) => item.classList.remove('is-selected'));
    updateHomeCostState();
    prompt.focus();
  });

  const collapsed = localStorage.getItem('home_settings_collapsed') === '1';
  sidebar?.classList.toggle('is-collapsed', collapsed);
  shell?.classList.toggle('settings-collapsed', collapsed);
  sidebarToggle?.addEventListener('click', () => {
    const nextCollapsed = !sidebar?.classList.contains('is-collapsed');
    sidebar?.classList.toggle('is-collapsed', nextCollapsed);
    shell?.classList.toggle('settings-collapsed', nextCollapsed);
    localStorage.setItem('home_settings_collapsed', nextCollapsed ? '1' : '0');
  });
  qsa('.image-only').forEach((item) => {
    item.hidden = homeState.mode !== 'image';
  });
  qsa('[data-kind]').forEach((item) => {
    item.hidden = item.dataset.kind !== homeState.mode;
  });
  generateBtn.addEventListener('click', submitGeneration);
  updateHomeCostState();
}

function selectedSize() {
  const select = qs('#imageSizeSelect');
  if (select?.value) return select.value;
  return qs('[data-size].is-selected')?.dataset.size || '1024x1024';
}

function selectedQuality() {
  return qs('[data-quality].is-selected')?.dataset.quality || 'medium';
}

function currentCost() {
  return QUALITY_OPTIONS[selectedQuality()]?.cost || 10;
}

function updateHomeCostState() {
  const user = savedUser();
  const prompt = qs('#prompt');
  const generateBtn = qs('#generateBtn');
  const counter = qs('#counter');
  const cost = currentCost();
  const hasPrompt = (prompt?.value.trim().length || 0) >= 2;
  const hasImage = homeState.mode !== 'image' || Boolean(homeState.file);
  const enough = Boolean(user && (user.credits || 0) >= cost);

  if (counter && prompt) counter.textContent = `${prompt.value.length}/2000`;
  qsa('[data-current-cost]').forEach((item) => {
    item.textContent = `${cost} 积分`;
  });
  qsa('[data-current-size]').forEach((item) => {
    item.textContent = `${SIZE_LABELS[selectedSize()]} ${selectedSize()}`;
  });
  qsa('[data-current-quality]').forEach((item) => {
    item.textContent = QUALITY_OPTIONS[selectedQuality()]?.label || '标准成品图';
  });

  if (!generateBtn) return;
  if (!user) {
    generateBtn.disabled = !hasPrompt || !hasImage;
    generateBtn.textContent = '登录后生成';
    setMessage('#homeMessage', '请先登录或注册，生成记录会保存到你的账号。');
  } else if (!enough) {
    generateBtn.disabled = true;
    generateBtn.textContent = '积分不足';
    setMessage('#homeMessage', '积分不足，请先充值后再生成。', 'error');
  } else {
    generateBtn.disabled = !hasPrompt || !hasImage;
    generateBtn.textContent = '生成图片';
    setMessage('#homeMessage', '生成成功后扣除对应积分，系统失败不扣积分。');
  }
}

async function submitGeneration() {
  const user = savedUser();
  const prompt = qs('#prompt')?.value.trim();
  if (!user) {
    window.location.href = loginUrl();
    return;
  }
  if (!prompt) {
    setMessage('#homeMessage', '请输入提示词。', 'error');
    return;
  }
  if ((user.credits || 0) < currentCost()) {
    setMessage('#homeMessage', '积分不足，请先充值后再生成。', 'error');
    return;
  }

  const generateBtn = qs('#generateBtn');
  generateBtn.disabled = true;
  generateBtn.textContent = '正在创建任务...';

  try {
    let task;
    const body = {
      prompt,
      imageSize: selectedSize(),
      imageQuality: selectedQuality(),
    };

    if (homeState.mode === 'image') {
      if (!homeState.file) throw new Error('请先上传图片。');
      const formData = new FormData();
      formData.append('file', homeState.file);
      const asset = await apiFetch('/assets/upload', { method: 'POST', body: formData });
      task = await apiFetch('/tasks/edit', {
        method: 'POST',
        body: JSON.stringify({ ...body, sourceAssetId: asset.id }),
      });
    } else {
      task = await apiFetch('/tasks/text-image', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    setMessage('#homeMessage', '任务已创建，正在生成。');
    window.location.href = `./任务详情页.html?id=${task.id}`;
  } catch (error) {
    setMessage('#homeMessage', error.message || '生成失败，未扣除积分，请稍后重试。', 'error');
    generateBtn.disabled = false;
    generateBtn.textContent = '生成图片';
  }
}

async function initPlans(force = false) {
  if (!requireLogin()) return;
  const list = qs('#plansList');
  if (!list || (list.dataset.ready && !force)) return;
  list.dataset.ready = '1';

  let plans = [];
  try {
    plans = await apiFetch('/plans');
  } catch {
    plans = RECHARGE_PACKAGES.map((item, index) => ({
      id: index + 1,
      priceCents: item.amountCents,
      credits: item.points,
    }));
  }

  list.innerHTML = plans
    .map((plan) => {
      const badge = plan.priceCents === 3000 ? '推荐' : plan.priceCents === 6000 ? '最划算' : '';
      return `
        <article class="plan-card ${badge ? 'is-recommended' : ''}">
          <div class="plan-head">
            <div>
              <h3>${formatYuan(plan.priceCents)}元｜${plan.credits}积分${badge ? `｜${badge}` : ''}</h3>
              <p>${badge || '积分到账后可用于标准图片和高清精修图片。'}</p>
            </div>
            <div class="price">${formatYuan(plan.priceCents)}</div>
          </div>
          <button class="btn btn-primary full-btn" type="button" data-plan-id="${plan.id}">模拟支付并到账</button>
        </article>
      `;
    })
    .join('');

  qsa('[data-plan-id]', list).forEach((button) => {
    button.addEventListener('click', () => rechargePlan(Number(button.dataset.planId)));
  });
}

async function rechargePlan(planId) {
  if (!requireLogin()) return;
  setMessage('#plansMessage', '正在创建充值订单...');
  try {
    const payload = await apiFetch('/payments/orders', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
    const paid = await apiFetch(`/payments/orders/${payload.order.orderNo}/mock-paid`, { method: 'POST' });
    await refreshMe();
    setMessage('#plansMessage', `充值成功，已到账 ${paid.plan?.credits || payload.order.plan?.credits || ''} 积分。`, 'success');
  } catch (error) {
    setMessage('#plansMessage', error.message, 'error');
  }
}

async function initHistory() {
  if (!requireLogin()) return;
  const list = qs('#historyList');
  if (!list) return;
  try {
    const data = await apiFetch('/tasks?pageSize=50');
    if (!data.items?.length) {
      list.innerHTML = emptyHTML('暂无历史记录，生成成功后会自动出现在这里。');
      return;
    }
    list.innerHTML = data.items.map(renderTaskCard).join('');
  } catch (error) {
    list.innerHTML = emptyHTML(error.message);
  }
}

function renderTaskCard(task) {
  const image = task.outputAsset?.url || task.sourceAsset?.url;
  const thumb = image ? `<img src="${image}" alt="生成图片" />` : statusLabel(task.status).slice(0, 1);
  return `
    <article class="list-card">
      <div class="list-thumb">${thumb}</div>
      <div>
        <h3>${QUALITY_OPTIONS[task.imageQuality]?.label || '图片任务'}｜${SIZE_LABELS[task.imageSize] || task.imageSize || '方图'}</h3>
        <p>${formatDate(task.createdAt)}｜${statusLabel(task.status)}｜${task.costCredits || 0} 积分</p>
        <div class="card-actions">
          <a class="btn btn-quiet" href="./任务详情页.html?id=${task.id}">查看详情</a>
          <a class="btn btn-quiet" href="./出图首页.html">继续生成</a>
        </div>
      </div>
    </article>
  `;
}

async function initProfile() {
  if (!requireLogin()) return;
  const profileStats = qs('#profileStats');
  if (!profileStats) return;
  const user = savedUser() || (await refreshMe());
  try {
    const [tasks, ledger] = await Promise.all([apiFetch('/tasks?pageSize=1'), apiFetch('/credits/ledger')]);
    profileStats.innerHTML = `
      <div class="progress-strip">
        <div class="step"><strong>${user?.credits || 0}</strong><span>当前积分</span></div>
        <div class="step"><strong>${tasks.total || 0}</strong><span>生成任务</span></div>
        <div class="step"><strong>${ledger.items?.length || 0}</strong><span>积分流水</span></div>
      </div>
    `;
  } catch (error) {
    profileStats.innerHTML = emptyHTML(error.message);
  }
}

async function initLedger() {
  if (!requireLogin()) return;
  const list = qs('#ledgerList');
  if (!list) return;
  try {
    const data = await apiFetch('/credits/ledger');
    if (!data.items?.length) {
      list.innerHTML = emptyHTML('暂无积分流水。');
      return;
    }
    list.innerHTML = data.items
      .map((item) => `
        <article class="list-card">
          <div class="list-thumb">${item.delta > 0 ? '+' : ''}${item.delta}</div>
          <div>
            <h3>${ledgerTypeLabel(item.type)}</h3>
            <p>${formatDate(item.createdAt)}｜${item.beforeBalance ?? 0} → ${item.balanceAfter}｜${item.remark || item.reason}</p>
          </div>
        </article>
      `)
      .join('');
  } catch (error) {
    list.innerHTML = emptyHTML(error.message);
  }
}

async function initTaskDetail() {
  const root = qs('#taskDetail');
  if (!root) return;
  if (!requireLogin()) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    root.innerHTML = emptyHTML('没有找到任务编号。');
    return;
  }

  let pollCount = 0;
  async function poll() {
    try {
      const task = await apiFetch(`/tasks/${id}`);
      renderTaskDetail(task);
      if (['PENDING', 'PROCESSING'].includes(task.status) && pollCount < 80) {
        pollCount += 1;
        setTimeout(poll, 2500);
      } else {
        await refreshMe();
      }
    } catch (error) {
      root.innerHTML = emptyHTML(error.message);
    }
  }
  poll();
}

function renderTaskDetail(task) {
  const root = qs('#taskDetail');
  const source = task.sourceAsset?.url;
  const result = task.outputAsset?.url;
  const failed = task.status === 'FAILED';
  const succeeded = task.status === 'SUCCEEDED';
  root.innerHTML = `
    <section class="panel">
      <div class="section-title">
        <h2>${statusLabel(task.status)}</h2>
        <span class="mini-pill">${task.progress || 0}%</span>
      </div>
      <p class="card-copy">${succeeded ? '生成成功，已扣除对应积分。' : failed ? '生成失败，未扣除积分，请稍后重试。' : '正在生成中，请稍候。'}</p>
    </section>
    <section class="panel">
      <div class="section-title">
        <h2>图片结果</h2>
        <span class="mini-pill">${SIZE_LABELS[task.imageSize] || task.imageSize || '方图'}｜${task.costCredits || 0} 积分</span>
      </div>
      <div class="result-pair">
        <article class="image-card">${source ? imageHTML(source, '原图') : '<div class="empty mini-empty">文字生成</div>'}<footer><span>输入</span></footer></article>
        <article class="image-card">${result ? imageHTML(result, '结果图') : '<div class="empty mini-empty">等待结果</div>'}<footer><span>结果</span></footer></article>
      </div>
    </section>
    <section class="panel">
      <div class="section-title"><h2>提示词</h2></div>
      <p class="card-copy">${escapeHTML(task.extraPrompt || task.prompt || '')}</p>
      ${task.errorMessage ? `<p class="notice">${escapeHTML(task.errorMessage)}</p>` : ''}
      <div class="button-row detail-actions">
        ${result ? `<a class="btn btn-secondary" href="${result}" download target="_blank" rel="noreferrer">下载结果图</a>` : ''}
        <a class="btn btn-secondary" href="./出图首页.html">继续生成</a>
        <a class="btn btn-primary" href="./历史记录页.html">查看历史</a>
      </div>
    </section>
  `;
}

function imageHTML(src, alt) {
  return `<img src="${src}" alt="${alt}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'empty mini-empty',textContent:'图片加载失败，请稍后刷新'}))" />`;
}

function initCopyButtons() {
  qsa('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const text = button.dataset.copy || '';
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = '已复制';
      } catch {
        alert(text);
      }
    });
  });
}

function emptyHTML(text) {
  return `<div class="empty"><span>${escapeHTML(text)}</span></div>`;
}

function statusLabel(status) {
  return {
    PENDING: '排队中',
    PROCESSING: '生成中',
    SUCCEEDED: '已完成',
    FAILED: '生成失败',
  }[status] || status || '未知';
}

function ledgerTypeLabel(type) {
  return {
    recharge: '充值到账',
    generate: '生成扣除',
    refund: '失败退回',
  }[type] || '积分变动';
}

function formatYuan(cents) {
  return String((Number(cents || 0) / 100).toFixed(2)).replace(/\.00$/, '');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', async () => {
  initAppNav();
  setActiveNav();
  initCopyButtons();
  initAuth();
  updateUserUI(savedUser());
  const user = await refreshMe();

  const page = document.body.dataset.page;
  if (page === 'auth') initAuthPage(user);
  if (page === 'home') initHome();
  if (page === 'plans') initPlans();
  if (page === 'history') initHistory();
  if (page === 'profile') initProfile();
  if (page === 'ledger') initLedger();
  initTaskDetail();
});
