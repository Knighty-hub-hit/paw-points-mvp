'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { languages, translate, type Locale } from '../lib/i18n';
import QRCode from 'qrcode';
import { cafes, cats } from '../data/seed';
import { localEntryAnalytics, qrTarget, resolveCafe } from '../lib/qr-entry';
import './qr-entry.css';
export function EntryTracker(){
  const pathname=usePathname();
  useEffect(()=>{
    const url=new URL(location.href), id=pathname.split('/').filter(Boolean)[1];
    const cat=pathname.startsWith('/cats/')?cats.find(c=>c.id===id):undefined;
    const pendingQr=pathname==='/' && document.cookie.split('; ').includes('paw-qr-entry=pawbrew');
    if(pendingQr){
      document.cookie='paw-qr-entry=; Path=/; Max-Age=0; SameSite=Lax';
      try{localStorage.setItem('paw-cafe-context','pawbrew')}catch{}
      void localEntryAnalytics.record({cafeId:'paw-macau',source:'QR',timestamp:new Date().toISOString()});
    }
    const cafe=pathname.replace(/\/$/,'')==='/enter'?resolveCafe(url.searchParams.get('cafe')||''):undefined;
    if(cafe || (cat && url.searchParams.get('source')==='qr')) void localEntryAnalytics.record({cafeId:(cafe?.id||cat!.cafeId),...(cat?{catId:cat.id}:{}),source:'QR',timestamp:new Date().toISOString()});
  },[pathname]);return null;
}
function useQrLanguage(){
  const [locale,setLocale]=useState<Locale>('zh-Hans');
  useEffect(()=>{const saved=localStorage.getItem('paw-points-language');if(languages.some(l=>l.code===saved))setLocale(saved as Locale)},[]);
  useEffect(()=>{document.documentElement.lang=locale},[locale]);
  const t=useCallback((key:string)=>translate(key,locale),[locale]);
  const languageControl=<label className="qr-language">{t('Language')}<select value={locale} onChange={e=>{const value=e.target.value as Locale;setLocale(value);localStorage.setItem('paw-points-language',value)}}>{languages.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}</select></label>;
  return {t,languageControl};
}
export function CafeEntry(){
  const {t,languageControl}=useQrLanguage();
  const [id,setId]=useState<string|null>(null);
  useEffect(()=>setId(new URL(location.href).searchParams.get('cafe')||''),[]);
  const cafe=resolveCafe(id||'');
  return <main className="qr-page"><div className="qr-header"><Link href="/">🐾 Paw Points</Link>{languageControl}</div>{id===null?<p>{t('Opening café…')}</p>:!cafe?<><h1>{t('Let’s find your café')}</h1><p>{t('This café link is unavailable. You can still meet our demo cats.')}</p><Link className="qr-button" href="/cats">{t('Explore cats')}</Link></>:<><p>{t('WELCOME TO')}</p><h1>{cafe.name}</h1><p>{t('Every Cat Has a Story. Every Fan Makes It Grow.')}</p><p>{t('Fictional café demo · No installation or registration needed.')}</p><div className="qr-grid">{cats.filter(c=>c.cafeId===cafe.id).map(c=><Link className="qr-button" key={c.id} href={'/cats/'+c.id+'?source=qr'}>{c.name} → {t('View Cat ID Card')}</Link>)}</div><div className="qr-grid">{[['/cat101','CAT 101 · Explore & vote'],['/cats','Cat ID Cards'],['/birthday','Birthday experiences'],['/shop','IP shop']].map(([href,label])=><Link className="qr-button" key={href} href={href}>{t(label)}</Link>)}</div><p>{t('Browse and vote in demo mode. Progress stays in this browser. Persistent accounts, cross-device progress, real purchases and confirmed bookings are not available in this MVP.')}</p></>}</main>;
}
export function QrGenerator(){
  const {t,languageControl}=useQrLanguage();
  const [selection,setSelection]=useState('cafe:pawbrew'),[png,setPng]=useState(''),[svg,setSvg]=useState(''),[error,setError]=useState('');
  const [kind,id]=selection.split(':');
  let target='';try{target=qrTarget(kind,id)}catch{/* Shown below */}
  useEffect(()=>{let active=true;setPng('');setSvg('');if(!target){setError('Configure NEXT_PUBLIC_SITE_URL with a valid URL.');return}setError('');Promise.all([QRCode.toDataURL(target,{width:1024,margin:4,errorCorrectionLevel:'M'}),QRCode.toString(target,{type:'svg',margin:4,errorCorrectionLevel:'M'})]).then(([p,s])=>{if(active){setPng(p);setSvg(s)}}).catch(()=>{if(active)setError('QR generation failed. Please retry.')});return()=>{active=false}},[target]);
  const printable=target.startsWith('https://')&&!/https:\/\/(localhost|127\.|\[::1\])/.test(target);
  return <main className="qr-page"><div className="qr-header"><Link href="/">🐾 Paw Points</Link>{languageControl}</div><h1>{t('QR studio')}</h1><p>{t('Create a doorway to your café.')}</p><label>{t('Destination')}<select value={selection} onChange={e=>setSelection(e.target.value)}><optgroup label={t('Cafés')}>{cafes.map(c=><option key={c.id} value={'cafe:'+(c.id==='paw-macau'?'pawbrew':c.id)}>{c.name}</option>)}</optgroup><optgroup label={t('Cats')}>{cats.map(c=><option key={c.id} value={'cat:'+c.id}>{c.name}</option>)}</optgroup></select></label><p className="qr-url">{target}</p>{error&&<p role="alert">{t(error)}</p>}{png&&<img className="qr-code" src={png} alt={t('QR code for')+' '+target} width={280} height={280}/>}<p>{t(printable?'HTTPS configured. Verify public access and scan on a phone before printing.':'Local development only — do not print. Set NEXT_PUBLIC_SITE_URL to the actual public HTTPS deployment and rebuild.')}</p><div className="qr-grid">{png&&<a className="qr-button" download={id+'.png'} href={png}>{t('Download PNG')}</a>}{svg&&<a className="qr-button" download={id+'.svg'} href={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)}>{t('Download SVG')}</a>}</div><p>{t('In WeChat, if downloading is blocked, open this page in Safari or Chrome. Entry events are local demo data, not cross-device analytics.')}</p></main>;
}
