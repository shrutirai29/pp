import React from 'react';
import { Deal } from '../types/deal';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Layers, 
  ArrowRight,
  CheckCircle2, 
  Laptop,
  Lock,
  ArrowUpRight,
  HardDrive,
  Headphones,
  Mouse,
  Smartphone,
  ExternalLink,
  Info
} from 'lucide-react';

interface DashboardPageProps {
  deals: Deal[];
  onSelectDeal: (deal: Deal) => void;
  onNewDeal: () => void;
  onViewAudit: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  deals,
  onSelectDeal,
  onNewDeal,
  onViewAudit,
}) => {
  // Compute summary metrics dynamically from deals with fallback to requested baseline
  const verifiedCount = deals.filter((d) => d.status === 'verified' || d.status === 'payment_completed').length || 1;
  const rejectedCount = deals.filter((d) => d.status === 'rejected').length || 1;
  const inProgressCount = deals.filter(
    (d) => d.status === 'negotiating' || d.status === 'verification_required' || d.status === 'draft'
  ).length || 2;
  const totalCount = deals.length >= 4 ? deals.length : 4;

  // Helper to pick appropriate product icon
  const getProductIcon = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('ssd') || lower.includes('nvme') || lower.includes('storage') || lower.includes('drive')) {
      return <HardDrive className="h-4 w-4 text-[#8F86D8]" />;
    }
    if (lower.includes('headphone') || lower.includes('wh-1000') || lower.includes('airpods') || lower.includes('audio')) {
      return <Headphones className="h-4 w-4 text-[#F5B69E]" />;
    }
    if (lower.includes('mouse') || lower.includes('keyboard')) {
      return <Mouse className="h-4 w-4 text-[#4FAF91]" />;
    }
    return <Smartphone className="h-4 w-4 text-[#8F86D8]" />;
  };

  // Helper for status badge formatting in the table
  const renderStatusBadge = (status: Deal['status']) => {
    switch (status) {
      case 'verified':
      case 'payment_completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#4FAF91]/10 text-[#4FAF91] border border-[#4FAF91]/25">
            <CheckCircle2 className="h-3 w-3" />
            Verified (IntentLock)
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#D97D68]/10 text-[#D97D68] border border-[#D97D68]/25">
            <ShieldAlert className="h-3 w-3" />
            Rejected
          </span>
        );
      case 'negotiating':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#8F86D8]/10 text-[#8F86D8] border border-[#8F86D8]/25">
            <Clock className="h-3 w-3" />
            Negotiating
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#24203D] text-[#68657A] border border-[#24203D]">
            Awaiting Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* =========================================================================
          1. HERO SECTION (Balanced 2-Zone Layout)
         ========================================================================= */}
      <section className="relative overflow-hidden rounded-2xl border border-[#24203D] bg-gradient-to-br from-[#1B1A32] via-[#15152B] to-[#24203D] p-6 sm:p-8 lg:p-10 shadow-premium">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Zone: Value Proposition & Call to Action */}
          <div className="lg:col-span-7 space-y-5">
            {/* Small Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#24203D] border border-[#6955C9]/30">
              <span className="h-2 w-2 rounded-full bg-[#6955C9] animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#E9E8F8]">
                AUTONOMOUS DEAL AGENT & INTENTLOCK SECURITY GATEWAY
              </span>
            </div>

            {/* Main Heading */}
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-white leading-tight">
                Negotiate Confidently.
              </h1>
              <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight leading-tight">
                <span className="text-[#6955C9]">IntentLock™</span>{' '}
                <span className="text-[#F5B69E]">Guarantees Your Terms.</span>
              </h2>
            </div>

            {/* Description */}
            <p className="text-sm sm:text-base text-[#68657A] leading-relaxed max-w-xl">
              DealMind finds the best offers, negotiates on your behalf, and ensures compliance through an independent
              IntentLock security audit — so you only pay for what you actually agree to.
            </p>

            {/* Primary & Secondary Actions */}
            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              <button
                onClick={onNewDeal}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6955C9] px-5 py-3 text-sm font-semibold text-white hover:bg-[#5442A8] hover:shadow-purple-glow active:scale-[0.98] transition-all"
              >
                <span>Find My Deal</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={onViewAudit}
                className="inline-flex items-center gap-2 rounded-xl border border-[#24203D] bg-[#15152B]/60 px-5 py-3 text-sm font-semibold text-[#E9E8F8] hover:bg-[#24203D] hover:border-[#6955C9]/40 active:scale-[0.98] transition-all"
              >
                <ShieldCheck className="h-4 w-4 text-[#4FAF91]" />
                <span>Inspect Audit Ledger</span>
              </button>
            </div>
          </div>

          {/* Right Zone: Elegant Product & Security Concept Visual */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md p-6 rounded-2xl border border-[#24203D] bg-[#24203D]/30 backdrop-blur-sm">
              {/* Subtle Orbital Background Glow */}
              <div className="absolute -top-6 -right-6 h-36 w-36 rounded-full bg-[#6955C9]/15 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-6 -left-6 h-36 w-36 rounded-full bg-[#F5B69E]/10 blur-2xl pointer-events-none" />

              {/* Header inside mock container */}
              <div className="flex items-center justify-between pb-4 border-b border-[#24203D]/60 mb-5 text-xs text-[#68657A]">
                <div className="flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-[#8F86D8]" />
                  <span className="font-semibold text-white">Security Pipeline</span>
                </div>
                <span className="font-mono text-[10px] text-[#4FAF91] bg-[#4FAF91]/10 px-2 py-0.5 rounded-full border border-[#4FAF91]/20">
                  SECURE PROTOCOL
                </span>
              </div>

              {/* 4 Pipeline Stages (Negotiate → Verify → Pay Securely → Audit) */}
              <div className="space-y-3 relative">
                {/* Connecting Line */}
                <div className="absolute left-[19px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-[#6955C9] via-[#8F86D8] to-[#4FAF91]/80" />

                {/* Stage 1: Negotiate */}
                <div className="relative flex items-center gap-3 bg-[#15152B]/70 p-2.5 rounded-xl border border-[#24203D]">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#6955C9] text-white shadow-sm z-10">
                    <span className="text-[11px] font-bold">1</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white">Autonomous Negotiation</span>
                    <span className="text-[10px] text-[#68657A]">AI Buyer & Seller multi-round dialogue</span>
                  </div>
                  <span className="ml-auto text-[10px] font-mono text-[#8F86D8]">1 Round</span>
                </div>

                {/* Stage 2: Verify */}
                <div className="relative flex items-center gap-3 bg-[#15152B]/70 p-2.5 rounded-xl border border-[#24203D]">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#8F86D8] text-white shadow-sm z-10">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white">IntentLock™ Audit</span>
                    <span className="text-[10px] text-[#68657A]">9/9 criteria independently verified</span>
                  </div>
                  <span className="ml-auto text-[10px] font-mono text-[#4FAF91]">PASS</span>
                </div>

                {/* Stage 3: Pay Securely */}
                <div className="relative flex items-center gap-3 bg-[#15152B]/70 p-2.5 rounded-xl border border-[#24203D]">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F5B69E] text-[#15152B] shadow-sm z-10">
                    <Lock className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white">Pay Securely</span>
                    <span className="text-[10px] text-[#68657A]">Single-use token & PayPal Sandbox</span>
                  </div>
                  <span className="ml-auto text-[10px] font-mono text-[#F5B69E]">$74.00</span>
                </div>

                {/* Stage 4: Audit */}
                <div className="relative flex items-center gap-3 bg-[#15152B]/70 p-2.5 rounded-xl border border-[#24203D]">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#4FAF91] text-white shadow-sm z-10">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white">Immutable Ledger</span>
                    <span className="text-[10px] text-[#68657A]">SHA-256 fingerprint & capture record</span>
                  </div>
                  <span className="ml-auto text-[10px] font-mono text-[#68657A]">Logged</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          2. METRIC CARDS (Four Distinct Modern Summary Cards)
         ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Managed Deals */}
        <div className="group rounded-2xl border border-[#24203D] bg-[#24203D]/40 p-5 transition-all duration-200 hover:border-[#6955C9]/40 hover:bg-[#24203D]/60 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-[#68657A] mb-3">
            <span className="text-xs font-medium">Total Managed Deals</span>
            <div className="p-2 rounded-xl bg-[#6955C9]/10 text-[#8F86D8]">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white tracking-tight">{totalCount}</span>
            <span className="text-xs font-mono text-[#68657A]">sessions recorded</span>
          </div>
        </div>

        {/* Card 2: IntentLock Verified */}
        <div className="group rounded-2xl border border-[#4FAF91]/20 bg-[#4FAF91]/5 p-5 transition-all duration-200 hover:border-[#4FAF91]/40 hover:bg-[#4FAF91]/10 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-[#68657A] mb-3">
            <span className="text-xs font-medium text-[#4FAF91]">IntentLock Verified</span>
            <div className="p-2 rounded-xl bg-[#4FAF91]/10 text-[#4FAF91]">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-[#4FAF91] tracking-tight">{verifiedCount}</span>
            <span className="text-xs text-[#4FAF91]/80">passed all constraints</span>
          </div>
        </div>

        {/* Card 3: Violations Blocked */}
        <div className="group rounded-2xl border border-[#D97D68]/20 bg-[#D97D68]/5 p-5 transition-all duration-200 hover:border-[#D97D68]/40 hover:bg-[#D97D68]/10 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-[#68657A] mb-3">
            <span className="text-xs font-medium text-[#D97D68]">Violations Blocked</span>
            <div className="p-2 rounded-xl bg-[#D97D68]/10 text-[#D97D68]">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-[#D97D68] tracking-tight">{rejectedCount}</span>
            <span className="text-xs text-[#D97D68]/80">locked from checkout</span>
          </div>
        </div>

        {/* Card 4: Active / In Review */}
        <div className="group rounded-2xl border border-[#8F86D8]/20 bg-[#8F86D8]/5 p-5 transition-all duration-200 hover:border-[#8F86D8]/40 hover:bg-[#8F86D8]/10 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-[#68657A] mb-3">
            <span className="text-xs font-medium text-[#8F86D8]">Active / In Review</span>
            <div className="p-2 rounded-xl bg-[#8F86D8]/10 text-[#8F86D8]">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-[#8F86D8] tracking-tight">{inProgressCount}</span>
            <span className="text-xs text-[#8F86D8]/80">awaiting completion</span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. MAIN CONTENT SPLIT (Recent Deals Table + Audit Activity Panel)
         ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Recent Negotiation Sessions & Deals Modern Data Table */}
        <div className="xl:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                Recent Negotiation Sessions & Deals
              </h2>
              <p className="text-xs text-[#68657A]">
                Demonstration session records illustrating various verification states.
              </p>
            </div>

            <button
              onClick={onNewDeal}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8F86D8] hover:text-white transition-colors self-start sm:self-auto"
            >
              <span>View All Deals</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Clean Modern Data Table */}
          <div className="overflow-hidden rounded-2xl border border-[#24203D] bg-[#24203D]/30 shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#24203D] bg-[#15152B]/80 text-[11px] font-semibold uppercase tracking-wider text-[#68657A]">
                    <th className="px-5 py-3.5">Item</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Price</th>
                    <th className="px-4 py-3.5">Condition</th>
                    <th className="px-4 py-3.5">Warranty</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24203D]/60 text-xs">
                  
                  {/* Verified Deal Row Example (Samsung 980 1TB SSD) */}
                  <tr 
                    onClick={() => {
                      const matched = deals.find(d => d.title.toLowerCase().includes('samsung') || d.title.toLowerCase().includes('ssd')) || deals[0];
                      if (matched) onSelectDeal(matched);
                    }}
                    className="group hover:bg-[#24203D]/50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#24203D] border border-[#6955C9]/20 group-hover:border-[#6955C9]/50 transition-colors">
                          <HardDrive className="h-4 w-4 text-[#8F86D8]" />
                        </div>
                        <div>
                          <p className="font-semibold text-white group-hover:text-[#8F86D8] transition-colors leading-snug">
                            Samsung 980 1TB NVMe SSD
                          </p>
                          <p className="text-[11px] text-[#68657A] font-mono">TechHaven Direct · M.2 2280</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#4FAF91]/10 text-[#4FAF91] border border-[#4FAF91]/25">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified (IntentLock)
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-[#F5B69E] bg-[#F5B69E]/10 border border-[#F5B69E]/20">
                        $74.00
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap font-medium text-white">NEW</td>
                    <td className="px-4 py-4 whitespace-nowrap text-[#68657A]">60 Months</td>
                    <td className="px-4 py-4 whitespace-nowrap text-[#68657A] font-mono">Oct 29, 2026</td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8F86D8] group-hover:text-white transition-colors">
                        Inspect Deal
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </td>
                  </tr>

                  {/* Negotiating Deal Row Example (Sony WH-1000XM5) */}
                  <tr 
                    onClick={() => {
                      const matched = deals.find(d => d.title.toLowerCase().includes('sony') || d.title.toLowerCase().includes('headphone')) || deals[1] || deals[0];
                      if (matched) onSelectDeal(matched);
                    }}
                    className="group hover:bg-[#24203D]/50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#24203D] border border-[#F5B69E]/20 group-hover:border-[#F5B69E]/50 transition-colors">
                          <Headphones className="h-4 w-4 text-[#F5B69E]" />
                        </div>
                        <div>
                          <p className="font-semibold text-white group-hover:text-[#8F86D8] transition-colors leading-snug">
                            Sony WH-1000XM5 Wireless Headphones
                          </p>
                          <p className="text-[11px] text-[#68657A] font-mono">AudioPro Express · ANC</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#8F86D8]/10 text-[#8F86D8] border border-[#8F86D8]/25">
                        <Clock className="h-3 w-3" />
                        Negotiating
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="font-mono font-medium text-white">$298.00</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap font-medium text-white">NEW</td>
                    <td className="px-4 py-4 whitespace-nowrap text-[#68657A]">12 Months</td>
                    <td className="px-4 py-4 whitespace-nowrap text-[#68657A] font-mono">Oct 28, 2026</td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8F86D8] group-hover:text-white transition-colors">
                        Open Workspace
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </td>
                  </tr>

                  {/* Render any additional dynamically loaded deals */}
                  {deals
                    .filter(d => !d.title.toLowerCase().includes('samsung 980') && !d.title.toLowerCase().includes('sony wh-1000'))
                    .map((deal) => {
                      const dateFormatted = new Date(deal.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });

                      return (
                        <tr
                          key={deal.id}
                          onClick={() => onSelectDeal(deal)}
                          className="group hover:bg-[#24203D]/50 transition-colors cursor-pointer"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#24203D] border border-[#24203D] group-hover:border-[#6955C9]/40 transition-colors">
                                {getProductIcon(deal.title)}
                              </div>
                              <div>
                                <p className="font-semibold text-white group-hover:text-[#8F86D8] transition-colors leading-snug">
                                  {deal.title}
                                </p>
                                <p className="text-[11px] text-[#68657A] font-mono truncate max-w-xs">
                                  {deal.intent.rawQuery}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {renderStatusBadge(deal.status)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap font-mono font-medium text-white">
                            ${deal.intent.maxBudget}.00
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap font-medium text-white uppercase">
                            {deal.intent.requiredCondition}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-[#68657A]">
                            {deal.intent.requiredWarrantyMonths ? `${deal.intent.requiredWarrantyMonths} Mo` : 'Standard'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-[#68657A] font-mono">
                            {dateFormatted}
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8F86D8] group-hover:text-white transition-colors">
                              View
                              <ArrowRight className="h-3.5 w-3.5" />
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Audit Activity Panel */}
        <div className="xl:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Audit Activity
              </h2>
              <p className="text-xs text-[#68657A]">
                Cryptographic security ledger events.
              </p>
            </div>
            
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-[#4FAF91]/10 text-[#4FAF91] border border-[#4FAF91]/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4FAF91] animate-pulse" />
              Live Updates
            </span>
          </div>

          {/* Audit Timeline Card */}
          <div className="rounded-2xl border border-[#24203D] bg-[#24203D]/30 p-5 shadow-subtle space-y-5">
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#24203D]">
              
              {/* Event 1 */}
              <div className="relative group">
                <span className="absolute -left-6 top-1 h-4 w-4 rounded-full border-2 border-[#15152B] bg-[#4FAF91] ring-4 ring-[#4FAF91]/20" />
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-xs font-bold text-white leading-tight">
                    IntentLock verification completed
                  </h4>
                  <span className="text-[10px] text-[#68657A] font-mono shrink-0">2 min ago</span>
                </div>
                <p className="text-[11px] text-[#68657A] mt-1">
                  All 9 constraints passed. Contract terms cryptographically verified.
                </p>
              </div>

              {/* Event 2 */}
              <div className="relative group">
                <span className="absolute -left-6 top-1 h-4 w-4 rounded-full border-2 border-[#15152B] bg-[#F5B69E] ring-4 ring-[#F5B69E]/20" />
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-xs font-bold text-white leading-tight">
                    PayPal payment captured
                  </h4>
                  <span className="text-[10px] text-[#68657A] font-mono shrink-0">5 min ago</span>
                </div>
                <p className="text-[11px] text-[#68657A] mt-1 font-mono">
                  $74.00 USD · Capture ID: 12P547...
                </p>
              </div>

              {/* Event 3 */}
              <div className="relative group">
                <span className="absolute -left-6 top-1 h-4 w-4 rounded-full border-2 border-[#15152B] bg-[#6955C9] ring-4 ring-[#6955C9]/20" />
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-xs font-bold text-white leading-tight">
                    Deal marked as completed
                  </h4>
                  <span className="text-[10px] text-[#68657A] font-mono shrink-0">6 min ago</span>
                </div>
                <p className="text-[11px] text-[#68657A] mt-1">
                  Authorization consumed & audit logged to SQLite ledger.
                </p>
              </div>

            </div>

            {/* Inspect Full Ledger CTA */}
            <div className="pt-2 border-t border-[#24203D]/60">
              <button
                onClick={onViewAudit}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#24203D] bg-[#15152B]/60 text-xs font-semibold text-[#8F86D8] hover:text-white hover:bg-[#24203D] hover:border-[#6955C9]/40 transition-all"
              >
                <span>View Full Audit Ledger</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* =========================================================================
          4. ARCHITECTURE NOTICE BANNER (Restrained Enterprise Styling)
         ========================================================================= */}
      <footer className="rounded-2xl border border-[#24203D] bg-[#24203D]/20 p-5 text-xs text-[#68657A] flex items-start gap-3.5">
        <Info className="h-4 w-4 text-[#8F86D8] shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="font-semibold text-white">System Architecture & Demonstration Notice:</p>
          <ul className="space-y-1 list-disc list-inside text-[#68657A]">
            <li>
              <strong className="text-white/80">Autonomous Deal Agent:</strong> Coordinates bilateral LLM negotiation with sellers using rule-based heuristics or Groq LLM (<code className="text-[#8F86D8] font-mono">openai/gpt-oss-120b</code>).
            </li>
            <li>
              <strong className="text-white/80">IntentLock Security Gateway:</strong> Independent auditor enforces strict mathematical constraints, SHA-256 contract fingerprinting, and single-use human authorization tokens.
            </li>
            <li>
              <strong className="text-white/80">PayPal Sandbox Payments:</strong> Captures executed strictly against PayPal Sandbox with authoritative backend reconciliation.
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
};
