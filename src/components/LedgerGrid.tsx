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
import { Download, Search, ExternalLink, Eye, MoreVertical, SlidersHorizontal } from 'lucide-react';
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

  // Clean Light Mode Quartz theme matching the reference dashboard
  const lightQuartzTheme = useMemo(() => {
    return themeQuartz.withParams({
      backgroundColor: '#FFFFFF',
      foregroundColor: '#101936',
      headerBackgroundColor: '#F8FAFC',
      headerTextColor: '#64748B',
      borderColor: '#E2E8F0',
      oddRowBackgroundColor: '#FFFFFF',
      selectedRowBackgroundColor: '#F1F5F9',
      accentColor: '#4361F7',
      fontFamily: 'inherit',
    });
  }, []);

  // Export to CSV using AG Grid API
  const handleExportCsv = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `payagent-audit-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      });
    }
  }, []);

  // Column definitions matching reference image
  const columnDefs = useMemo<ColDef<TaskContract>[]>(() => {
    return [
      {
        field: 'id',
        headerName: 'Task ID',
        width: 110,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: ICellRendererParams<TaskContract>) => (
          <span className="font-mono text-xs text-[#4361F7] font-bold">
            {params.value}
          </span>
        ),
      },
      {
        field: 'title',
        headerName: 'Contract Title',
        flex: 1.5,
        minWidth: 190,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: ICellRendererParams<TaskContract>) => (
          <span className="font-medium text-[#101936] text-xs">
            {params.value}
          </span>
        ),
      },
      {
        field: 'assignedAgentName',
        headerName: 'Assigned Agent',
        width: 140,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: ICellRendererParams<TaskContract>) => {
          const agentName = params.data?.assignedAgentName || 'Agent';
          return (
            <div className="flex items-center space-x-1.5 py-1">
              <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px]">
                {agentName === 'Nova' ? '🛰️' : agentName === 'Cipher' ? '🛡️' : agentName === 'Synthex' ? '⚡' : '📈'}
              </div>
              <span className="text-xs font-semibold text-slate-800">
                {agentName}
              </span>
            </div>
          );
        },
      },
      {
        field: 'budget',
        headerName: 'Budget',
        width: 100,
        filter: 'agNumberColumnFilter',
        cellRenderer: (params: ICellRendererParams<TaskContract>) => (
          <span className="font-mono text-xs font-bold text-slate-800">
            ${params.value?.toFixed(2)}
          </span>
        ),
      },
      {
        field: 'status',
        headerName: 'Escrow Status',
        width: 145,
        cellRenderer: (params: ICellRendererParams<TaskContract>) => {
          const status = params.value as TaskContract['status'];
          switch (status) {
            case 'settled':
              return (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Settled / Paid</span>
                </span>
              );
            case 'under_qa':
              return (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Under QA</span>
                </span>
              );
            case 'in_progress':
              return (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>In Progress</span>
                </span>
              );
            case 'escrow_authorized':
              return (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  <span>Escrow Locked</span>
                </span>
              );
            case 'disputed':
              return (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Disputed</span>
                </span>
              );
            default:
              return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px]">
                  <span>Pending</span>
                </span>
              );
          }
        },
      },
      {
        headerName: 'QA Score',
        width: 95,
        cellRenderer: (params: ICellRendererParams<TaskContract>) => {
          const score = params.data?.deliverable?.qualityScore;
          if (score === undefined) return <span className="text-slate-400 text-xs font-mono">—</span>;
          const isHigh = score >= 90;
          const isMid = score >= 75;
          return (
            <span
              className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                isHigh
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : isMid
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-rose-100 text-rose-700 border border-rose-200'
              }`}
            >
              {score}
            </span>
          );
        },
      },
      {
        field: 'paypalPayoutBatchId',
        headerName: 'PayPal Tx Proof',
        width: 170,
        cellRenderer: (params: ICellRendererParams<TaskContract>) => {
          const val = params.value || params.data?.paypalOrderId || params.data?.paypalAuthorizationId;
          if (!val) {
            return <span className="text-slate-400 text-xs font-mono">—</span>;
          }
          return (
            <div className="flex items-center space-x-1 text-xs font-mono text-[#4361F7] hover:underline cursor-pointer">
              <span className="truncate max-w-[120px]">{val}</span>
              <ExternalLink className="w-3 h-3 opacity-70 flex-shrink-0" />
            </div>
          );
        },
      },
      {
        headerName: 'Actions',
        width: 110,
        pinned: 'right',
        cellRenderer: (params: ICellRendererParams<TaskContract>) => (
          <div className="flex items-center space-x-1 py-1">
            <button
              onClick={() => params.data && onViewDeliverable(params.data)}
              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#4361F7] text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
            >
              <Eye className="w-3 h-3" />
              <span>Inspect</span>
            </button>
            <button className="p-1 text-slate-400 hover:text-slate-600">
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ];
  }, [onViewDeliverable]);

  return (
    <div className="bg-white border border-[#E3E8F5] rounded-3xl p-5 shadow-sm">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-[11px] font-black">
            P
          </div>
          <h3 className="text-sm font-bold text-[#101936]">AG Grid</h3>
          <span className="flex items-center space-x-1 text-[11px] text-slate-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Live Contract Ledger</span>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick Filter Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search contracts, agents..."
              value={quickFilterText}
              onChange={(e) => setQuickFilterText(e.target.value)}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#4361F7] w-48 sm:w-56"
            />
          </div>

          {/* Export to CSV */}
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-[#E2E8F0] shadow-sm transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Column Toggle / Filter */}
          <button
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-[#E2E8F0] shadow-sm transition cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Columns</span>
          </button>
        </div>
      </div>

      {/* AG Grid Container */}
      <div className="h-[290px] w-full rounded-2xl overflow-hidden border border-[#E2E8F0]">
        <AgGridReact
          ref={gridRef}
          theme={lightQuartzTheme}
          rowData={tasks}
          columnDefs={columnDefs}
          quickFilterText={quickFilterText}
          pagination={false}
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
