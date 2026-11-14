import { cats, cafes, products, eventPackages, rewards } from '../data/seed';
import { roomRules } from './round4';
import { rules, carePackages, themes } from './config';
import type { DemoState, VoteAllocation, CompetitionSeason, BirthdayBooking } from './models';
export const levels = rules.levels;
export const level = (xp: number) => levels.filter(value => xp >= value).length;
export const dayKey = (now = new Date()) => now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Macau' });
export const weekIndex = (day: string) => Math.floor((Date.parse(day + 'T00:00:00Z') / 86400000 + 3) / 7);
export function seasonAt(now = new Date()): CompetitionSeason {
  const day = dayKey(now), [y,m] = day.split('-').map(Number);
  return {id:day.slice(0,7),name:day.slice(0,7),startsAt:`${day.slice(0,7)}-01T00:00:00+08:00`,endsAt:new Date(Date.UTC(y,m,1,-8)).toISOString(),sponsor:null};
}
export const initial = (): DemoState => ({demoSignedIn:false,affinity:0,affinityLedger:[],experienceRequests:[],user:{id:'alex-demo',name:'Alex',birthday:''},points:0,primary:'',cats:{},pointsLedger:[],bondLedger:[],votes:[],bookings:[],orders:[],careOrders:[],redemptions:[],wallet:[],visits:[],cart:{},done:[],firstFollowAwarded:false,weeklyBonuses:[],badges:[]});
export type State = DemoState;
export type Command =
  | {type:'demo-login'|'demo-logout'}
  | {type:'room-interact';catId:string;action:import('./models').RoomAction}
  | {type:'convert-affinity';amount:number}
  | {type:'request-experience';catId:string;minutes:number}
  | {type:'cancel-experience';requestId:string}
  | {type:'follow'|'unfollow'|'primary'|'vote'|'checkin'|'interaction';catId:string}
  | {type:'care';catId:string;packageId:string}
  | {type:'cart';productId:string;quantity:number}
  | {type:'pet';catId:string;action:import('./models').PetAction;scene:import('./models').PetScene}
  | {type:'pet-scene';catId:string;scene:import('./models').PetScene}
  | {type:'checkout'}
  | {type:'birthday';birthday:string}
  | {type:'book';packageId:string;date:string;guests:number;cafeId:string;theme:string}
  | {type:'confirm-event';bookingId:string}
  | {type:'referral'}
  | {type:'redeem';rewardId:string;catId:string};
