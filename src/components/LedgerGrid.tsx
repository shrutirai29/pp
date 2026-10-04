'use client';

import React, { useMemo, useRef, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from 'ag-grid-community';
import { Download, Search, ExternalLink, CheckCircle, Clock, AlertTriangle, Eye, ShieldCheck } from 'lucide-react';
import { TaskContract } from '@/types';

// Register AG Grid Community modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface LedgerGridProps {
  tasks: TaskContract[];
  onViewDeliverable: (task: TaskContract) => void;
}

export const LedgerGrid: React.FC<LedgerGridProps> = ({ tasks, onViewDeliverable }) => {
  const gridRef = useRef<AgGridReact<TaskContract>>(null);
  const [quickFilterText, setQuickFilterText] = useState('');

  // Dark quartz theme customized for high-tech aesthetic
  const customTheme = useMemo(() => {
    return themeQuartz.withParams({
      backgroundColor: '#020617', // slate-950
      foregroundColor: '#f1f5f9', // slate-100
      headerBackgroundColor: '#0f172a', // slate-900
      headerTextColor: '#94a3b8', // slate-400
      borderColor: '#1e293b', // slate-800
      oddRowBackgroundColor: '#020617',
      selectedRowBackgroundColor: '#1e293b',
      accentColor: '#38bdf8', // cyan-400
      fontFamily: 'inherit',
    });
  }, []);

  // Export to CSV using AG Grid API
  const handleExportCsv = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `payagent-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      });
    }
  }, []);

  // Column definitions
  const columnDefs = useMemo<ColDef<TaskContract>[]>(() => {
    return [
      {
        field: 'id',
        headerName: 'Task ID',
        width: 120,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: ICellRendererParams<TaskContract>) => (
          <span className="font-mono text-xs text-cyan-400 font-semibold">
            {params.value}
          </span>
        ),
      },
      {
        field: 'title',
        headerName: 'Contract Title',
        flex: 1.5,
        minWidth: 200,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: ICellRendererParams<TaskContract>) => (
          <div className="leading-tight py-1">
            <div className="font-medium text-slate-100 text-xs truncate">{params.data?.title}</div>
            <div className="text-[11px] text-slate-400 truncate">{params.data?.description}</div>
          </div>
        ),
      },
      {
        field: 'assignedAgentName',
        headerName: 'Assigned Agent',
        width: 160,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: ICellRendererParams<TaskContract>) => (
          <div className="flex items-center space-x-2 py-1">
            <span className="text-xs font-semibold text-slate-200">
              {params.data?.assignedAgentName}
            </span>
          </div>
        ),
      },
      {
        field: 'budget',
        headerName: 'Budget',
        width: 110,
        filter: 'agNumberColumnFilter',
        cellRenderer: (params: ICellRendererParams<TaskContract>) => (
          <span className="font-mono text-xs font-bold text-emerald-400">
            ${params.value?.toFixed(2)} USD
          </span>
        ),
      },
      {
        field: 'status',
        headerName: 'Escrow Status',
        width: 150,
        cellRenderer: (params: ICellRendererParams<TaskContract>) => {
          const status = params.value as TaskContract['status'];
          switch (status) {
            case 'paid':
              return (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium">
                  <CheckCircle className="w-3 h-3" />
                  <span>Settled (Paid)</span>
                </span>
              );
            case 'evaluating':
              return (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[11px] font-medium animate-pulse">
                  <ShieldCheck className="w-3 h-3" />
                  <span>QA Audit</span>
                </span>
              );
            case 'in_progress':
              return (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[11px] font-medium">
                  <Clock className="w-3 h-3" />
                  <span>In Progress</span>
                </span>
              );
            case 'escrow_authorized':
              return (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-medium">
                  <span>Escrow Locked</span>
                </span>
              );
            case 'disputed':
              return (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[11px] font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Disputed</span>
                </span>
              );
            default:
              return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[11px]">
                  <span>Pending</span>
                </span>
              );
          }
        },
      },
      {
        field: 'paypalPayoutBatchId',
        headerName: 'PayPal Tx Proof',
        width: 170,
        cellRenderer: (params: ICellRendererParams<TaskContract>) => {
          if (!params.value) {
            return <span className="text-slate-600 text-[11px] font-mono italic">Awaiting release</span>;
          }
          return (
            <div className="flex items-center space-x-1 text-xs font-mono text-blue-400">
              <span className="truncate max-w-[120px]" title={params.value}>
                {params.value}
              </span>
              <ExternalLink className="w-3 h-3 opacity-60 flex-shrink-0" />
            </div>
          );
        },
      },
      {
        headerName: 'QA Score',
        width: 110,
        cellRenderer: (params: ICellRendererParams<TaskContract>) => {
          const score = params.data?.deliverable?.qualityScore;
          if (score === undefined) return <span className="text-slate-600 text-xs font-mono">-</span>;
          return (
            <span
              className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                score >= 90
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : score >= 80
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {score}/100
            </span>
          );
        },
      },
      {
        headerName: 'Inspect',
        width: 100,
        pinned: 'right',
        cellRenderer: (params: ICellRendererParams<TaskContract>) => {
          const hasDeliverable = Boolean(params.data?.deliverable);
          return (
            <button
              onClick={() => params.data && onViewDeliverable(params.data)}
              disabled={!hasDeliverable}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1 disabled:opacity-30 disabled:cursor-not-allowed transition"
              title="View Deliverable & QA Report"
            >
              <Eye className="w-3 h-3 text-cyan-400" />
              <span>Audit</span>
            </button>
          );
        },
      },
    ];
  }, [onViewDeliverable]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-semibold text-white tracking-tight">
              AG Grid Real-Time Audit Ledger
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              AG Grid v36
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Cryptographic escrow holds, automated PayPal payouts, and QA score verification
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick Filter Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search contracts..."
              value={quickFilterText}
              onChange={(e) => setQuickFilterText(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-48 sm:w-56"
            />
          </div>

          {/* Export to CSV */}
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            title="Export Ledger to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* AG Grid Container */}
      <div className="h-[360px] w-full rounded-xl overflow-hidden border border-slate-800/80">
        <AgGridReact
          ref={gridRef}
          theme={customTheme}
          rowData={tasks}
          columnDefs={columnDefs}
          quickFilterText={quickFilterText}
          pagination={true}
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 20, 50]}
          defaultColDef={{
            sortable: true,
            resizable: true,
          }}
          rowHeight={46}
          headerHeight={38}
          suppressCellFocus={true}
        />
      </div>
    </div>
  );
};
