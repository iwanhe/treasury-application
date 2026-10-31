import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, ConfigProvider, Form, Input, InputNumber, Modal, Row, Select, Space, Spin, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Keycloak from 'keycloak-js';
import { api, setTokenProvider } from './api';
import type { Company, Rule } from './api';
import TicketsPanel from './TicketsPanel';

const requestTypes = [
  'BANK_ACCOUNT_OPEN', 'BANK_ACCOUNT_CLOSE', 'INTERNET_BANKING', 'FINANCIAL_INVESTMENT',
  'FX_DEAL', 'FUNDING_LOAN', 'FACILITY_EXTENSION', 'OTHER'
].map(value => ({ value, label: value.replaceAll('_', ' ') }));
const roleOptions = ['APPROVER', 'TREASURY_CHECKER', 'ADMIN'].map(value => ({ value, label: value.replaceAll('_', ' ') }));
const oidc = new Keycloak({
  url: import.meta.env.VITE_OIDC_URL ?? 'http://localhost:8080',
  realm: import.meta.env.VITE_OIDC_REALM ?? 'treasury-dev',
  clientId: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'treasury-web'
});

// React StrictMode mounts effects twice in development. Keycloak instances may only
// be initialized once, so share the same initialization promise across both mounts.
let oidcInitPromise: Promise<boolean> | undefined;
function initializeOidc() {
  oidcInitPromise ??= oidc.init({
    onLoad: 'login-required',
    pkceMethod: 'S256',
    checkLoginIframe: false
  });
  return oidcInitPromise;
}
type RuleForm = {
  requestType: string; sequence: number; currencyCode: string; minAmount: string;
  maxAmount?: string; approverRoleCode?: string; approverUserId?: string;
};

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [demoIdentity, setDemoIdentity] = useState('maker');
  const [demoAccessCode, setDemoAccessCode] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Rule>();
  const [form] = Form.useForm<RuleForm>();
  const [simulation, setSimulation] = useState({ requestType: 'FINANCIAL_INVESTMENT', currencyCode: 'IDR', amount: '100000000' });
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE === 'demo') {
      setAuthReady(true);
      return;
    }
    let alive = true;
    initializeOidc()
      .then(ok => {
        if (!alive) return;
        setAuthenticated(ok);
        setTokenProvider(() => oidc.token);
      })
      .catch((cause: unknown) => {
        console.error('Keycloak initialization failed:', cause);
        if (alive) setError('SSO tidak dapat dihubungi. Periksa konfigurasi Keycloak dan URL redirect client.');
      })
      .finally(() => { if (alive) setAuthReady(true); });
    const refresh = window.setInterval(() => {
      if (oidc.authenticated) oidc.updateToken(30).catch(() => oidc.login());
    }, 20000);
    return () => { alive = false; window.clearInterval(refresh); };
  }, []);

  async function loginDemo() {
    setDemoLoading(true);
    setError(undefined);
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
      const response = await fetch(`${base}/auth/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: demoIdentity, accessCode: demoAccessCode })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Demo login gagal.');
      const token = body.accessToken as string;
      if (!token) throw new Error('Backend tidak mengembalikan access token.');
      setTokenProvider(() => token);
      setAuthenticated(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Demo login gagal.');
    } finally {
      setDemoLoading(false);
    }
  }

  useEffect(() => {
    if (!authenticated) return;
    api<Company[]>('/companies/mine')
      .then(rows => { setCompanies(rows); if (rows[0]) setCompanyId(rows[0].id); })
      .catch(e => setError(e.message));
  }, [authenticated]);

  const selectedCompany = companies.find(c => c.id === companyId);
  const isAdmin = selectedCompany?.roles.includes('ADMIN') ?? false;

  async function loadRules(id = companyId) {
    if (!id) return;
    setLoading(true); setError(undefined);
    try { setRules(await api<Rule[]>(`/companies/${id}/approval-rules`)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal mengambil aturan approval.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (companyId) void loadRules(companyId); }, [companyId]);

  const ownRules = useMemo(() => rules.filter(r => r.companyId === companyId), [rules, companyId]);
  const globalRules = useMemo(() => rules.filter(r => r.companyId === null), [rules]);
  const matching = useMemo(() => {
    const amount = Number(simulation.amount);
    const candidates = rules.filter(r => r.requestType === simulation.requestType && r.currencyCode.trim() === simulation.currencyCode &&
      amount >= Number(r.minAmount) && (r.maxAmount === null || amount <= Number(r.maxAmount)));
    const company = candidates.filter(r => r.companyId === companyId);
    return (company.length ? company : candidates.filter(r => r.companyId === null)).sort((a,b) => a.sequence - b.sequence);
  }, [rules, simulation, companyId]);

  function openCreate() {
    setEditing(undefined);
    form.setFieldsValue({ requestType: 'FINANCIAL_INVESTMENT', sequence: Math.max(0, ...ownRules.map(r => r.sequence)) + 1,
      currencyCode: 'IDR', minAmount: '0', approverRoleCode: 'APPROVER' });
    setModalOpen(true);
  }
  function openEdit(rule: Rule) {
    if (!rule.companyId) return;
    setEditing(rule);
    form.setFieldsValue({ requestType: rule.requestType, sequence: rule.sequence, currencyCode: rule.currencyCode.trim(),
      minAmount: rule.minAmount, maxAmount: rule.maxAmount ?? undefined,
      approverRoleCode: rule.approverRoleCode ?? undefined, approverUserId: rule.approverUserId ?? undefined });
    setModalOpen(true);
  }
  async function saveRule() {
    if (!companyId) return;
    const values = await form.validateFields();
    const payload = { ...values, currencyCode: values.currencyCode.toUpperCase(),
      maxAmount: values.maxAmount || null };
    try {
      if (editing) await api(`/companies/${companyId}/approval-rules/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api(`/companies/${companyId}/approval-rules`, { method: 'POST', body: JSON.stringify(payload) });
      messageApi.success(editing ? 'Aturan approval diperbarui.' : 'Aturan approval dibuat.');
      setModalOpen(false); await loadRules();
    } catch (e) { messageApi.error(e instanceof Error ? e.message : 'Gagal menyimpan aturan.'); }
  }
  async function toggleRule(rule: Rule) {
    if (!companyId || !rule.companyId) return;
    try {
      await api(`/companies/${companyId}/approval-rules/${rule.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: false }) });
      messageApi.success('Aturan dinonaktifkan.'); await loadRules();
    } catch (e) { messageApi.error(e instanceof Error ? e.message : 'Gagal menonaktifkan aturan.'); }
  }

  const columns: ColumnsType<Rule> = [
    { title: 'Urutan', dataIndex: 'sequence', width: 92, render: (n: number) => <div className="rule-sequence"><span className="sequence-number">{n}</span></div> },
    { title: 'Jenis transaksi', dataIndex: 'requestType', render: (v: string) => v.replaceAll('_', ' ') },
    { title: 'Mata uang', dataIndex: 'currencyCode', width: 100, render: (v: string) => v.trim() },
    { title: 'Rentang nominal', render: (_: unknown, r: Rule) => <span>{Number(r.minAmount).toLocaleString('id-ID')} – {r.maxAmount ? Number(r.maxAmount).toLocaleString('id-ID') : 'Tanpa batas'}</span> },
    { title: 'Approver', render: (_: unknown, r: Rule) => r.approverRoleCode ? r.approverRoleCode.replaceAll('_', ' ') : `User ${r.approverUserId?.slice(0,8)}…` },
    { title: 'Sumber', dataIndex: 'companyId', width: 120, render: (v: string | null) => v ? <Tag color="cyan">PT khusus</Tag> : <Tag>Global fallback</Tag> },
    { title: 'Aksi', width: 160, render: (_: unknown, r: Rule) => r.companyId ? <Space><Button size="small" onClick={() => openEdit(r)}>Ubah</Button><Button size="small" danger onClick={() => void toggleRule(r)}>Nonaktifkan</Button></Space> : <Typography.Text type="secondary">Read only</Typography.Text> }
  ];

  if (!authReady) return <div className="empty-state"><Spin size="large" /><p>Memeriksa sesi SSO…</p></div>;
  if (!authenticated && import.meta.env.VITE_AUTH_MODE === 'demo') return <div className="empty-state"><Card title="Treasury Ticketing — Personal Demo" style={{width:'min(420px, 92vw)'}}><Typography.Paragraph type="secondary">Gunakan identitas dummy yang sudah disiapkan. Sesi demo berlaku maksimal 2 jam.</Typography.Paragraph><Select aria-label="Identitas demo" value={demoIdentity} onChange={setDemoIdentity} style={{width:'100%',marginBottom:12}} options={[{value:'maker',label:'Treasury Maker'},{value:'checker',label:'Treasury Checker'},{value:'admin',label:'Treasury Admin'}]}/>{error && <Alert type="error" message={error} style={{marginBottom:12}}/><Button type="primary" block loading={demoLoading} onClick={()=>void loginDemo()}>Masuk Demo</Button></Card></div>;
  if (!authenticated) return <div className="empty-state"><Alert type="error" message={error ?? 'Autentikasi diperlukan.'} /></div>;

  return <ConfigProvider theme={{ token: { colorPrimary: '#167d73', borderRadius: 8, fontFamily: 'Inter, system-ui, sans-serif' } }}>
    {contextHolder}
    <div className="app-shell">
      <header className="topbar"><div className="brand"><div className="brand-mark">T</div><span>TREASURY <span style={{fontWeight:400,opacity:.75}}>PORTAL</span></span></div>
        <Space><Typography.Text style={{color:'white'}}>{oidc.tokenParsed?.preferred_username ?? oidc.tokenParsed?.email ?? 'User'}</Typography.Text><Button type="text" onClick={() => { if (import.meta.env.VITE_AUTH_MODE === 'demo') { setAuthenticated(false); setTokenProvider(() => undefined); } else { void oidc.logout({ redirectUri: window.location.origin }); } }}>Keluar</Button></Space>
      </header>
      <main className="page">
        <div className="page-heading"><div><div className="eyebrow">Treasury operations / configuration</div><h1>Approval Rule Administration</h1><div className="subtle">Atur jalur persetujuan berdasarkan jenis transaksi, nominal, dan perusahaan.</div></div>
          <Select style={{minWidth:240}} value={companyId} placeholder="Pilih perusahaan" onChange={setCompanyId} options={companies.map(c=>({value:c.id,label:`${c.code} — ${c.name}`}))} />
        </div>
        {error && <Alert type="error" showIcon message={error} style={{marginBottom:16}} closable onClose={()=>setError(undefined)} />}
        {!companies.length && <Alert type="warning" message="Akun belum memiliki akses ke perusahaan. Hubungi administrator untuk provisioning." />}
        {selectedCompany && <TicketsPanel companyId={selectedCompany.id} canCreate={selectedCompany.roles.some(role => ['REQUESTER','TREASURY_MAKER','ADMIN'].includes(role))} canApprove={selectedCompany.roles.some(role => ['APPROVER','TREASURY_CHECKER','ADMIN'].includes(role))} />}
        {selectedCompany && <>
          <div className="metric-row">
            <div className="metric"><strong>{ownRules.length}</strong><span>Aturan khusus PT</span></div>
            <div className="metric"><strong>{globalRules.length}</strong><span>Aturan global tersedia</span></div>
            <div className="metric"><strong>{selectedCompany.roles.includes('ADMIN') ? 'Admin' : 'Read only'}</strong><span>Akses pada perusahaan ini</span></div>
          </div>
          <Card className="panel" styles={{body:{padding:0}}} bordered={false}>
            <div className="panel-heading"><div><Typography.Title level={5} style={{margin:0}}>Matriks aturan approval</Typography.Title><Typography.Text type="secondary">Aturan PT mengesampingkan fallback global jika memenuhi kriteria.</Typography.Text></div>
              {isAdmin && <Button type="primary" onClick={openCreate}>+ Tambah aturan</Button>}
            </div>
            <div className="panel-body"><Table rowKey="id" size="middle" loading={loading} columns={columns} dataSource={rules} pagination={{pageSize:8}} scroll={{x:900}} locale={{emptyText:'Belum ada aturan approval untuk perusahaan ini.'}} /></div>
          </Card>
          <Card className="panel" style={{marginTop:20}} styles={{body:{padding:0}}} bordered={false}>
            <div className="panel-heading"><div><Typography.Title level={5} style={{margin:0}}>Simulasi jalur persetujuan</Typography.Title><Typography.Text type="secondary">Simulasi lokal berdasarkan aturan aktif yang sedang ditampilkan; tidak membuat transaksi.</Typography.Text></div><Tag color="processing">Preview only</Tag></div>
            <div className="panel-body">
              <Row gutter={[12,12]} style={{marginBottom:18}}>
                <Col xs={24} md={8}><Typography.Text type="secondary">Jenis transaksi</Typography.Text><Select style={{width:'100%',marginTop:6}} value={simulation.requestType} options={requestTypes} onChange={v=>setSimulation(s=>({...s,requestType:v}))}/></Col>
                <Col xs={12} md={5}><Typography.Text type="secondary">Mata uang</Typography.Text><Input style={{marginTop:6}} maxLength={3} value={simulation.currencyCode} onChange={e=>setSimulation(s=>({...s,currencyCode:e.target.value.toUpperCase()}))}/></Col>
                <Col xs={12} md={7}><Typography.Text type="secondary">Nominal</Typography.Text><Input style={{marginTop:6}} inputMode="decimal" value={simulation.amount} onChange={e=>setSimulation(s=>({...s,amount:e.target.value.replace(/[^0-9.]/g,'')}))}/></Col>
              </Row>
              <div className="simulator">
                {matching.length ? <><Typography.Text strong>{matching.some(r=>r.companyId===companyId) ? 'Menggunakan aturan khusus PT' : 'Menggunakan fallback global'}</Typography.Text>
                  {matching.map(r=><div className="sim-step" key={r.id}><span className="sequence-number">{r.sequence}</span><div style={{flex:1}}><Typography.Text strong>{r.approverRoleCode?.replaceAll('_',' ') ?? `Approver user ${r.approverUserId?.slice(0,8)}`}</Typography.Text><div className="subtle">Sequence {r.sequence} · {r.currencyCode.trim()}</div></div><Tag color="success">Required</Tag></div>)}
                </> : <div className="empty-state">Tidak ada rule aktif yang cocok. Pengajuan dengan kombinasi ini akan ditolak API saat submit.</div>}
              </div>
            </div>
          </Card>
        </>}
      </main>
    </div>
    <Modal title={editing ? 'Ubah aturan approval' : 'Tambah aturan approval'} open={modalOpen} onCancel={()=>setModalOpen(false)} onOk={()=>void saveRule()} okText="Simpan" cancelText="Batal" destroyOnClose>
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item name="requestType" label="Jenis transaksi" rules={[{required:true}]}><Select options={requestTypes}/></Form.Item>
        <Row gutter={12}><Col span={8}><Form.Item name="sequence" label="Urutan" rules={[{required:true}]}><InputNumber min={1} max={20} style={{width:'100%'}}/></Form.Item></Col>
          <Col span={8}><Form.Item name="currencyCode" label="Mata uang" rules={[{required:true,pattern:/^[A-Z]{3}$/}]}><Input maxLength={3}/></Form.Item></Col>
          <Col span={8}><Form.Item name="minAmount" label="Minimum" rules={[{required:true}]}><Input/></Form.Item></Col></Row>
        <Form.Item name="maxAmount" label="Maksimum (kosong = tanpa batas)"><Input/></Form.Item>
        <Form.Item name="approverRoleCode" label="Role approver" rules={[{validator: (_, value) => value || form.getFieldValue('approverUserId') ? Promise.resolve() : Promise.reject(new Error('Pilih role atau user approver.'))}]}><Select allowClear options={roleOptions} onChange={()=>form.setFieldValue('approverUserId',undefined)}/></Form.Item>
        <Form.Item name="approverUserId" label="Atau user approver (ID)" rules={[{validator: (_, value) => value || form.getFieldValue('approverRoleCode') ? Promise.resolve() : Promise.reject(new Error('Pilih role atau user approver.'))}]}><Input allowClear onChange={()=>form.setFieldValue('approverRoleCode',undefined)}/></Form.Item>
      </Form>
    </Modal>
  </ConfigProvider>;
}
