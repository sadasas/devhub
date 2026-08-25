import { Check, Infinity as InfinityIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { BillingPackage } from '../../lib/types';
import { formatIdr } from '../../lib/format';

type Props = { packages: BillingPackage[] };

function sortPackages(pkgs: BillingPackage[]): BillingPackage[] {
  return [...pkgs].sort((a, b) => {
    if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
    const aPrice = a.prices[0]?.priceIdr ?? 0;
    const bPrice = b.prices[0]?.priceIdr ?? 0;
    return aPrice - bPrice;
  });
}

function priceFor(pkg: BillingPackage, yearly: boolean) {
  if (pkg.isFree) return null;
  const found = pkg.prices.find((p) => (yearly ? p.durationDays > 60 : p.durationDays <= 60));
  return found ?? null;
}

export function PricingCompare({ packages }: Props) {
  const { t } = useTranslation('extras');
  const sorted = sortPackages(packages);

  const rows: Array<{ id: string; label: string; group: string; render: (pkg: BillingPackage) => React.ReactNode }> = [
    {
      id: 'members',
      label: t('pricing.compareRow.members', { defaultValue: 'Anggota' }),
      group: t('pricing.compareGroup.limits', { defaultValue: 'Batasan' }),
      render: (pkg) =>
        pkg.maxMembers === null ? (
          <span className="quota-pill"><InfinityIcon size={12} weight="bold" aria-hidden /> {t('pricing.benefits.unlimitedMembers', { defaultValue: 'Tanpa batas' })}</span>
        ) : (
          <span className="quota-num tabular">{t('pricing.benefits.members', { n: pkg.maxMembers })}</span>
        ),
    },
    {
      id: 'projects',
      label: t('pricing.compareRow.projects', { defaultValue: 'Proyek' }),
      group: t('pricing.compareGroup.limits', { defaultValue: 'Batasan' }),
      render: (pkg) =>
        pkg.maxProjects === null ? (
          <span className="quota-pill"><InfinityIcon size={12} weight="bold" aria-hidden /> {t('pricing.benefits.unlimitedProjects', { defaultValue: 'Tanpa batas' })}</span>
        ) : (
          <span className="quota-num tabular">{t('pricing.benefits.projects', { n: pkg.maxProjects })}</span>
        ),
    },
    {
      id: 'priceMonthly',
      label: t('pricing.compareRow.monthly', { defaultValue: 'Harga bulanan' }),
      group: t('pricing.compareGroup.billing', { defaultValue: 'Harga' }),
      render: (pkg) => {
        if (pkg.isFree) return <span className="price-zero">{t('pricing.freePrice')} {t('pricing.freePeriod')}</span>;
        const pr = priceFor(pkg, false);
        return pr ? <span className="tabular">{formatIdr(pr.priceIdr)}</span> : <span className="pricing-compare-muted">-</span>;
      },
    },
    {
      id: 'priceYearly',
      label: t('pricing.compareRow.yearly', { defaultValue: 'Harga tahunan' }),
      group: t('pricing.compareGroup.billing', { defaultValue: 'Harga' }),
      render: (pkg) => {
        if (pkg.isFree) return <span className="pricing-compare-muted">-</span>;
        const pr = priceFor(pkg, true);
        if (!pr) return <span className="pricing-compare-muted">-</span>;
        return (
          <span className="tabular">
            {formatIdr(pr.priceIdr)} {pr.originalPriceIdr && pr.originalPriceIdr > pr.priceIdr ? <span className="pricing-price-original" style={{ display: 'inline', marginLeft: 6, fontSize: 11 }}>{formatIdr(pr.originalPriceIdr)}</span> : null}
          </span>
        );
      },
    },
    {
      id: 'tasks',
      label: t('pricing.compare.tasks'),
      group: t('pricing.compareGroup.features', { defaultValue: 'Fitur inti' }),
      render: () => <span className="compare-check"><Check size={14} weight="bold" aria-hidden /></span>,
    },
    {
      id: 'issues',
      label: t('pricing.compare.issues'),
      group: t('pricing.compareGroup.features', { defaultValue: 'Fitur inti' }),
      render: () => <span className="compare-check"><Check size={14} weight="bold" aria-hidden /></span>,
    },
    {
      id: 'schema',
      label: t('pricing.compare.schema'),
      group: t('pricing.compareGroup.features', { defaultValue: 'Fitur inti' }),
      render: () => <span className="compare-check"><Check size={14} weight="bold" aria-hidden /></span>,
    },
    {
      id: 'decisions',
      label: t('pricing.compare.decisions'),
      group: t('pricing.compareGroup.features', { defaultValue: 'Fitur inti' }),
      render: () => <span className="compare-check"><Check size={14} weight="bold" aria-hidden /></span>,
    },
    {
      id: 'whiteboard',
      label: t('pricing.compare.whiteboard'),
      group: t('pricing.compareGroup.features', { defaultValue: 'Fitur inti' }),
      render: () => <span className="compare-check"><Check size={14} weight="bold" aria-hidden /></span>,
    },
    {
      id: 'api',
      label: t('pricing.compare.api'),
      group: t('pricing.compareGroup.features', { defaultValue: 'Fitur inti' }),
      render: () => <span className="compare-check"><Check size={14} weight="bold" aria-hidden /></span>,
    },
    {
      id: 'export',
      label: t('pricing.compareRow.export', { defaultValue: 'Export JSON' }),
      group: t('pricing.compareGroup.features', { defaultValue: 'Fitur inti' }),
      render: () => <span className="compare-check"><Check size={14} weight="bold" aria-hidden /></span>,
    },
    {
      id: 'support',
      label: t('pricing.compareRow.support', { defaultValue: 'Priority support' }),
      group: t('pricing.compareGroup.support', { defaultValue: 'Dukungan' }),
      render: (pkg) => (pkg.isFree ? <span className="pricing-compare-muted">-</span> : <span className="compare-check"><Check size={14} weight="bold" aria-hidden /></span>),
    },
  ];

  const groups = Array.from(new Set(rows.map((r) => r.group)));

  if (sorted.length === 0) return null;

  return (
    <section className="pricing-compare-ledger" aria-labelledby="compare-heading">
      <h2 id="compare-heading" className="pricing-compare-title">{t('pricing.compareTitle')}</h2>

      <div className="pricing-compare-table-wrap" role="region" aria-label={t('pricing.compareTitle')} tabIndex={0}>
        <table className="pricing-compare-table">
          <caption className="sr-only">{t('pricing.compareTitle')}</caption>
          <thead>
            <tr>
              <th scope="col" className="pricing-compare-corner">{t('pricing.compareCol.feature', { defaultValue: 'Fitur' })}</th>
              {sorted.map((pkg) => (
                <th key={pkg.id} scope="col" className={'pricing-compare-head ' + (pkg.isFree ? 'is-free' : 'is-pro')}>
                  <span className="pricing-compare-pkg-name">{pkg.name}</span>
                  {pkg.isFree ? null : <span className="compare-head-badge">Pro</span>}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g}>
              <tr className="pricing-compare-group-row">
                <th colSpan={sorted.length + 1} scope="colgroup"><span className="pricing-compare-group">{g}</span></th>
              </tr>
              {rows.filter((r) => r.group === g).map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  {sorted.map((pkg) => (
                    <td key={pkg.id}>{row.render(pkg)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className="pricing-compare-cards">
        {sorted.map((pkg) => (
          <div key={pkg.id} className={'pricing-compare-card ' + (pkg.isFree ? 'is-free' : 'is-pro')}>
            <div className="pricing-compare-card-head">
              <span className="pricing-compare-card-title">{pkg.name}</span>
              {pkg.isFree ? <span className="badge">Free</span> : <span className="badge badge-accent">Pro</span>}
            </div>
            <dl className="pricing-compare-card-list">
              {rows.map((row) => (
                <div key={row.id} className="pricing-compare-card-row">
                  <dt>{row.label}</dt>
                  <dd>{row.render(pkg)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
