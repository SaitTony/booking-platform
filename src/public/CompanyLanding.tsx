import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type Company = { id:string; name:string; slug:string; description:string; cover_url:string|null; theme:{id?:string}|null }
type Master = { id:string; display_name:string; slug:string; public_description:string; photo_url:string|null }

export default function CompanyLanding() {
  const { companySlug } = useParams()
  const [company,setCompany]=useState<Company|null>(null)
  const [masters,setMasters]=useState<Master[]>([])
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    if(!supabase||!isSupabaseConfigured){setLoading(false);return}
    let cancelled=false
    async function load(){
      const {data:companyData,error:companyError}=await supabase!.from('companies')
        .select('id,name,slug,description,cover_url,theme').eq('slug',companySlug??'').eq('is_active',true).maybeSingle()
      if(companyError)throw companyError
      if(!companyData)throw new Error('Компания не найдена или временно недоступна')
      const {data:masterData,error:masterError}=await supabase!.from('masters')
        .select('id,display_name,slug,public_description,photo_url').eq('company_id',companyData.id)
        .eq('kind','company').eq('is_active',true).is('archived_at',null).order('display_name')
      if(masterError)throw masterError
      if(!cancelled){setCompany(companyData as Company);setMasters((masterData??[]) as Master[])}
    }
    load().catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Не удалось загрузить компанию')})
      .finally(()=>{if(!cancelled)setLoading(false)})
    return ()=>{cancelled=true}
  },[companySlug])

  if(!isSupabaseConfigured)return <main className="home-shell"><div className="home-card"><h1>Supabase не подключён</h1><Link to="/">На главную</Link></div></main>
  if(loading)return <main className="booking-shell"><div className="admin-card">Загрузка…</div></main>
  if(error||!company)return <main className="booking-shell"><div className="admin-card"><h1>Компания недоступна</h1><p>{error}</p><Link to="/">На главную</Link></div></main>

  return <main className="booking-shell" data-theme={company.theme?.id??'natural'}>
    <header className="topbar"><Link to="/" className="brand"><span className="brand-mark">b.</span><span>booking<span className="brand-light">space</span></span></Link><span className="demo-label"><i/> ОНЛАЙН-ЗАПИСЬ</span></header>
    <section className="company-hero"><div className="company-cover-art">{company.cover_url?<img src={company.cover_url} alt={company.name}/>:<span>{company.name}</span>}</div><div><span className="eyebrow">КОМПАНИЯ</span><h1>{company.name}</h1><p>{company.description}</p><div className="master-meta"><span>✦ {masters.length} специалистов</span><span>Онлайн-запись</span></div></div></section>
    <section className="company-content"><div className="section-heading"><div><span className="eyebrow">НАША КОМАНДА</span><h2>Выберите своего мастера</h2></div></div>
      {masters.length?<div className="team-grid">{masters.map(master=><Link to={'/'+company.slug+'/'+master.slug} className="team-card" key={master.id}><div className="team-image">{master.photo_url?<img src={master.photo_url} alt={master.display_name}/>:master.display_name.slice(0,1)}</div><div className="team-copy"><strong>{master.display_name}</strong><p>{master.public_description}</p><b>Перейти к записи →</b></div></Link>)}</div>:<p className="demo-note">Страницы мастеров пока не опубликованы.</p>}
    </section>
  </main>
}
