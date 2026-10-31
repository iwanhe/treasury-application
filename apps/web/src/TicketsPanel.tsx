import { useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api } from './api';
import { canEditTicket, canCancelTicket, canSubmitTicket } from './ticket-permissions';

type PendingApproval = { id:string; sequence:number; roleCode:string|null; decision:string; ticket:Ticket };
type Ticket = {
  id: string; ticketNo: string; companyId: string; requesterId: string; type: string; title: string;
  description: string; amount: string; currencyCode: string; status: string; priority: string;
  createdAt: string; submittedAt?: string | null;
  approvals?: { id: string; sequence: number; roleCode: string | null; decision: string; comments?: string | null }[];
};
const types = ['BANK_ACCOUNT_OPEN','BANK_ACCOUNT_CLOSE','INTERNET_BANKING','FINANCIAL_INVESTMENT','FX_DEAL','FUNDING_LOAN','FACILITY_EXTENSION','OTHER']
  .map(value => ({ value, label: value.replaceAll('_',' ') }));
const priorities = ['LOW','NORMAL','HIGH','URGENT'].map(value => ({ value, label: value }));
const statusColor: Record<string,string> = { DRAFT:'default', SUBMITTED:'processing', IN_REVIEW:'blue', APPROVED:'success', REJECTED:'error', RETURNED:'warning', COMPLETED:'success', CANCELLED:'default', IN_PROGRESS:'cyan' };

