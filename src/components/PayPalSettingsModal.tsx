'use client';

import React, { useState } from 'react';
import { X, Key, CheckCircle, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { PayPalConfig } from '@/types';

interface PayPalSettingsModalProps {
  config: PayPalConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (newConfig: PayPalConfig) => void;
}

export const PayPalSettingsModal: React.FC<PayPalSettingsModalProps> = ({
  config,
  isOpen,
  onClose,
  onSave,
}) => {
  const [mode, setMode] = useState<PayPalConfig['mode']>(config.mode);
  const [clientId, setClientId] = useState(config.clientId);
  const [clientSecret, setClientSecret] = useState(config.clientSecret);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/paypal/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, clientId, clientSecret }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: data.message });
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed' });
      }
    } catch {
      setTestResult({ success: false, message: 'Network error contacting PayPal server' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSave({
      mode,
      clientId,
      clientSecret,
      currency: 'USD',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Key className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-white">PayPal Developer Sandbox Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Mode Selector */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Environment Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('simulation')}
                className={`py-2 px-3 rounded-xl border text-center transition ${
                  mode === 'simulation'
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 font-semibold'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                High-Fidelity Sandbox Sim
              </button>
              <button
                type="button"
                onClick={() => setMode('live_sandbox')}
                className={`py-2 px-3 rounded-xl border text-center transition ${
                  mode === 'live_sandbox'
                    ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 font-semibold'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Live PayPal Developer Sandbox
              </button>
            </div>
          </div>

          {mode === 'live_sandbox' && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  PayPal Sandbox Client ID
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g. A21AA... or your Sandbox App Client ID"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  PayPal Sandbox Secret
                </label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="e.g. EL... or your Sandbox App Secret"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between text-slate-500">
                <a
                  href="https://developer.paypal.com/dashboard/applications/sandbox"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center space-x-1"
                >
                  <span>Get Sandbox Credentials on developer.paypal.com</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Test connection output */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border flex items-start space-x-2 ${
                testResult.success
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <span className="text-xs leading-tight">{testResult.message}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition flex items-center justify-center space-x-2"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying with PayPal API...</span>
              </>
            ) : (
              <span>Verify & Test OAuth2 Handshake</span>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
