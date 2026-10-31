import { useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api } from './api';

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

export default function TicketsPanel({ companyId, canCreate }: { companyId: string; canCreate: boolean }) {
  const [rows,setRows] = useState<Ticket[]>([]);
  const [loading,setLoading] = useState(false);
  const [status,setStatus] = useState<string>();
  const [open,setOpen] = useState(false);
  const [detail,setDetail] = useState<Ticket>();
  const [form] = Form.useForm();
  const [busy,setBusy] = useState(false);
  const [msg,contextHolder] = message.useMessage();

  async function load() {
    setLoading(true);
    try { setRows(await api<Ticket[]>(`/companies/${companyId}/tickets${status ? `?status=${status}` : ''}`)); }
    catch(e) { msg.error(e instanceof Error ? e.message : 'Gagal memuat ticket.'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ void load(); },[companyId,status]);

  async function createDraft() {
    const v = await form.validateFields();
    setBusy(true);
    try {
      await api(`/companies/${companyId}/tickets`, { method:'POST', body:JSON.stringify({
        ...v, amount:String(v.amount), currencyCode:v.currencyCode.toUpperCase()
      })});
      msg.success('Draft ticket berhasil dibuat.'); setOpen(false); form.resetFields(); await load();
    } catch(e) { msg.error(e instanceof Error ? e.message : 'Gagal membuat draft.'); }
    finally { setBusy(false); }
  }
  async function action(ticket: Ticket, verb: 'submit'|'cancel') {
    Modal.confirm({
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
      {(t.status==='DRAFT'||t.status==='RETURNED') && <Button size="small" type="primary" onClick={()=>void action(t,'submit')}>Submit</Button>}
      {(t.status==='DRAFT'||t.status==='SUBMITTED') && <Button size="small" danger onClick={()=>void action(t,'cancel')}>Cancel</Button>}
    </Space>}
  ];
  return <>
    {contextHolder}
    <Card className="panel" style={{marginBottom:20}} bordered={false} styles={{body:{padding:0}}}>
      <div className="panel-heading">
        <div><Typography.Title level={5} style={{margin:0}}>Treasury Ticket Management</Typography.Title><Typography.Text type="secondary">Buat draft, pantau status, dan kelola pengajuan treasury.</Typography.Text></div>
        <Space>
          <Select allowClear placeholder="Semua status" style={{width:155}} value={status} onChange={setStatus}
            options={['DRAFT','SUBMITTED','IN_REVIEW','RETURNED','APPROVED','REJECTED','IN_PROGRESS','COMPLETED','CANCELLED'].map(x=>({value:x,label:x.replaceAll('_',' ')}))}/>
          {canCreate && <Button type="primary" onClick={()=>{form.resetFields();form.setFieldsValue({type:'FINANCIAL_INVESTMENT',currencyCode:'IDR',priority:'NORMAL',amount:0});setOpen(true);}}>+ Buat pengajuan</Button>}
        </Space>
      </div>
      <div className="panel-body"><Table rowKey="id" columns={columns} dataSource={rows} loading={loading} pagination={{pageSize:8}} scroll={{x:900}} locale={{emptyText:'Belum ada pengajuan pada filter ini.'}} /></div>
    </Card>
    <Modal title="Buat draft Treasury Ticket" open={open} onCancel={()=>setOpen(false)} onOk={()=>void createDraft()} confirmLoading={busy} okText="Simpan draft" cancelText="Batal" destroyOnClose>
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