export function remainingVotes(s: DemoState, now = new Date()) {
  return Math.max(0, rules.votesPerDay - s.votes.filter(v => v.day === dayKey(now)).length);
}
// Replace this pure adapter with a server-authoritative implementation for global voting.
export interface VotingService {
  remaining(state: DemoState, now?: Date): number;
  rankings(state: DemoState, now?: Date): VoteAllocation[];
  cast(state: DemoState, catId: string, id: string, now?: Date): DemoState;
}
// live: season vote totals from the ops sheet; when present they replace seed plus local votes.
export function rankings(s: DemoState, now = new Date(), live?: Record<string, {votes:number}> | null): VoteAllocation[] {
  const season = seasonAt(now).id;
  return cats.map(cat => ({catId:cat.id,total:live?live[cat.id]?.votes??0:cat.seedVotes+s.votes.filter(v=>v.catId===cat.id&&v.seasonId===season).length,rank:0}))
    .sort((a,b)=>b.total-a.total||a.catId.localeCompare(b.catId)).map((row,i)=>({...row,rank:i+1}));
}
export const localVotingService: VotingService = {remaining:remainingVotes,rankings,cast:(s,catId,id,now)=>act(s,{type:'vote',catId},id,now)};
export const requiresAccount = (command:Command) => !['demo-login','demo-logout','pet','pet-scene','room-interact'].includes(command.type);
export function act(state: DemoState, command: Command, id: string, now = new Date()): DemoState {
  if (!id || state.done.includes(id)) throw Error('Already completed');
  if(requiresAccount(command)&&!state.demoSignedIn)throw Error('Sign in to save progress, earn Credits and make demo requests.');
  const s = structuredClone(state), date = dayKey(now);
  const catId = 'catId' in command ? command.catId : '';
  if ('catId' in command && !cats.some(c=>c.id===catId)) throw Error('Unknown cat');
  const relationship = () => {if (!s.cats[catId]?.active) throw Error('Follow a cat first'); return s.cats[catId];};
  const points = (amount:number,label:string,reference=id,simulated=false) => {
    if (!Number.isInteger(amount)||s.points+amount<0) throw Error('Insufficient points');
    s.points += amount;
    if(amount) s.pointsLedger.unshift({id:`${id}-pp`,amount,label,date,simulated,reference});
  };
  const bond = (amount:number,label:string) => {
    relationship().xp += amount;
    s.bondLedger.unshift({id:`${id}-${label}`,catId,amount,label,date});
  };
  switch (command.type) {
    case 'demo-login': s.demoSignedIn=true;break;
    case 'demo-logout': s.demoSignedIn=false;break;
    case 'room-interact': {
      if(!['pet','play','seek','feed','rest'].includes(command.action))throw Error('Invalid interaction');
      // Guests preview reactions without any account mutations. Rest never earns progress.
      if(!s.demoSignedIn||command.action==='rest')break;
      const earned=(s.affinityLedger??[]).filter(v=>v.kind==='earn'&&v.date===date);
      if(earned.some(v=>v.catId===catId&&v.action===command.action)||earned.length>=roomRules.dailyMoments)break;
      s.affinity=(s.affinity??0)+roomRules.affinityPerMoment;
      s.affinityLedger=[{id,catId,action:command.action,amount:roomRules.affinityPerMoment,date,kind:'earn'},...(s.affinityLedger??[])];
      s.cats[catId]??={catId,xp:0,active:false,since:date};
      s.cats[catId].xp+=roomRules.affinityPerMoment;
      s.bondLedger.unshift({id:id+'-room',catId,amount:roomRules.affinityPerMoment,date,label:'Cat Room affinity'});
      break;
    }
    case 'convert-affinity': {
      const amount=command.amount,credits=amount*roomRules.creditsPerAffinity;
      if(!Number.isSafeInteger(amount)||amount<=0||amount>(s.affinity??0)||!Number.isSafeInteger(credits)||!Number.isSafeInteger(s.points+credits))throw Error('Invalid Affinity amount');
      s.affinity=(s.affinity??0)-amount;
      s.affinityLedger=[{id,catId:'',amount:-amount,date,kind:'convert'},...(s.affinityLedger??[])];
      points(credits,'Demo Affinity conversion',id,true);break;
    }
    case 'request-experience': {
      const minutes=command.minutes,cost=minutes*roomRules.creditsPerMinute;
      if(!Number.isSafeInteger(minutes)||minutes<1||minutes>roomRules.maxMinutes)throw Error('Invalid duration');
      points(-cost,'Staff-guided experience request',id,true);
      s.experienceRequests=[{id,catId,cafeId:cats.find(c=>c.id===catId)!.cafeId,minutes,cost,date,status:'awaiting-staff'},...(s.experienceRequests??[])];break;
    }
    case 'cancel-experience': {
      const request=s.experienceRequests?.find(v=>v.id===command.requestId);
      if(!request||request.status!=='awaiting-staff')throw Error('Already completed');
      request.status='cancelled-refunded';points(request.cost,'Experience cancellation refund',request.id,true);break;
    }

    case 'pet-scene':
      if (!['cafe','garden','bedroom','night'].includes(command.scene)) throw Error('Invalid scene');
      s.petScenes = {...s.petScenes,[catId]:command.scene};break;
    case 'pet':
      if (!['pet','play','treat','talk'].includes(command.action)||!['cafe','garden','bedroom','night'].includes(command.scene)) throw Error('Invalid interaction');
      s.petHistory = [{id,catId,action:command.action,scene:command.scene,date:now.toISOString()},...(s.petHistory??[])].slice(0,60);
      break;
    case 'follow':
      if (s.cats[catId]?.active) throw Error('Already following');
      s.cats[catId] = {catId,xp:s.cats[catId]?.xp??0,active:true,since:s.cats[catId]?.since??date};
      if (!s.firstFollowAwarded) {points(rules.points.firstFollow,'First follow');s.firstFollowAwarded=true;}
      if (!s.primary) s.primary=catId;
      break;
    case 'unfollow': relationship().active=false;if(s.primary===catId)s.primary='';break;
    case 'primary': relationship();s.primary=catId;break;
    case 'vote':
      if (!remainingVotes(s,now)) throw Error('No votes left today');
      s.votes.push({id,catId,seasonId:seasonAt(now).id,day:date});
      if(!s.badges.some(b=>b.id==='fan-'+catId))s.badges.push({id:'fan-'+catId,name:'Founding fan',catId});
      break;
    case 'checkin': {
      relationship();if(s.visits.some(v=>v.day===date))throw Error('Already checked in today');
      s.visits.push({day:date,catId});points(rules.points.checkin,'Demo check-in',id,true);bond(rules.xp.checkin,'Demo check-in');
      const week=weekIndex(date), weeks=new Set(s.visits.filter(v=>v.catId===catId).map(v=>weekIndex(v.day)));
      const bonus=`${catId}:${week}`;
      if(weeks.has(week-1)&&weeks.has(week-2)&&!s.weeklyBonuses.includes(bonus)){
        bond(rules.xp.weeklyBonus,'Three-week visit bonus');s.weeklyBonuses.push(bonus);
      }
      break;
    }
    case 'interaction':
      relationship();
      if(s.bondLedger.some(t=>t.catId===catId&&t.label==='Demo staff interaction'&&t.date===date))throw Error('Interaction already verified today');
      points(rules.points.interaction,'Demo staff interaction',id,true);bond(rules.xp.interaction,'Demo staff interaction');break;
    case 'care': {
      relationship();const pkg=carePackages.find(p=>p.id===command.packageId);if(!pkg)throw Error('Invalid package');
      if(s.careOrders.filter(o=>o.date===date).length>=rules.carePerDay)throw Error('Daily care limit reached');
      const pp=Math.floor(pkg.price*rules.points.perMop);
      points(pp,'Simulated care support',id,true);bond(rules.xp.care,'Simulated care support');
      s.careOrders.unshift({id,catId,packageId:pkg.id,amount:pkg.price,status:'awaiting-staff',points:pp,xp:rules.xp.care,date});break;
    }
    case 'cart':
      if(!products.some(p=>p.id===command.productId))throw Error('Unknown product');
      if(command.quantity>0&&products.find(p=>p.id===command.productId)!.availability!=='Demo available')throw Error('Product not available');
      if(!Number.isInteger(command.quantity)||command.quantity<0||command.quantity>rules.maxCartQuantity)throw Error('Quantity must be between 0 and 20');
      s.cart[command.productId]=command.quantity;break;
    case 'checkout': {
      const items=products.filter(p=>(s.cart[p.id]??0)>0).map(p=>({productId:p.id,quantity:s.cart[p.id],unitPrice:p.price,name:p.name}));
      if(!items.length)throw Error('Cart empty');
      if(items.some(i=>products.find(p=>p.id===i.productId)!.availability!=='Demo available'))throw Error('Product not available');
      if(items.some(i=>!Number.isInteger(i.quantity)||i.quantity>rules.maxCartQuantity||i.quantity<1))throw Error('Invalid quantity');
      const amount=items.reduce((sum,item)=>sum+item.unitPrice*item.quantity,0);
      s.orders.unshift({id,items,amount,date,status:'simulated',shippingStatus:'not-applicable'});
      points(Math.floor(amount*rules.points.perMop),'Simulated merchandise purchase',id,true);s.cart={};break;
    }
    case 'birthday':
      if(!/^\d{4}-\d{2}-\d{2}$/.test(command.birthday)||Number.isNaN(Date.parse(command.birthday))||command.birthday>date||new Date(command.birthday).toISOString().slice(0,10)!==command.birthday)throw Error('Enter a valid birthday');
      s.user.birthday=command.birthday;break;
    case 'book': {
      const pkg=eventPackages.find(p=>p.id===command.packageId);
      if(!pkg||!cafes.some(c=>c.id===command.cafeId)||!themes.includes(command.theme))throw Error('Invalid booking details');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(command.date)||Number.isNaN(Date.parse(command.date))||new Date(command.date).toISOString().slice(0,10)!==command.date||command.date<date)throw Error('Choose today or a future date');
      if(!Number.isInteger(command.guests)||command.guests<1||command.guests>pkg.maxGuests)throw Error('Guest count exceeds package capacity');
      s.bookings.unshift({id,packageId:pkg.id,date:command.date,guests:command.guests,cafeId:command.cafeId,theme:command.theme,status:'requested',amount:pkg.price});break;
    }
    case 'confirm-event': {
      const booking=s.bookings.find(b=>b.id===command.bookingId);
      if(!booking||booking.status!=='requested')throw Error('Already completed');
      booking.status='demo-confirmed';points(Math.floor(booking.amount*rules.points.perMop),'Simulated event purchase',booking.id,true);break;
    }
    case 'referral':
      if(s.pointsLedger.some(t=>t.label==='Demo verified referral'))throw Error('Already completed');
      points(rules.points.referral,'Demo verified referral',id,true);break;
    case 'redeem': {
      const rel=relationship(),reward=rewards.find(r=>r.id===command.rewardId);
      if(!reward)throw Error('Unknown reward');
      if(level(rel.xp)<reward.level)throw Error('Relationship locked');
      if(s.redemptions.some(r=>r.catId===catId&&r.rewardId===reward.id))throw Error('Reward already redeemed for this cat');
      points(-reward.cost,'Reward redemption',id,true);
      s.wallet.unshift({id:'PAW-'+id,rewardId:reward.id,catId,status:'demo-only'});
      s.redemptions.unshift({id,rewardId:reward.id,catId,date,voucherId:'PAW-'+id});break;
    }
  }
  s.done.push(id);return s;
}
export const bookingPackage = (booking: BirthdayBooking) => eventPackages.find(p=>p.id===booking.packageId)!;
