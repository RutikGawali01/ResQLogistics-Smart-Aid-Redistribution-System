import React, { useState } from 'react';
import { ENDPOINT_PREFIXES, ERROR_CODES } from '@aidflow/shared';
import { Terminal, Send, CheckCircle2, Copy, Check } from 'lucide-react';
import { api } from '../services/api.js';

export function ContractsExplorer({ forceMock }) {
  const [activeTab, setActiveTab] = useState('endpoints');
  const [endpointResult, setEndpointResult] = useState(null);
  const [loadingEndpoint, setLoadingEndpoint] = useState(null);
  const [copied, setCopied] = useState(false);

  const endpointList = [
    { prefix: ENDPOINT_PREFIXES.HEALTH, method: 'GET', desc: 'Cluster telemetry, DB, and Socket.IO status', action: () => api.checkHealth(forceMock) },
    { prefix: ENDPOINT_PREFIXES.DONATIONS, method: 'GET', desc: 'List surplus food and essential aid inventory', action: () => api.getDonations(forceMock) },
    { prefix: ENDPOINT_PREFIXES.SHELTERS, method: 'GET', desc: 'List active shelters, occupancy, and urgency levels', action: () => api.getShelters(forceMock) },
    { prefix: ENDPOINT_PREFIXES.RIDERS, method: 'GET', desc: 'Courier status, vehicle capability, and locations', action: () => api.getRiders(forceMock) },
    { prefix: ENDPOINT_PREFIXES.ASSIGNMENTS, method: 'GET', desc: 'Delivery assignments and state machine lifecycle', action: () => api.getAssignments(forceMock) },
    { prefix: ENDPOINT_PREFIXES.DISPATCH, method: 'GET', desc: 'Automated dispatch matching & recommendation engine', action: async () => ({ success: true, data: { status: 'OPTIMAL', unassignedDonations: 1, activeRiders: 2 }, isMock: true }) }
  ];

  const handleTestEndpoint = async (ep) => {
    setLoadingEndpoint(ep.prefix);
    try {
      const res = await ep.action();
      setEndpointResult({
        prefix: ep.prefix,
        method: ep.method,
        response: res
      });
    } catch (err) {
      setEndpointResult({
        prefix: ep.prefix,
        method: ep.method,
        response: { success: false, error: { message: err.message } }
      });
    } finally {
      setLoadingEndpoint(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sampleSuccessEnvelope = {
    success: true,
    data: { id: 'asg_123', status: 'ACCEPTED' },
    message: 'Assignment accepted successfully',
    meta: { page: 1, total: 1 },
    timestamp: '2026-10-23T07:00:00.000Z'
  };

  const sampleErrorEnvelope = {
    success: false,
    error: {
      code: ERROR_CODES.INVALID_STATE_TRANSITION,
      message: 'Invalid transition from "UNASSIGNED" to "DELIVERED"',
      details: { allowedNext: ['PENDING_ACCEPTANCE', 'CANCELLED'] }
    },
    timestamp: '2026-10-23T07:00:00.000Z'
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800/80 mb-4 gap-2">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Shared API Contracts & Endpoint Explorer
          </h2>
          <p className="text-xs text-slate-400">
            Enforced contracts allowing independent frontend and backend iteration
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('endpoints')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              activeTab === 'endpoints' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Endpoint Prefixes
          </button>
          <button
            onClick={() => setActiveTab('envelopes')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              activeTab === 'envelopes' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Envelope Standard
          </button>
        </div>
      </div>

      {activeTab === 'endpoints' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Endpoint buttons */}
          <div className="space-y-2">
            {endpointList.map((ep) => (
              <div
                key={ep.prefix}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {ep.method}
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-200">{ep.prefix}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{ep.desc}</p>
                </div>

                <button
                  onClick={() => handleTestEndpoint(ep)}
                  disabled={loadingEndpoint === ep.prefix}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3 h-3 text-emerald-400" />
                  {loadingEndpoint === ep.prefix ? 'Calling...' : 'Send'}
                </button>
              </div>
            ))}
          </div>

          {/* Response Inspector */}
          <div className="bg-[#0A0D14] rounded-xl p-4 border border-slate-800/80 flex flex-col font-mono text-xs h-[300px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
              <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                Contract Response Inspector
              </span>
              {endpointResult && (
                <button
                  onClick={() => copyToClipboard(JSON.stringify(endpointResult.response, null, 2))}
                  className="text-slate-400 hover:text-white text-[11px] flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto text-emerald-300 text-[11px] leading-relaxed">
              {endpointResult ? (
                <pre>{JSON.stringify(endpointResult.response, null, 2)}</pre>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 italic">
                  Click 'Send' on any endpoint above to test the contract payload.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Success Contract */}
          <div className="bg-[#0A0D14] rounded-xl p-4 border border-emerald-500/20 font-mono text-xs">
            <div className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Standard Success Envelope
            </div>
            <pre className="text-emerald-300/90 text-[11px] overflow-x-auto leading-relaxed">
              {JSON.stringify(sampleSuccessEnvelope, null, 2)}
            </pre>
          </div>

          {/* Error Contract */}
          <div className="bg-[#0A0D14] rounded-xl p-4 border border-rose-500/20 font-mono text-xs">
            <div className="text-xs font-bold text-rose-400 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Standard Error Envelope
            </div>
            <pre className="text-rose-300/90 text-[11px] overflow-x-auto leading-relaxed">
              {JSON.stringify(sampleErrorEnvelope, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
