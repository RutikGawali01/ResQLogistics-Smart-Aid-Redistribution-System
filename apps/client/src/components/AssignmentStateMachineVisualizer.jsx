import React, { useState } from 'react';
import {
  ALL_ASSIGNMENT_STATUSES,
  VALID_ASSIGNMENT_TRANSITIONS,
  canTransitionAssignment,
  ASSIGNMENT_STATUS
} from '@aidflow/shared';
import {
  Workflow,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  ShieldAlert,
  Clock
} from 'lucide-react';

export function AssignmentStateMachineVisualizer({ assignments = [], onTransition, isLiveBackend }) {
  const [currentStatus, setCurrentStatus] = useState(ASSIGNMENT_STATUS.UNASSIGNED);
  const [transitionHistory, setTransitionHistory] = useState([
    {
      from: null,
      to: ASSIGNMENT_STATUS.UNASSIGNED,
      timestamp: new Date().toLocaleTimeString(),
      success: true
    }
  ]);
  const [lastError, setLastError] = useState(null);

  const allowedNextStates = VALID_ASSIGNMENT_TRANSITIONS[currentStatus] || [];

  const handleTransition = async (targetStatus) => {
    setLastError(null);
    const check = canTransitionAssignment(currentStatus, targetStatus);

    if (!check.valid) {
      setLastError({
        code: 'INVALID_STATE_TRANSITION',
        message: check.reason,
        attempted: targetStatus,
        current: currentStatus
      });
      return;
    }

    if (onTransition) {
      const match = assignments.find((a) => a.status === currentStatus);
      if (match) {
        try {
          await onTransition(match.id || match._id, targetStatus);
        } catch (err) {
          console.warn('Transition hook error:', err);
        }
      }
    }

    setTransitionHistory((prev) => [
      {
        from: currentStatus,
        to: targetStatus,
        timestamp: new Date().toLocaleTimeString(),
        success: true
      },
      ...prev.slice(0, 5)
    ]);
    setCurrentStatus(targetStatus);
  };

  const handleTestIllegalJump = () => {
    // Attempt an illegal jump directly to DELIVERED from non-deliverable state
    const illegalTarget = ASSIGNMENT_STATUS.DELIVERED;
    const check = canTransitionAssignment(currentStatus, illegalTarget);

    if (!check.valid) {
      setLastError({
        code: 'INVALID_STATE_TRANSITION',
        message: check.reason,
        attempted: illegalTarget,
        current: currentStatus
      });
    } else {
      handleTransition(illegalTarget);
    }
  };

  const handleReset = () => {
    setCurrentStatus(ASSIGNMENT_STATUS.UNASSIGNED);
    setLastError(null);
    setTransitionHistory((prev) => [
      {
        from: currentStatus,
        to: ASSIGNMENT_STATUS.UNASSIGNED,
        timestamp: new Date().toLocaleTimeString(),
        success: true
      },
      ...prev.slice(0, 5)
    ]);
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800/80 mb-4 gap-2">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Workflow className="w-4 h-4 text-emerald-400" />
            Assignment Lifecycle State Machine
          </h2>
          <p className="text-xs text-slate-400">
            Enforces strict state transitions with standard error contracts
          </p>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset State
        </button>
      </div>

      {/* Visual State Pipeline */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
        {ALL_ASSIGNMENT_STATUSES.map((status) => {
          const isCurrent = currentStatus === status;
          const isAllowed = allowedNextStates.includes(status);
          const isTerminal = ['DELIVERED', 'CANCELLED', 'FAILED'].includes(status);

          return (
            <div
              key={status}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                isCurrent
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/50'
                  : isAllowed
                  ? 'bg-slate-800/60 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 cursor-pointer'
                  : 'bg-slate-900/40 border-slate-800/60 text-slate-500 opacity-60'
              }`}
            >
              <div className="text-[10px] uppercase font-mono tracking-wider mb-1 flex items-center justify-center gap-1">
                {isCurrent && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                {isTerminal ? 'Terminal' : 'Active State'}
              </div>
              <div className="text-xs truncate">{status.replace(/_/g, ' ')}</div>
            </div>
          );
        })}
      </div>

      {/* Control Actions */}
      <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 mb-4">
        <div className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
          <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
          Permitted Transitions from <span className="font-mono text-emerald-400">"{currentStatus}"</span>:
        </div>

        <div className="flex flex-wrap gap-2">
          {allowedNextStates.length === 0 ? (
            <span className="text-xs text-amber-400 italic">
              Terminal state reached. No further transitions permitted.
            </span>
          ) : (
            allowedNextStates.map((next) => (
              <button
                key={next}
                onClick={() => handleTransition(next)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 transition-all flex items-center gap-1.5"
              >
                Transition to {next.replace(/_/g, ' ')}
              </button>
            ))
          )}

          {/* Test illegal transition button */}
          {!['DELIVERED', 'DELIVERY_IN_PROGRESS'].includes(currentStatus) && (
            <button
              onClick={handleTestIllegalJump}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all flex items-center gap-1.5"
              title="Deliberately attempt an illegal jump to test contract validation and error handling"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Test Illegal Jump to DELIVERED
            </button>
          )}
        </div>
      </div>

      {/* Error Alert Display */}
      {lastError && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-rose-300 font-mono">[{lastError.code}] Contract Violation</div>
            <div className="text-rose-200 mt-0.5">{lastError.message}</div>
          </div>
        </div>
      )}

      {/* Transition Log */}
      <div className="mt-auto pt-3 border-t border-slate-800/80">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-slate-400" /> Recent Transition History
        </div>
        <div className="space-y-1">
          {transitionHistory.map((item, idx) => (
            <div
              key={idx}
              className="text-xs font-mono flex items-center justify-between text-slate-400 bg-slate-900/40 px-2.5 py-1 rounded"
            >
              <span>
                {item.from ? `${item.from} → ` : 'INITIALIZED: '}
                <span className="text-emerald-400 font-bold">{item.to}</span>
              </span>
              <span className="text-[10px] text-slate-500">{item.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
