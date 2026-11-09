import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Company={id:string;name:string;description:string;cover_url:string|null;theme:{id?:string}|null;is_active:boolean}
export default function CompanySettings({isOwner,companyId,hideSelector=false,readOnly=false}:{isOwner:boolean;companyId?:string;hideSelector?:boolean;readOnly?:boolean}) {
  const [companies,setCompanies]=useState<Company[]>([])
  const [selectedId,setSelectedId]=useState(companyId??'')
  const [name,setName]=useState('')
  const [description,setDescription]=useState('')
  const [coverUrl,setCoverUrl]=useState('')
  const [theme,setTheme]=useState('natural')
  const [active,setActive]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')

  useEffect(()=>{
    if(!notice)return
    const timeout=window.setTimeout(()=>setNotice(''),3000)
    return ()=>window.clearTimeout(timeout)
  },[notice])
  const [busy,setBusy]=useState(false)

  useEffect(()=>{
    if(!supabase)return
    supabase.from('companies').select('id,name,description,cover_url,theme,is_active').order('name')
      .then(({data,error:queryError})=>{if(queryError)setError(queryError.message);else setCompanies((data??[]) as Company[])})
  },[])
  useEffect(()=>{if(companyId)setSelectedId(companyId)},[companyId])
  useEffect(()=>{
    const company=companies.find(item=>item.id===selectedId)
    if(company){setName(company.name);setDescription(company.description);setCoverUrl(company.cover_url??'');setTheme(company.theme?.id??'natural');setActive(company.is_active)}
  },[companies,selectedId])

  async function save(){
    if(!supabase||!selectedId)return
    setBusy(true);setError('');setNotice('')
    const payload={name:name.trim(),description,cover_url:coverUrl.trim()||null,theme:{id:theme},...(isOwner?{is_active:active}:{})}
    const {error:updateError}=await supabase.from('companies').update(payload).eq('id',selectedId)
    if(updateError)setError(updateError.message)
    else{
      setNotice('Настройки компании сохранены.')
      setCompanies(items=>items.map(item=>item.id===selectedId?{...item,...payload}:item))
    }
    setBusy(false)
  }

  return <section className="admin-card workspace-section">
    <h3>Страница и оформление компании</h3>
    {isOwner&&!hideSelector&&<label className="admin-field">Компания<select value={selectedId} onChange={e=>setSelectedId(e.target.value)}><option value="">Выберите компанию</option>{companies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    <label className="admin-field">Название<input value={name} onChange={e=>setName(e.target.value)} required disabled={readOnly}/></label>
    <label className="admin-field">Описание<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} disabled={readOnly}/></label>
    <label className="admin-field">URL обложки<input value={coverUrl} onChange={e=>setCoverUrl(e.target.value)} placeholder="https://…" disabled={readOnly}/></label>
    <label className="admin-field">Общая цветовая тема<select value={theme} onChange={e=>setTheme(e.target.value)} disabled={readOnly}><option value="natural">Natural</option><option value="graphite">Graphite</option><option value="sand">Sand</option><option value="green">Deep Green</option><option value="blue">Midnight Blue</option><option value="dark">Dark</option></select></label>
    {isOwner&&<label className="admin-field"><span>Компания активна</span><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/></label>}
    {error&&<p className="admin-error">{error}</p>}{notice&&<p className="admin-notice">{notice}</p>}
    {!readOnly&&<button className="primary-button" disabled={busy||!selectedId} onClick={()=>void save()}>{busy?'Сохраняем…':'Сохранить настройки'}</button>}
  </section>
}
