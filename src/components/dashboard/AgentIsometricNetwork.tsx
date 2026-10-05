'use client';

import React from 'react';
import { Agent } from '@/types';

interface AgentIsometricNetworkProps {
  agents: Agent[];
  activeAgentId?: string;
  onSelectAgent?: (agent: Agent) => void;
}

export const AgentIsometricNetwork: React.FC<AgentIsometricNetworkProps> = ({
  agents,
  activeAgentId,
  onSelectAgent,
}) => {
  const nova = agents.find((a) => a.id === 'agent_nova');
  const cipher = agents.find((a) => a.id === 'agent_cipher');
  const synthex = agents.find((a) => a.id === 'agent_synthex');
  const metric = agents.find((a) => a.id === 'agent_metric');

  return (
    <div className="relative w-full h-[320px] lg:h-[340px] flex items-center justify-center select-none overflow-hidden">
      {/* Background radial gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-purple-500/10 to-cyan-400/10 rounded-3xl blur-2xl pointer-events-none" />

      {/* Isometric Grid Floor / Circuit Lines (SVG) */}
      <svg
        viewBox="0 0 600 360"
        className="w-full h-full max-w-[580px] drop-shadow-md"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="cyanLine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#44C8F5" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4361F7" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="purpleLine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8055F7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#44C8F5" stopOpacity="0.4" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Circular Ring */}
        <ellipse cx="300" cy="180" rx="230" ry="115" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="4 6" />
        <ellipse cx="300" cy="180" rx="170" ry="85" stroke="#CBD5E1" strokeWidth="1.5" />

        {/* Illuminated Connecting Bus Lines */}
        {/* Center to Nova (Top-Left) */}
        <path d="M 300 170 L 160 85" stroke="url(#purpleLine)" strokeWidth="3" filter="url(#glow)" />
        <path d="M 300 170 L 160 85" stroke="#FFFFFF" strokeWidth="1" />

        {/* Center to Cipher (Top-Right) */}
        <path d="M 300 170 L 440 85" stroke="url(#cyanLine)" strokeWidth="3" filter="url(#glow)" />
        <path d="M 300 170 L 440 85" stroke="#FFFFFF" strokeWidth="1" />

        {/* Center to Synthex (Bottom-Left) */}
        <path d="M 300 190 L 170 270" stroke="url(#purpleLine)" strokeWidth="3" filter="url(#glow)" />
        <path d="M 300 190 L 170 270" stroke="#FFFFFF" strokeWidth="1" />

        {/* Center to Metric (Bottom-Right) */}
        <path d="M 300 190 L 430 270" stroke="url(#cyanLine)" strokeWidth="3" filter="url(#glow)" />
        <path d="M 300 190 L 430 270" stroke="#FFFFFF" strokeWidth="1" />

        {/* Pulse particles travelling along the line */}
        <circle cx="230" cy="127" r="4" fill="#44C8F5" filter="url(#glow)">
          <animate attributeName="opacity" values="0.2;1;0.2" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="370" cy="127" r="4" fill="#44C8F5" filter="url(#glow)">
          <animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="235" cy="230" r="4" fill="#8055F7" filter="url(#glow)">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx="365" cy="230" r="4" fill="#10B981" filter="url(#glow)">
          <animate attributeName="opacity" values="1;0.3;1" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* CENTRAL 3D PAYPAL ILLUMINATED CUBE PEDESTAL */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 pointer-events-none">
        <div className="relative group">
          {/* Glowing pedestal base */}
          <div className="w-24 h-12 bg-gradient-to-b from-blue-400/30 to-blue-600/50 rounded-[100%] blur-sm translate-y-7" />
          
          {/* Isometric Cube Body */}
          <div className="relative w-20 h-20 bg-gradient-to-tr from-[#003087] via-[#0070BA] to-[#00CFDE] rounded-2xl shadow-xl shadow-blue-500/40 p-1 flex items-center justify-center transform -rotate-6 hover:rotate-0 transition-transform duration-500">
            {/* Inner Glass Facet */}
            <div className="w-full h-full bg-gradient-to-br from-white/25 via-blue-900/60 to-blue-950/90 rounded-xl backdrop-blur-md border border-white/40 flex items-center justify-center">
              <span className="text-3xl font-black text-white font-sans tracking-tight drop-shadow-[0_2px_10px_rgba(255,255,255,0.8)]">
                P
              </span>
            </div>
            {/* Top glass highlight */}
            <div className="absolute top-1 left-2 right-2 h-4 bg-white/30 rounded-t-lg blur-[1px]" />
          </div>
        </div>
      </div>

      {/* 1. AGENT NOVA (Top-Left: Explorer Robot, Violet) */}
      <div
        onClick={() => nova && onSelectAgent?.(nova)}
        className="absolute top-2 left-6 sm:left-12 flex flex-col items-center cursor-pointer group transition-all duration-300 hover:scale-105 z-30"
      >
        <div className="relative">
          {/* Pedestal */}
          <div className="w-16 h-8 bg-purple-500/20 rounded-[100%] blur-[2px] translate-y-8" />
          {/* 3D Robot Avatar Card */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-purple-50 to-purple-100 border-2 border-purple-300 shadow-lg shadow-purple-500/20 flex items-center justify-center relative overflow-hidden">
            <span className="text-2xl transform group-hover:scale-110 transition-transform">🛰️</span>
            {/* Goggles / Sensor light */}
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-500 animate-ping" />
          </div>
        </div>
        <div className="mt-1 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full border border-purple-200 shadow-sm flex items-center space-x-1">
          <span className="text-[11px] font-bold text-slate-800">Nova</span>
          <span className="text-[9px] text-purple-600 font-medium">Data Harvester</span>
        </div>
      </div>

      {/* 2. AGENT CIPHER (Top-Right: Security Auditor, Dark Blue) */}
      <div
        onClick={() => cipher && onSelectAgent?.(cipher)}
        className="absolute top-2 right-6 sm:right-12 flex flex-col items-center cursor-pointer group transition-all duration-300 hover:scale-105 z-30"
      >
        <div className="relative">
          {/* Pedestal */}
          <div className="w-16 h-8 bg-blue-600/20 rounded-[100%] blur-[2px] translate-y-8" />
          {/* 3D Robot Avatar Card */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-blue-50 to-blue-100 border-2 border-blue-400 shadow-lg shadow-blue-600/20 flex items-center justify-center relative overflow-hidden">
            <span className="text-2xl transform group-hover:scale-110 transition-transform">🛡️</span>
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          </div>
        </div>
        <div className="mt-1 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full border border-blue-200 shadow-sm flex items-center space-x-1">
          <span className="text-[11px] font-bold text-slate-800">Cipher</span>
          <span className="text-[9px] text-blue-600 font-medium">Security Auditor</span>
        </div>
      </div>

      {/* 3. AGENT SYNTHEX (Bottom-Left: Technical Writer, Pink/Lavender) */}
      <div
        onClick={() => synthex && onSelectAgent?.(synthex)}
        className="absolute bottom-2 left-8 sm:left-14 flex flex-col items-center cursor-pointer group transition-all duration-300 hover:scale-105 z-30"
      >
        <div className="relative">
          {/* Pedestal */}
          <div className="w-16 h-8 bg-pink-500/20 rounded-[100%] blur-[2px] translate-y-8" />
          {/* 3D Robot Avatar Card */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-pink-50 to-pink-100 border-2 border-pink-300 shadow-lg shadow-pink-500/20 flex items-center justify-center relative overflow-hidden">
            <span className="text-2xl transform group-hover:scale-110 transition-transform">⚡</span>
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-pink-500 animate-ping" />
          </div>
        </div>
        <div className="mt-1 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full border border-pink-200 shadow-sm flex items-center space-x-1">
          <span className="text-[11px] font-bold text-slate-800">Synthex</span>
          <span className="text-[9px] text-pink-600 font-medium">Technical Writer</span>
        </div>
      </div>

      {/* 4. AGENT METRIC (Bottom-Right: Market Quant, Mint Green) */}
      <div
        onClick={() => metric && onSelectAgent?.(metric)}
        className="absolute bottom-2 right-8 sm:right-14 flex flex-col items-center cursor-pointer group transition-all duration-300 hover:scale-105 z-30"
      >
        <div className="relative">
          {/* Pedestal */}
          <div className="w-16 h-8 bg-emerald-500/20 rounded-[100%] blur-[2px] translate-y-8" />
          {/* 3D Robot Avatar Card */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-emerald-50 to-emerald-100 border-2 border-emerald-300 shadow-lg shadow-emerald-500/20 flex items-center justify-center relative overflow-hidden">
            <span className="text-2xl transform group-hover:scale-110 transition-transform">📈</span>
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </div>
        </div>
        <div className="mt-1 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full border border-emerald-200 shadow-sm flex items-center space-x-1">
          <span className="text-[11px] font-bold text-slate-800">Metric</span>
          <span className="text-[9px] text-emerald-600 font-medium">Market Quant</span>
        </div>
      </div>
    </div>
  );
};
