import React, { useState } from 'react';
import { UserIntent, CurrencyCode, IntentCondition, HardConstraintKey } from '../types/deal';
import { validateDealInput, DealInputForm, ValidationErrors } from '../lib/validation';
import { Button } from '../components/ui/Button';
import { 
  Sparkles, 
  ArrowRight, 
  ShieldAlert, 
  Clock, 
  Box, 
  DollarSign, 
  Check, 
  Info,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';

interface FindDealPageProps {
  onSubmit: (intent: UserIntent) => void;
  onCancel: () => void;
}

const EXAMPLE_REQUEST = {
  rawQuery: 'Find me a new 1 TB SSD under ₹8,000, delivered within three days, with no subscriptions or additional charges.',
  productTitle: '1TB NVMe M.2 SSD',
  maxBudget: 8000,
  currency: 'INR' as CurrencyCode,
  requiredCondition: 'new' as IntentCondition,
  maxDeliveryDays: 3,
  requiredWarrantyMonths: 12,
  prohibitSubscriptions: true,
  requireAllFeesIncluded: true,
  hardConstraints: ['budget', 'condition', 'delivery', 'no_subscription', 'warranty', 'all_fees_included'],
};

export const FindDealPage: React.FC<FindDealPageProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<DealInputForm>({
    rawQuery: EXAMPLE_REQUEST.rawQuery,
    productTitle: EXAMPLE_REQUEST.productTitle,
    maxBudget: EXAMPLE_REQUEST.maxBudget,
    currency: EXAMPLE_REQUEST.currency,
    requiredCondition: EXAMPLE_REQUEST.requiredCondition,
    maxDeliveryDays: EXAMPLE_REQUEST.maxDeliveryDays,
    requiredWarrantyMonths: EXAMPLE_REQUEST.requiredWarrantyMonths,
    prohibitSubscriptions: EXAMPLE_REQUEST.prohibitSubscriptions,
    requireAllFeesIncluded: EXAMPLE_REQUEST.requireAllFeesIncluded,
    hardConstraints: EXAMPLE_REQUEST.hardConstraints,
  });

  const [errors, setErrors] = useState<ValidationErrors>({});

  const handleApplyExample = () => {
    setFormData({
      ...EXAMPLE_REQUEST,
    });
    setErrors({});
  };

  const handleClear = () => {
    setFormData({
      rawQuery: '',
      productTitle: '',
      maxBudget: '',
      currency: 'INR',
      requiredCondition: 'new',
      maxDeliveryDays: 5,
      requiredWarrantyMonths: 12,
      prohibitSubscriptions: true,
      requireAllFeesIncluded: true,
      hardConstraints: ['budget', 'condition', 'no_subscription'],
    });
    setErrors({});
  };

  const toggleHardConstraint = (key: string) => {
    setFormData((prev) => {
      const exists = prev.hardConstraints.includes(key);
      const updated = exists
        ? prev.hardConstraints.filter((k) => k !== key)
        : [...prev.hardConstraints, key];
      return { ...prev, hardConstraints: updated };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateDealInput(formData);

    if (!result.isValid) {
      setErrors(result.errors);
      return;
    }

    const intent: UserIntent = {
      id: `intent-${Date.now()}`,
      rawQuery: formData.rawQuery.trim(),
      productTitle: formData.productTitle.trim(),
      maxBudget: Number(formData.maxBudget),
      currency: formData.currency,
      requiredCondition: formData.requiredCondition,
      maxDeliveryDays: Number(formData.maxDeliveryDays),
      requiredWarrantyMonths: Number(formData.requiredWarrantyMonths || 0),
      prohibitSubscriptions: formData.prohibitSubscriptions,
      requireAllFeesIncluded: formData.requireAllFeesIncluded,
      hardConstraints: formData.hardConstraints as HardConstraintKey[],
      flexiblePreferences: ['seller_rating', 'faster_shipping'],
      createdAt: new Date().toISOString(),
    };

    onSubmit(intent);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-navy-800 bg-navy-900/60 p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-electric-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-electric-400">
                Deal Discovery & Intent Definition
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Specify Your Target Product & Constraints
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Provide your criteria in natural language. IntentLock will turn your constraints into immutable verification rules.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyExample}
              leftIcon={<Sparkles className="h-3.5 w-3.5 text-violet-400" />}
            >
              Load Example SSD Request
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Natural Language Prompt Card */}
        <div className="rounded-xl border border-navy-800 bg-navy-900/40 p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-white mb-1">
              Natural Language Product Request <span className="text-rose-400">*</span>
            </label>
            <p className="text-xs text-slate-400 mb-2">
              State what you need, your budget, preferred delivery timeframe, and any non-negotiable conditions.
            </p>
            <textarea
              rows={3}
              value={formData.rawQuery}
              onChange={(e) => {
                setFormData({ ...formData, rawQuery: e.target.value });
                if (errors.rawQuery) setErrors({ ...errors, rawQuery: undefined });
              }}
              placeholder="e.g. Find me a new 1 TB SSD under ₹8,000, delivered within three days, with no subscriptions or additional charges."
              className={`w-full rounded-xl bg-navy-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 border focus:outline-none focus:ring-2 focus:ring-electric-500 transition-colors ${
                errors.rawQuery ? 'border-rose-500 ring-1 ring-rose-500' : 'border-navy-700'
              }`}
            />
            {errors.rawQuery && (
              <p className="mt-1 text-xs text-rose-400 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                {errors.rawQuery}
              </p>
            )}
          </div>

          {/* Product Title Categorization */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Product Identifier / Search Key <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={formData.productTitle}
              onChange={(e) => {
                setFormData({ ...formData, productTitle: e.target.value });
                if (errors.productTitle) setErrors({ ...errors, productTitle: undefined });
              }}
              placeholder="e.g. 1TB NVMe M.2 SSD"
              className={`w-full rounded-lg bg-navy-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 border focus:outline-none focus:ring-2 focus:ring-electric-500 ${
                errors.productTitle ? 'border-rose-500' : 'border-navy-700'
              }`}
            />
            {errors.productTitle && (
              <p className="mt-1 text-xs text-rose-400">{errors.productTitle}</p>
            )}
          </div>
        </div>

        {/* Structured Constraint Controls */}
        <div className="rounded-xl border border-navy-800 bg-navy-900/40 p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-navy-800 pb-3">
            <SlidersHorizontal className="h-4 w-4 text-electric-400" />
            <h3 className="text-sm font-semibold text-white">
              IntentLock Strict Parameters
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Budget */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Maximum Total Budget <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <DollarSign className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={formData.maxBudget}
                  onChange={(e) => {
                    setFormData({ ...formData, maxBudget: e.target.value === '' ? '' : Number(e.target.value) });
                    if (errors.maxBudget) setErrors({ ...errors, maxBudget: undefined });
                  }}
                  placeholder="8000"
                  className={`w-full rounded-lg bg-navy-950 pl-9 pr-3 py-2 text-sm text-slate-100 border focus:outline-none focus:ring-2 focus:ring-electric-500 font-mono ${
                    errors.maxBudget ? 'border-rose-500' : 'border-navy-700'
                  }`}
                />
              </div>
              {errors.maxBudget && (
                <p className="mt-1 text-xs text-rose-400">{errors.maxBudget}</p>
              )}
            </div>

            {/* Currency */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value as CurrencyCode })}
                className="w-full rounded-lg bg-navy-950 px-3.5 py-2 text-sm text-slate-100 border border-navy-700 focus:outline-none focus:ring-2 focus:ring-electric-500"
              >
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
              </select>
            </div>

            {/* Product Condition */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Product Condition <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Box className="h-4 w-4 text-slate-500" />
                </div>
                <select
                  value={formData.requiredCondition}
                  onChange={(e) => setFormData({ ...formData, requiredCondition: e.target.value as IntentCondition })}
                  className="w-full rounded-lg bg-navy-950 pl-9 pr-3 py-2 text-sm text-slate-100 border border-navy-700 focus:outline-none focus:ring-2 focus:ring-electric-500"
                >
                  <option value="new">Strictly Factory New (Unopened)</option>
                  <option value="refurbished">Certified Refurbished Acceptable</option>
                  <option value="any">Any Working Condition</option>
                </select>
              </div>
            </div>

            {/* Max Delivery Time */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Max Delivery Time (Days) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Clock className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={formData.maxDeliveryDays}
                  onChange={(e) => {
                    setFormData({ ...formData, maxDeliveryDays: e.target.value === '' ? '' : Number(e.target.value) });
                    if (errors.maxDeliveryDays) setErrors({ ...errors, maxDeliveryDays: undefined });
                  }}
                  placeholder="3"
                  className={`w-full rounded-lg bg-navy-950 pl-9 pr-3 py-2 text-sm text-slate-100 border focus:outline-none focus:ring-2 focus:ring-electric-500 font-mono ${
                    errors.maxDeliveryDays ? 'border-rose-500' : 'border-navy-700'
                  }`}
                />
              </div>
              {errors.maxDeliveryDays && (
                <p className="mt-1 text-xs text-rose-400">{errors.maxDeliveryDays}</p>
              )}
            </div>

            {/* Required Warranty */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Required Warranty (Months)
              </label>
              <input
                type="number"
                min="0"
                value={formData.requiredWarrantyMonths}
                onChange={(e) => {
                  setFormData({ ...formData, requiredWarrantyMonths: e.target.value === '' ? '' : Number(e.target.value) });
                  if (errors.requiredWarrantyMonths) setErrors({ ...errors, requiredWarrantyMonths: undefined });
                }}
                placeholder="12"
                className={`w-full rounded-lg bg-navy-950 px-3.5 py-2 text-sm text-slate-100 border focus:outline-none focus:ring-2 focus:ring-electric-500 font-mono ${
                  errors.requiredWarrantyMonths ? 'border-rose-500' : 'border-navy-700'
                }`}
              />
              {errors.requiredWarrantyMonths && (
                <p className="mt-1 text-xs text-rose-400">{errors.requiredWarrantyMonths}</p>
              )}
            </div>
          </div>

          {/* Toggles */}
          <div className="pt-3 border-t border-navy-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 p-3 rounded-lg bg-navy-950/70 border border-navy-800 cursor-pointer hover:border-navy-700 transition-colors">
              <input
                type="checkbox"
                checked={formData.prohibitSubscriptions}
                onChange={(e) => setFormData({ ...formData, prohibitSubscriptions: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-navy-700 bg-navy-900 text-electric-500 focus:ring-electric-500"
              />
              <div>
                <span className="text-xs font-semibold text-white block">
                  Prohibit Recurring Subscriptions (Rule 3)
                </span>
                <span className="text-[11px] text-slate-400">
                  Disqualifies any offer that forces recurring auto-renewing charges or subscription memberships.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-navy-950/70 border border-navy-800 cursor-pointer hover:border-navy-700 transition-colors">
              <input
                type="checkbox"
                checked={formData.requireAllFeesIncluded}
                onChange={(e) => setFormData({ ...formData, requireAllFeesIncluded: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-navy-700 bg-navy-900 text-electric-500 focus:ring-electric-500"
              />
              <div>
                <span className="text-xs font-semibold text-white block">
                  Mandatory All-Inclusive Fees (Rule 1)
                </span>
                <span className="text-[11px] text-slate-400">
                  Total price must factor delivery, taxes, and platform fees upfront. No surprise surcharges at checkout.
                </span>
              </div>
            </label>
          </div>

          {/* Hard Constraints Checklist */}
          <div className="pt-3 border-t border-navy-800/80">
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Mark Non-Negotiable Hard Constraints (Breaches cause automatic IntentLock Rejection):
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'budget', label: 'Hard Budget Ceiling' },
                { id: 'condition', label: 'Strict Condition Match' },
                { id: 'delivery', label: 'Max Delivery Window' },
                { id: 'no_subscription', label: 'Zero Subscriptions' },
                { id: 'warranty', label: 'Warranty Mandatory' },
                { id: 'all_fees_included', label: 'Full Fee Transparency' },
              ].map((c) => {
                const isSelected = formData.hardConstraints.includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleHardConstraint(c.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-electric-950 border-electric-500/60 text-electric-300'
                        : 'bg-navy-950/50 border-navy-800 text-slate-400 hover:border-navy-700'
                    }`}
                  >
                    {isSelected ? <Check className="h-3 w-3 text-electric-400" /> : <span className="h-3 w-3" />}
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Demo Notice */}
        <div className="rounded-lg bg-navy-950/50 p-3 border border-navy-850 flex items-center gap-2 text-xs text-slate-400">
          <Info className="h-4 w-4 shrink-0 text-slate-500" />
          <span>
            Upon submission, DealMind searches the mock catalogue and routes you to the Deal Workspace.
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            rightIcon={<ArrowRight className="h-4 w-4" />}
            className="bg-gradient-to-r from-electric-500 to-violet-600 hover:from-electric-600 hover:to-violet-700 text-white font-semibold"
          >
            Search Offers & Open Workspace
          </Button>
        </div>
      </form>
    </div>
  );
};
