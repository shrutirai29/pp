import React from 'react';
import { AuditEvent, AuditActor } from '../../types/audit';
import { Badge } from '../ui/Badge';
import { 
  FileCheck, 
  Layers, 
  MessageSquareCode, 
  TrendingDown, 
  ShieldCheck, 
  Lock, 
  User, 
  Bot, 
  Store, 
  History,
  AlertCircle,
  CreditCard
} from 'lucide-react';

interface AuditTimelineProps {
  events: AuditEvent[];
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ events }) => {
  const actorConfig: Record<AuditActor, { label: string; icon: React.ReactNode; color: string }> = {
    user: {
      label: 'Buyer (User)',
      icon: <User className="h-3.5 w-3.5" />,
      color: 'text-electric-400 bg-electric-950/60 border-electric-700/40',
    },
    dealmind_agent: {
      label: 'DealMind Agent',
      icon: <Bot className="h-3.5 w-3.5" />,
      color: 'text-violet-400 bg-violet-950/60 border-violet-700/40',
    },
    seller_agent: {
      label: 'Seller Automated Desk',
      icon: <Store className="h-3.5 w-3.5" />,
      color: 'text-amber-400 bg-amber-950/60 border-amber-700/40',
    },
    intentlock_engine: {
      label: 'IntentLock Engine',
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      color: 'text-emerald-400 bg-emerald-950/60 border-emerald-700/40',
    },
    checkout_gateway: {
      label: 'Checkout Gateway',
      icon: <Lock className="h-3.5 w-3.5" />,
      color: 'text-sky-400 bg-sky-950/60 border-sky-700/40',
    },
    paypal_gateway: {
      label: 'PayPal Sandbox Gateway',
      icon: <CreditCard className="h-3.5 w-3.5" />,
      color: 'text-blue-400 bg-blue-950/60 border-blue-700/40',
    },
  };

  const getEventIcon = (type: AuditEvent['type']) => {
    switch (type) {
      case 'requirements_created':
        return <FileCheck className="h-4 w-4 text-electric-400" />;
      case 'offers_compared':
        return <Layers className="h-4 w-4 text-violet-400" />;
      case 'negotiation_started':
        return <MessageSquareCode className="h-4 w-4 text-sky-400" />;
      case 'counteroffer_received':
      case 'negotiation_concluded':
        return <TrendingDown className="h-4 w-4 text-amber-400" />;
      case 'verification_completed':
      case 'deal_verified':
        return <ShieldCheck className="h-4 w-4 text-emerald-400" />;
      case 'deal_rejected':
        return <AlertCircle className="h-4 w-4 text-rose-400" />;
      case 'paypal_order_created':
      case 'paypal_payment_completed':
        return <CreditCard className="h-4 w-4 text-blue-400" />;
      default:
        return <History className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-navy-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-electric-400" />
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="h-5 w-5 text-electric-400" />
              Cryptographic Audit Trail & Event Ledger
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Immutable log of intent declarations, bot handshakes, counteroffers, and IntentLock verification verdicts.
          </p>
        </div>

        <Badge variant="outline" size="sm" className="font-mono">
          DEMONSTRATION LEDGER
        </Badge>
      </div>

      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-navy-800">
        {events.map((ev) => {
          const actor = actorConfig[ev.actor] || actorConfig.dealmind_agent;
          const time = new Date(ev.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          const date = new Date(ev.timestamp).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          });

          return (
            <div key={ev.id} className="relative group">
              {/* Event node dot */}
              <div className="absolute -left-6 sm:-left-8 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-navy-900 border border-navy-700 shadow-md group-hover:border-electric-500 transition-colors">
                {getEventIcon(ev.type)}
              </div>

              {/* Event Card */}
              <div className="rounded-xl border border-navy-800 bg-navy-900/60 p-4 transition-all hover:border-navy-700 hover:bg-navy-900/90">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-white">
                      {ev.title}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${actor.color}`}>
                      {actor.icon}
                      {actor.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                    <span>{date}</span>
                    <span>{time}</span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
                  {ev.description}
                </p>

                {/* Metadata tags */}
                {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                  <div className="rounded-lg bg-navy-950/80 p-2.5 border border-navy-850 flex flex-wrap gap-2 text-[11px] font-mono">
                    {Object.entries(ev.metadata).map(([key, val]) => (
                      <span key={key} className="text-slate-400">
                        <span className="text-slate-500">{key}:</span>{' '}
                        <span className="text-slate-200">{String(val)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
