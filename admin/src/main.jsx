import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart3, ImagePlus, ListChecks, LogOut, Plus, RefreshCw, Save, Trash2, Users as UsersIcon } from 'lucide-react';
import { api, clearToken, getToken, setToken } from './api';
import './styles.css';

const navItems = [
  { key: 'dashboard', label: '概览', icon: BarChart3 },
  { key: 'users', label: '用户', icon: UsersIcon },
  { key: 'templates', label: '模板', icon: ImagePlus },
  { key: 'tasks', label: '任务', icon: ListChecks }
];

function App() {
  const [token, updateToken] = useState(getToken());
  const [view, setView] = useState('dashboard');

  if (!token) {
    return <Login onLogin={(nextToken) => updateToken(nextToken)} />;
  }

  const ActiveIcon = navItems.find((item) => item.key === view)?.icon || BarChart3;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div>
            <h1>出图后台</h1>
            <p>商品宣传图运营管理</p>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} className={view === item.key ? 'nav-active' : ''} onClick={() => setView(item.key)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button
          className="logout-button"
          onClick={() => {
            clearToken();
            updateToken('');
          }}
        >
          <LogOut size={18} />
          <span>退出</span>
        </button>
      </aside>
      <main className="content">
        <header className="topbar">
          <div>
            <h2>{navItems.find((item) => item.key === view)?.label}</h2>
            <p>{new Date().toLocaleDateString('zh-CN')}</p>
          </div>
          <ActiveIcon size={24} />
        </header>
        {view === 'dashboard' && <Dashboard />}
        {view === 'users' && <UsersPage />}
        {view === 'templates' && <Templates />}
        {view === 'tasks' && <Tasks />}
      </main>
    </div>
  );
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: 'admin', password: 'admin123456' });
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await api('/admin/auth/login', { method: 'POST', body: form });
      setToken(data.token);
      onLogin(data.token);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={submit}>
        <div className="brand login-brand">
          <div className="brand-mark">AI</div>
          <div>
            <h1>出图后台</h1>
            <p>管理员登录</p>
          </div>
        </div>
        <label>
          用户名
          <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
        </label>
        <label>
          密码
          <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </label>
        <button className="primary-action" disabled={loading}>
          {loading ? '登录中' : '登录'}
        </button>
      </form>
    </main>
  );
}

