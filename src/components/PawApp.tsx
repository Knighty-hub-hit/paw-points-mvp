'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Check, Globe2, Home, MapPin, PawPrint, ShoppingBag, Trophy, User } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { languages, translate, type Locale } from '../lib/i18n';
import { cats } from '../data/seed';
import { usePawStore } from '../store/usePawStore';
import { initial, requiresAccount } from '../lib/engine';
import { CatRoom, CreditsPage, DemoAuth, LoginPrompt } from './Round4';
import type { Command } from '../lib/engine';
import { DemoContext } from './DemoContext';
import { mirror, refreshLive } from '../lib/bridge';
import { CatsPage, CatPage, CompetitionPage } from './Discovery';
import { VirtualPet } from './VirtualPet';
import { FansPage, CreditsInfo } from './Round3';
import { BrandHome } from './BrandHome';
import { CatWorld, LivePage, StoriesPage } from './World';
import { infoPages } from '../data/info';
import { InfoPage } from './Info';
import { PawGuide } from './PawGuide';
import { BirthdayPage, ShopPage } from './Experiences';
import { CompanionPage, RewardsPage, ProfilePage } from './Account';
export default function PawApp(){
  const [locale,setLocale]=useState<Locale>('zh-Hans'),[ready,setReady]=useState(false),[toast,setToast]=useState(''),[loginPrompt,setLoginPrompt]=useState(false);
  const {data,dispatch}=usePawStore();
  const s=data.demoSignedIn?data:{...initial(),petScenes:data.petScenes,petHistory:data.petHistory};
  const rawPath=usePathname(),path=rawPath.replace(/\/$/,'')||'/';
  const t=useCallback((key:string)=>translate(key,locale),[locale]);
  useEffect(()=>{const saved=localStorage.getItem('paw-points-language');if(languages.some(l=>l.code===saved))setLocale(saved as Locale);setReady(true)},[]);
  useEffect(()=>{document.documentElement.lang=locale},[locale]);
  useEffect(()=>{refreshLive();const timer=setInterval(refreshLive,30000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{if(toast){const timer=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(timer)}},[toast]);
  useEffect(()=>{setToast('')},[path]);
  const notify=(text:string)=>{setToast('');setTimeout(()=>setToast(text),0)};
  const action=(command:Command,success='Saved. A little closer, together.',id?:string)=>{
    if(requiresAccount(command)&&!data.demoSignedIn){setLoginPrompt(true);return false}
    try{dispatch(command,id);if(success)notify(success);mirror(command,usePawStore.getState().data).then(error=>{if(error)notify('Not saved to the live board: '+error)});return true}catch(e){notify((e as Error).message);return false}
  };
  const share=async(catId:string)=>{
    const base=process.env.NEXT_PUBLIC_BASE_PATH??'';
    const url=location.origin+base+'/cats/'+catId+'/';
    try{await navigator.clipboard.writeText(url);notify('Profile link copied')}catch{if(navigator.share){try{await navigator.share({title:'Paw Points · '+cats.find(c=>c.id===catId)?.name,url});notify('Profile shared')}catch{notify('Sharing cancelled')}}else{window.prompt(t('Copy this profile link'),url)}}
  };
  const nav=[{href:'/',name:'Home',Icon:Home},{href:'/cat-room',name:'Cat Room',Icon:PawPrint},{href:'/cat101',name:'CAT 101',Icon:Trophy},{href:'/shop',name:'Shop',Icon:ShoppingBag},{href:'/profile',name:'Profile',Icon:User}];
  const active=(href:string)=>href==='/cats'?path.startsWith('/cats'):path===href;
  const cat=cats.find(c=>path==='/cats/'+c.id);
  if(!ready)return <main className="loading"><PawPrint/><span>{t('Opening your little world of paws…')}</span></main>;
  return <MotionConfig reducedMotion="user"><DemoContext.Provider value={{s,t,locale,action,notify,share}}><header className="site-header"><Link className="brand" href="/"><span className="brand-symbol"><PawPrint size={23}/></span>Paw Points<span className="brand-dot">.</span></Link><nav aria-label={t('Main navigation')}>{nav.map(({href,name})=><Link key={href} href={href} className={active(href)?'active':''}>{t(name)}</Link>)}</nav><div className="header-tools"><label className="language-switch"><Globe2 size={16}/><span className="sr-only">{t('Language')}</span><select aria-label={t('Language')} value={locale} onChange={e=>{const value=e.target.value as Locale;setLocale(value);localStorage.setItem('paw-points-language',value)}}>{languages.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}</select></label>{data.demoSignedIn?<button className="text-link auth-entry" onClick={()=>action({type:'demo-logout'},'')}>{t('Log out')}</button>:<Link className="text-link auth-entry" href={'/login?next='+encodeURIComponent(path+window.location.search)}>{t('Log in / Sign up')}</Link>}<Link className="balance" href="/credits"><PawPrint size={15}/>{s.points}<small>{t('Credits')}</small></Link><CreditsInfo/></div></header>
  <main className="app-main"><div className="location"><span><MapPin size={13}/>{t('THE PAW NEIGHBOURHOOD')}</span><span className="demo-label">{t('FICTIONAL DEMO · LOCAL DATA')}</span></div>
  <motion.div key={path} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.24}}>
    {path==='/cat-room'?<CatRoom/>:path==='/credits'?<CreditsPage/>:path==='/login'||path==='/signup'?<DemoAuth signup={path==='/signup'}/>:path.startsWith('/virtual-pet/')?<VirtualPet catId={path.split('/')[2]}/>:path==='/leaderboard/fans'?<FansPage/>:path==='/'?<BrandHome/>:path==='/cafes'?<CatWorld/>:path.startsWith('/cafes/')?<CatWorld cafeId={path.split('/')[2]}/>:path==='/live'?<LivePage/>:path==='/stories'||path.startsWith('/stories/')?<StoriesPage storyId={path.split('/')[2]}/>:infoPages[path.slice(1)]?<InfoPage page={path.slice(1)}/>:path==='/cats'?<CatsPage/>:cat?<CatPage cat={cat}/>:path==='/cat101'?<CompetitionPage/>:path==='/birthday'?<BirthdayPage/>:path==='/shop'||path==='/menu'?<ShopPage/>:path==='/companion'?<CompanionPage/>:path==='/rewards'?<RewardsPage/>:path.startsWith('/cats/')?<section><h1>{t('Cat not found')}</h1><p>{t('This cat link is unavailable.')}</p><Link href='/cats'>{t('Meet the cats')}</Link></section>:<ProfilePage/>}
  </motion.div>
  <footer><div><Link className="brand" href="/"><PawPrint size={22}/> Paw Points.</Link><p>{t('Every Cat Has a Story. Every Fan Makes It Grow.')}</p></div><div className="footer-links">{[['/cat-room','Cat Room'],['/credits','Affinity & Credits'],['/about','About Paw Points'],['/cats','Cat ID'],['/cat101','CAT 101'],['/birthday','Paw Birthday'],['/shop','Shop'],['/cafes','Cafés'],['/stories','Paw Journal'],['/live','Live Cat World'],['/contact','Contact'],['/privacy','Privacy'],['/terms','Terms'],['/qr-generator','QR studio']].map(([href,name])=><Link href={href} key={href}>{t(name)}<ArrowUpRight size={14}/></Link>)}</div><small>{t('Fictional café and sample cat identities. No real payments, bookings, care delivery, shipping or adoption. All data stays in this browser.')}</small></footer></main>
  <nav className="mobile-nav" aria-label={t('Mobile navigation')}>{nav.map(({href,name,Icon})=><Link href={href} key={href} className={active(href)?'active':''}><Icon size={21}/><span>{t(name)}</span></Link>)}</nav>
  <AnimatePresence>{toast&&<motion.div key={toast} initial={{opacity:0,y:20,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:15}} className="toast" role="status"><Check size={20}/><span>{t(toast)}</span></motion.div>}</AnimatePresence>
  {loginPrompt&&<LoginPrompt close={()=>setLoginPrompt(false)} path={path+(typeof window!=='undefined'?window.location.search:'')}/>}<PawGuide/></DemoContext.Provider></MotionConfig>
}
