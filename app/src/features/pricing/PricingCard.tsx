import { Check, Star, Infinity as InfinityIcon } from '@phosphor-icons/react';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { BillingPackage, PackagePrice } from '../../lib/types';
import { Button } from '../../components/Button';
import { formatIdr } from '../../lib/format';
type TFunc=(k:string,o?:Record<string,unknown>)=>string;
function formatDuration(t:TFunc,d:number){return t('pricing.durationMonths',{count:Math.round(d/30)})}
function savingsPercent(o:number,d:number){return Math.round(((o-d)/o)*100)}
function computeBenefits(t:TFunc,p:BillingPackage){const b:string[]=[];if(p.maxMembers===null)b.push(t('pricing.benefits.unlimitedMembers'));else b.push(t('pricing.benefits.members',{n:p.maxMembers}));if(p.maxProjects===null)b.push(t('pricing.benefits.unlimitedProjects'));else b.push(t('pricing.benefits.projects',{n:p.maxProjects}));return b}
const STATIC_BENEFIT_KEYS=['pricing.benefits.coreFeatures','pricing.benefits.exportJson','pricing.benefits.prioritySupport'] as const;
function monthlyEquivalent(price:PackagePrice){return Math.round(price.priceIdr/(price.durationDays/30))}
export function PricingCard({pkg,isFeatured=false,selectedPrice,onBuy,onSelectPrice,busy,anyBusy,disabledReason,actionError}:any){
  const {t}=useTranslation('extras');const benefits=computeBenefits(t,pkg);const isFree=pkg.isFree||pkg.prices.length===0;const primaryPrice=selectedPrice??pkg.prices[0]??null;const hasDiscount=primaryPrice?.originalPriceIdr!=null&&primaryPrice.originalPriceIdr>primaryPrice.priceIdr;const showToggle=!isFree&&pkg.prices.length>1&&!!onSelectPrice;
  const groupRef = useRef<HTMLDivElement>(null);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!groupRef.current) return;
    const buttons = [...groupRef.current.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const idx = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const next = (idx + dir + buttons.length) % buttons.length;
      const target = buttons[next];
      target?.focus();
      const pid = target?.dataset.priceId;
      if (pid) onSelectPrice?.(pid);
    } else if (e.key === 'Home') {
      e.preventDefault();
      buttons[0]?.focus();
      const pid = buttons[0]?.dataset.priceId;
      if (pid) onSelectPrice?.(pid);
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = buttons[buttons.length - 1];
      last?.focus();
      const pid = last?.dataset.priceId;
      if (pid) onSelectPrice?.(pid);
    }
  }, [onSelectPrice]);
  return (<section className={`pricing-card${isFeatured?' pricing-card-pro pricing-card-featured':''}${isFree?' pricing-card-free':''}`} aria-labelledby={`plan-${pkg.id}`} data-featured={isFeatured||undefined}>
    {isFeatured&&<><div className="pricing-badge-pro" aria-hidden="true"><Star size={11} weight="fill"/> {t('pricing.recommended')}</div><span className="sr-only">{t('pricing.recommended')}</span></>}
    <div className="pricing-card-head"><h2 id={`plan-${pkg.id}`} className="pricing-plan-name">{pkg.name}{isFeatured&&<InfinityIcon size={16} weight="bold" aria-hidden="true" className="pricing-plan-icon"/>}</h2>{pkg.description&&<p className="pricing-plan-desc">{pkg.description}</p>}</div>
    {showToggle&&<div className="segmented segmented-card" ref={groupRef} role="radiogroup" aria-label={t('pricing.billingGroupAria')} onKeyDown={handleKeyDown}>{pkg.prices.map((price:any)=>{const isActive=primaryPrice?.id===price.id;const isYearly=price.durationDays>60;const hasDisc=price.originalPriceIdr!=null&&price.originalPriceIdr>price.priceIdr;let sav=hasDisc?savingsPercent(price.originalPriceIdr,price.priceIdr):null;if(!sav&&isYearly&&pkg.prices.length===2){const m=pkg.prices.find((p:any)=>p.durationDays<=60);if(m){const mt=m.priceIdr*(price.durationDays/m.durationDays);if(mt>price.priceIdr)sav=savingsPercent(Math.round(mt),price.priceIdr)}}return (<button key={price.id} type="button" role="radio" aria-checked={isActive} tabIndex={isActive?0:-1} data-price-id={price.id} className={`segmented-btn${isActive?' segmented-btn-active':''}`} onClick={()=>onSelectPrice?.(price.id)}>{isYearly?t('pricing.billing.yearly'):t('pricing.billing.monthly')}<span className="segmented-sub">{isYearly?` \u00B7 Rp ${monthlyEquivalent(price).toLocaleString('id-ID')}/bln`:` \u00B7 ${formatDuration(t,price.durationDays)}`}</span>{isYearly&&sav!=null&&sav>0&&<span className="segmented-badge">{t('pricing.savings',{percent:sav})}</span>}</button>)})}</div>}
    <div className="pricing-price-block">{hasDiscount&&primaryPrice&&<p className="pricing-price-original">{formatIdr(primaryPrice.originalPriceIdr!)}</p>}{isFree?<p className="pricing-price-main"><span className="pricing-price-amount">{t('pricing.freePrice')}</span><span className="pricing-price-period">{t('pricing.freePeriod')}</span></p>:primaryPrice?<><p className="pricing-price-main"><span className="pricing-price-amount">{formatIdr(primaryPrice.priceIdr)}</span><span className="pricing-price-period"> / {formatDuration(t,primaryPrice.durationDays)}</span>{hasDiscount&&<span className="pricing-price-badge">{t('pricing.savings',{percent:savingsPercent(primaryPrice.originalPriceIdr,primaryPrice.priceIdr)})}</span>}</p></>:<p className="pricing-price-main"><span className="pricing-price-amount">\u2014</span></p>}</div>
    <hr className="pricing-divider"/><ul className="pricing-benefits">{benefits.map((b:any)=><li key={b}><Check size={14} weight="bold" aria-hidden="true"/><span>{b}</span></li>)}{STATIC_BENEFIT_KEYS.map((k:any)=><li key={k}><Check size={14} weight="bold" aria-hidden="true"/>{t(k)}</li>)}</ul><hr className="pricing-divider pricing-divider-cta"/><div className="pricing-card-cta">{actionError&&<p className="field-error pricing-cta-error" role="alert" tabIndex={-1}>{actionError}</p>}{isFree?<Button variant="ghost" size="md" disabled className="pricing-cta-btn" aria-disabled="true">{t('pricing.currentPlan')}</Button>:<>{(() => { const ctaId=`pricing-cta-hint-${pkg.id}`; return (<><Button variant={isFeatured?'primary':'secondary'} size="md" className="pricing-cta-btn" aria-describedby={disabledReason?ctaId:undefined} aria-disabled={disabledReason? true: undefined} disabled={busy||anyBusy} loading={busy} onClick={()=>{if(disabledReason) return; if(primaryPrice)onBuy(primaryPrice.id)}}>{primaryPrice?t('pricing.ctaWithPrice',{name:pkg.name,price:formatIdr(primaryPrice.priceIdr)}):t('pricing.cta',{name:pkg.name})}</Button>{disabledReason&&!busy&&<p id={ctaId} className="pricing-cta-hint">{disabledReason}</p>}</>); })()}</>}</div></section>)
}