function Dashboard() {
  const [data, setData] = useState(null);

  async function load() {
    setData(await api('/admin/dashboard'));
  }

  useEffect(() => {
    load().catch((error) => alert(error.message));
  }, []);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      ['用户数', data.users],
      ['进行中任务', data.pendingTasks],
      ['成功任务', data.succeededTasks],
      ['当前模式', '免费体验'],
      ['额度开通', '手动加点']
    ];
  }, [data]);

  return (
    <section>
      <div className="section-toolbar">
        <button className="icon-button" title="刷新" onClick={() => load().catch((error) => alert(error.message))}>
          <RefreshCw size={17} />
        </button>
      </div>
      <div className="metric-grid">
        {cards.map(([label, value]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function Templates() {
  const emptyForm = {
    name: '',
    styleKey: '',
    coverUrl: '',
    promptText: '',
    negativePrompt: '',
    sort: 0,
    status: 'ACTIVE'
  };
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    setItems(await api('/admin/templates'));
  }

  useEffect(() => {
    load().catch((error) => alert(error.message));
  }, []);

  async function submit(event) {
    event.preventDefault();
    const body = { ...form, sort: Number(form.sort || 0) };
    try {
      if (editingId) {
        await api(`/admin/templates/${editingId}`, { method: 'PATCH', body });
      } else {
        await api('/admin/templates', { method: 'POST', body });
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (error) {
      alert(error.message);
    }
  }

  function edit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      styleKey: item.styleKey,
      coverUrl: item.coverUrl || '',
      promptText: item.promptText,
      negativePrompt: item.negativePrompt || '',
      sort: item.sort,
      status: item.status
    });
  }

  async function disable(id) {
    if (!confirm('确认停用该模板？')) return;
    await api(`/admin/templates/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <section className="split-layout">
      <form className="editor-panel" onSubmit={submit}>
        <h3>{editingId ? '编辑模板' : '新增模板'}</h3>
        <div className="form-grid">
          <label>
            名称
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label>
            标识
            <input value={form.styleKey} onChange={(event) => setForm({ ...form, styleKey: event.target.value })} required />
          </label>
        </div>
        <label>
          封面 URL
          <input value={form.coverUrl} onChange={(event) => setForm({ ...form, coverUrl: event.target.value })} />
        </label>
        <label>
          正向提示词
          <textarea value={form.promptText} onChange={(event) => setForm({ ...form, promptText: event.target.value })} required />
        </label>
        <label>
          负向提示词
          <textarea value={form.negativePrompt} onChange={(event) => setForm({ ...form, negativePrompt: event.target.value })} />
        </label>
        <div className="form-grid">
          <label>
            排序
            <input type="number" value={form.sort} onChange={(event) => setForm({ ...form, sort: event.target.value })} />
          </label>
          <label>
            状态
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="ACTIVE">启用</option>
              <option value="DISABLED">停用</option>
            </select>
          </label>
        </div>
        <div className="action-row">
          <button className="primary-action">
            <Save size={17} />
            <span>保存</span>
          </button>
          {editingId && (
            <button type="button" className="ghost-action" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              取消
            </button>
          )}
        </div>
      </form>

      <div className="table-panel">
        <div className="section-toolbar">
          <h3>模板列表</h3>
          <button className="icon-button" title="新增" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
            <Plus size={17} />
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>标识</th>
              <th>状态</th>
              <th>排序</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.styleKey}</td>
                <td><span className={`status ${item.status.toLowerCase()}`}>{item.status}</span></td>
                <td>{item.sort}</td>
                <td className="table-actions">
                  <button className="link-button" onClick={() => edit(item)}>编辑</button>
                  <button className="icon-button danger" title="停用" onClick={() => disable(item.id)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsersPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [grantForms, setGrantForms] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  async function load() {
    const data = await api('/admin/users?pageSize=50');
    setItems(data.items || []);
    setTotal(data.total || 0);
  }

  useEffect(() => {
    load().catch((error) => alert(error.message));
  }, []);

  async function grantCredits(userId) {
    const amount = Number(grantForms[userId] || 0);
    if (!Number.isInteger(amount) || amount <= 0) {
      alert('请输入要增加的额度，必须是正整数');
      return;
    }
    setLoadingId(userId);
    try {
      await api(`/admin/users/${userId}/credits`, {
        method: 'POST',
        body: { amount, reason: 'ADMIN_GRANT' }
      });
      setGrantForms((prev) => ({ ...prev, [userId]: '' }));
      await load();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoadingId(null);
    }
  }

  async function copyUserId(userId) {
    await navigator.clipboard.writeText(String(userId));
    alert(`已复制用户编号：${userId}`);
  }

  return (
    <section className="table-panel">
      <div className="section-toolbar">
        <div>
          <h3>用户额度</h3>
          <p className="toolbar-subtitle">共 {total} 个用户。用户联系你时，把编号发来，你在这里手动增加额度。</p>
        </div>
        <button className="icon-button" title="刷新" onClick={() => load().catch((error) => alert(error.message))}>
          <RefreshCw size={17} />
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>用户编号</th>
            <th>用户</th>
            <th>剩余额度</th>
            <th>任务数</th>
            <th>注册时间</th>
            <th>手动加额度</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="nowrap">
                #{item.id}
                <button className="mini-link" onClick={() => copyUserId(item.id)}>复制</button>
              </td>
              <td>
                <strong>{item.nickname || '微信用户'}</strong>
                <div className="muted">{item.openid}</div>
              </td>
              <td><strong>{item.credits}</strong> 点</td>
              <td>{item._count?.tasks || 0}</td>
              <td>{new Date(item.createdAt).toLocaleString('zh-CN')}</td>
              <td>
                <div className="inline-form">
                  <input
                    className="number-input"
                    type="number"
                    min="1"
                    placeholder="点数"
                    value={grantForms[item.id] || ''}
                    onChange={(event) => setGrantForms((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  />
                  <button className="primary-action" disabled={loadingId === item.id} onClick={() => grantCredits(item.id)}>
                    {loadingId === item.id ? '提交中' : '加额度'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Tasks() {
  return <PagedTable path="/admin/tasks" columns={['ID', '用户', '模板', '状态', '进度', '创建时间']} map={(item) => [
    item.id,
    item.user?.nickname || item.user?.openid,
    item.template?.name,
    item.status,
    `${item.progress}%`,
    new Date(item.createdAt).toLocaleString('zh-CN')
  ]} />;
}

function Orders() {
  return <PagedTable path="/admin/orders" columns={['订单号', '用户', '套餐', '金额', '状态', '支付时间']} map={(item) => [
    item.orderNo,
    item.user?.nickname || item.user?.openid,
    item.plan?.name,
    `¥${(item.amountCents / 100).toFixed(2)}`,
    item.status,
    item.paidAt ? new Date(item.paidAt).toLocaleString('zh-CN') : '-'
  ]} />;
}

function PagedTable({ path, columns, map }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');

  async function load() {
    const query = status ? `?status=${status}` : '';
    const data = await api(`${path}${query}`);
    setItems(data.items || []);
  }

  useEffect(() => {
    load().catch((error) => alert(error.message));
  }, [status]);

  return (
    <section className="table-panel">
      <div className="section-toolbar">
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">全部状态</option>
          <option value="PENDING">PENDING</option>
          <option value="PROCESSING">PROCESSING</option>
          <option value="SUCCEEDED">SUCCEEDED</option>
          <option value="FAILED">FAILED</option>
          <option value="PAID">PAID</option>
        </select>
        <button className="icon-button" title="刷新" onClick={() => load().catch((error) => alert(error.message))}>
          <RefreshCw size={17} />
        </button>
      </div>
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              {map(item).map((cell, index) => <td key={`${item.id}-${index}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
