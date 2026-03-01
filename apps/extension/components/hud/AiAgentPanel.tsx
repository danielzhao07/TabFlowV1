import type { AgentAction } from '@/lib/agent';
import { describeAction } from '@/lib/agent';

interface AiAgentPanelProps {
  message: string;
  actions: AgentAction[];
  completedCount: number;
  onDismiss: () => void;
}

export function AiAgentPanel({ message, actions, completedCount, onDismiss }: AiAgentPanelProps) {
  return (
    <div
      className="mx-3 mb-1"
      style={{ animation: 'contextMenuIn 140ms ease-out' }}
    >
      <div
        style={{
          background: 'rgba(18,14,40,0.92)',
          border: '1px solid rgba(160,140,255,0.25)',
          backdropFilter: 'blur(20px)',
          borderRadius: 14,
          padding: '10px 14px',
        }}
      >
        {/* Header row: sparkle + message + dismiss */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <svg className="shrink-0" width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 1l1.5 4.5L14 8l-4.5 1.5L8 15l-1.5-4.5L2 8l4.5-1.5L8 1z" fill="rgba(160,140,255,0.85)" />
            </svg>
            <span className="text-[12px] text-white/80 leading-snug">{message}</span>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 text-white/25 hover:text-white/55 transition-colors"
            style={{ marginTop: 1 }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Actions list */}
        {actions.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {actions.map((action, i) => {
              const done = i < completedCount;
              const pending = i >= completedCount;
              return (
                <div key={i} className="flex items-center gap-2">
                  {done ? (
                    <svg className="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(129,201,149,0.9)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <div
                      className="shrink-0 rounded-full border border-white/20"
                      style={{
                        width: 12,
                        height: 12,
                        borderColor: pending ? 'rgba(160,140,255,0.4)' : 'rgba(255,255,255,0.2)',
                        animation: i === completedCount ? 'spin 1s linear infinite' : undefined,
                      }}
                    />
                  )}
                  <span
                    className="text-[11px]"
                    style={{ color: done ? 'rgba(129,201,149,0.8)' : 'rgba(255,255,255,0.45)' }}
                  >
                    {describeAction(action)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function AiThinkingBar() {
  return (
    <div className="mx-3 mb-1">
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          background: 'rgba(18,14,40,0.85)',
          border: '1px solid rgba(160,140,255,0.2)',
          borderRadius: 10,
          animation: 'contextMenuIn 140ms ease-out',
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 16 16"
          fill="none"
          style={{ animation: 'spin 2s linear infinite' }}
        >
          <path d="M8 1l1.5 4.5L14 8l-4.5 1.5L8 15l-1.5-4.5L2 8l4.5-1.5L8 1z" fill="rgba(160,140,255,0.7)" />
        </svg>
        <span className="text-[11px]" style={{ color: 'rgba(160,140,255,0.7)' }}>Thinking…</span>
      </div>
    </div>
  );
}