export default function TicketsPanel({ companyId, canCreate, canApprove }: { companyId: string; canCreate: boolean; canApprove: boolean }) {
  const [rows,setRows] = useState<Ticket[]>([]);
  const [inbox,setInbox] = useState<PendingApproval[]>([]);
  const [inboxLoading,setInboxLoading] = useState(false);
  const [loading,setLoading] = useState(false);
  const [status,setStatus] = useState<string>();
  const [open,setOpen] = useState(false);
  const [editingTicket,setEditingTicket] = useState<Ticket>();
  const [detail,setDetail] = useState<Ticket>();
  const [form] = Form.useForm();
  const [busy,setBusy] = useState(false);
  const [msg,contextHolder] = message.useMessage();
  // Static Modal.confirm does not render under React 19 with antd v5; use the context-aware hook.
  const [modal,modalContextHolder] = Modal.useModal();

  async function load() {
    setLoading(true);
    try { setRows(await api<Ticket[]>(`/companies/${companyId}/tickets${status ? `?status=${status}` : ''}`)); }
    catch(e) { msg.error(e instanceof Error ? e.message : 'Gagal memuat ticket.'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ void load(); },[companyId,status]);
  async function loadInbox() {
    if (!canApprove) return;
    setInboxLoading(true);
    try { setInbox(await api<PendingApproval[]>('/companies/' + companyId + '/approvals/pending')); }
    catch(e) { msg.error(e instanceof Error ? e.message : 'Gagal memuat approval inbox.'); }
    finally { setInboxLoading(false); }
  }
  useEffect(()=>{ void loadInbox(); },[companyId,canApprove]);
  async function decide(item: PendingApproval, decision:'APPROVED'|'REJECTED'|'RETURNED') {
    const labels = { APPROVED:'Setujui', REJECTED:'Tolak', RETURNED:'Kembalikan' };
    modal.confirm({ title:labels[decision] + ' pengajuan?', content:item.ticket.ticketNo + ' — ' + item.ticket.title,
      okText:labels[decision], cancelText:'Batal', okButtonProps:decision === 'REJECTED' ? {danger:true} : {},
      onOk:async () => {
        await api('/companies/' + companyId + '/tickets/' + item.ticket.id + '/approvals/' + item.id + '/decision',
          {method:'POST',body:JSON.stringify({decision})});
        msg.success('Keputusan approval berhasil disimpan.');
        await Promise.all([loadInbox(),load()]);
      }
    });
  }

  async function saveDraft() {
    const v = await form.validateFields();
    setBusy(true);
    try {
      const payload = {
        ...v, amount:String(v.amount), currencyCode:v.currencyCode.toUpperCase()
      };
      if (editingTicket) {
        await api('/companies/' + companyId + '/tickets/' + editingTicket.id, { method:'PATCH', body:JSON.stringify(payload) });
        msg.success('Draft ticket berhasil diperbarui.');
      } else {
        await api('/companies/' + companyId + '/tickets', { method:'POST', body:JSON.stringify(payload) });
        msg.success('Draft ticket berhasil dibuat.');
      }
      setOpen(false); setEditingTicket(undefined); form.resetFields(); await load();
    } catch(e) { msg.error(e instanceof Error ? e.message : 'Gagal membuat draft.'); }
    finally { setBusy(false); }
  }
  async function action(ticket: Ticket, verb: 'submit'|'cancel') {
    modal.confirm({
      title: verb === 'submit' ? 'Submit pengajuan?' : 'Batalkan pengajuan?',
      content: ticket.ticketNo,
      okText: verb === 'submit' ? 'Submit' : 'Batalkan',
      cancelText:'Kembali',
      onOk: async () => {
        await api(`/companies/${companyId}/tickets/${ticket.id}/${verb}`, {method:'POST'});
        msg.success(verb === 'submit' ? 'Pengajuan dikirim untuk approval.' : 'Pengajuan dibatalkan.');
        await load();
      }
    });
  }
  function editDraft(ticket: Ticket) {
    setEditingTicket(ticket);
    form.setFieldsValue({ type:ticket.type, title:ticket.title, description:ticket.description, amount:Number(ticket.amount), currencyCode:ticket.currencyCode.trim(), priority:ticket.priority });
    setOpen(true);
  }
  async function showDetail(ticket: Ticket) {
    try { setDetail(await api<Ticket>(`/companies/${companyId}/tickets/${ticket.id}`)); }
    catch(e) { msg.error(e instanceof Error ? e.message : 'Gagal memuat detail.'); }
  }
  const columns: ColumnsType<Ticket> = [
    {title:'Nomor ticket',dataIndex:'ticketNo',width:190,render:(v:string,t)=> <Button type="link" onClick={()=>void showDetail(t)}>{v}</Button>},
    {title:'Pengajuan',dataIndex:'title',render:(v:string,t)=><><Typography.Text strong>{v}</Typography.Text><div className="subtle">{t.type.replaceAll('_',' ')}</div></>},
    {title:'Nominal',render:(_,t)=><Typography.Text>{t.currencyCode.trim()} {Number(t.amount).toLocaleString('id-ID')}</Typography.Text>},
    {title:'Status',dataIndex:'status',render:(v:string)=><Tag color={statusColor[v] ?? 'default'}>{v.replaceAll('_',' ')}</Tag>},
    {title:'Tanggal',dataIndex:'createdAt',render:(v:string)=>new Date(v).toLocaleDateString('id-ID')},
    {title:'Aksi',width:170,render:(_,t)=><Space>
      {canEditTicket(t.status) && <Button size="small" onClick={()=>editDraft(t)}>Edit</Button>}
      {canSubmitTicket(t.status) && <Button size="small" type="primary" onClick={()=>void action(t,'submit')}>Submit</Button>}
      {canCancelTicket(t.status) && <Button size="small" danger onClick={()=>void action(t,'cancel')}>Cancel</Button>}
    </Space>}
  ];
  const inboxColumns: ColumnsType<PendingApproval> = [
    {title:'Nomor ticket',dataIndex:['ticket','ticketNo'],width:185},
    {title:'Pengajuan',render:(_,a)=><><Typography.Text strong>{a.ticket.title}</Typography.Text><div className="subtle">{a.ticket.type.replaceAll('_',' ')} · Step {a.sequence}</div></>},
    {title:'Nominal',render:(_,a)=><Typography.Text>{a.ticket.currencyCode.trim()} {Number(a.ticket.amount).toLocaleString('id-ID')}</Typography.Text>},
    {title:'Requester',dataIndex:['ticket','requesterId'],render:(v:string)=>v.slice(0,8)+'…'},
    {title:'Keputusan',render:(_,a)=><Space>
      <Button size="small" type="primary" onClick={()=>void decide(a,'APPROVED')}>Approve</Button>
      <Button size="small" danger onClick={()=>void decide(a,'REJECTED')}>Reject</Button>
      <Button size="small" onClick={()=>void decide(a,'RETURNED')}>Return</Button>
    </Space>}
  ];
  return <>
    {contextHolder}
    {modalContextHolder}
    {canApprove && <Card className="panel" style={{marginBottom:20}} bordered={false} styles={{body:{padding:0}}}>
      <div className="panel-heading"><div><Typography.Title level={5} style={{margin:0}}>Approval Inbox</Typography.Title><Typography.Text type="secondary">Pengajuan yang menunggu keputusan Anda pada perusahaan ini.</Typography.Text></div><Tag color="processing">{inbox.length} pending</Tag></div>
      <div className="panel-body"><Table rowKey="id" columns={inboxColumns} dataSource={inbox} loading={inboxLoading} pagination={{pageSize:5}} scroll={{x:850}} locale={{emptyText:'Tidak ada approval yang menunggu.'}} /></div>
    </Card>}
    <Card className="panel" style={{marginBottom:20}} bordered={false} styles={{body:{padding:0}}}>
      <div className="panel-heading">
        <div><Typography.Title level={5} style={{margin:0}}>Treasury Ticket Management</Typography.Title><Typography.Text type="secondary">Buat draft, pantau status, dan kelola pengajuan treasury.</Typography.Text></div>
        <Space>
          <Select allowClear placeholder="Semua status" style={{width:155}} value={status} onChange={setStatus}
            options={['DRAFT','SUBMITTED','IN_REVIEW','RETURNED','APPROVED','REJECTED','IN_PROGRESS','COMPLETED','CANCELLED'].map(x=>({value:x,label:x.replaceAll('_',' ')}))}/>
          {canCreate && <Button type="primary" onClick={()=>{setEditingTicket(undefined);form.resetFields();form.setFieldsValue({type:'FINANCIAL_INVESTMENT',currencyCode:'IDR',priority:'NORMAL',amount:0});setOpen(true);}}>+ Buat pengajuan</Button>}
        </Space>
      </div>
      <div className="panel-body"><Table rowKey="id" columns={columns} dataSource={rows} loading={loading} pagination={{pageSize:8}} scroll={{x:900}} locale={{emptyText:'Belum ada pengajuan pada filter ini.'}} /></div>
    </Card>
    <Modal title={editingTicket ? "Edit " + editingTicket.ticketNo : "Buat draft Treasury Ticket"} open={open} onCancel={()=>{setOpen(false);setEditingTicket(undefined);}} onOk={()=>void saveDraft()} confirmLoading={busy} okText={editingTicket ? "Simpan perubahan" : "Simpan draft"} cancelText="Batal" destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item name="type" label="Jenis pengajuan" rules={[{required:true}]}><Select options={types}/></Form.Item>
        <Form.Item name="title" label="Judul" rules={[{required:true,min:3,max:200}]}><Input maxLength={200}/></Form.Item>
        <Form.Item name="description" label="Deskripsi / kebutuhan" rules={[{required:true,min:1,max:10000}]}><Input.TextArea rows={4} maxLength={10000}/></Form.Item>
        <Row gutter={12}><Col span={12}><Form.Item name="amount" label="Nominal" rules={[{required:true}]}><InputNumber min={0} precision={2} style={{width:'100%'}}/></Form.Item></Col>
          <Col span={12}><Form.Item name="currencyCode" label="Mata uang" rules={[{required:true,pattern:/^[A-Za-z]{3}$/}]}><Input maxLength={3}/></Form.Item></Col></Row>
        <Form.Item name="priority" label="Prioritas"><Select options={priorities}/></Form.Item>
      </Form>
    </Modal>
    <Modal title={detail?.ticketNo ?? 'Detail ticket'} open={Boolean(detail)} onCancel={()=>setDetail(undefined)} footer={<Button onClick={()=>setDetail(undefined)}>Tutup</Button>} width={720}>
      {detail && <><Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="Judul" span={2}>{detail.title}</Descriptions.Item>
        <Descriptions.Item label="Jenis">{detail.type.replaceAll('_',' ')}</Descriptions.Item>
        <Descriptions.Item label="Status"><Tag color={statusColor[detail.status]}>{detail.status}</Tag></Descriptions.Item>
        <Descriptions.Item label="Nominal">{detail.currencyCode.trim()} {Number(detail.amount).toLocaleString('id-ID')}</Descriptions.Item>
        <Descriptions.Item label="Prioritas">{detail.priority}</Descriptions.Item>
        <Descriptions.Item label="Dibuat">{new Date(detail.createdAt).toLocaleString('id-ID')}</Descriptions.Item>
        <Descriptions.Item label="Deskripsi" span={2}>{detail.description}</Descriptions.Item>
      </Descriptions>
      {detail.approvals?.length ? <div style={{marginTop:18}}><Typography.Text strong>Riwayat approval</Typography.Text>{detail.approvals.map(a=><div className="sim-step" key={a.id}><span className="sequence-number">{a.sequence}</span><span style={{flex:1}}>{a.roleCode ?? 'Named approver'}</span><Tag>{a.decision}</Tag>{a.comments && <Typography.Text type="secondary">{a.comments}</Typography.Text>}</div>)}</div> : null}
      </>}
    </Modal>
  </>;
}
