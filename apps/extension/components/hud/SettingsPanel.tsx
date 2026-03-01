import type { TabFlowSettings } from '@/lib/settings';
import type { TokenSet } from '@/lib/auth';

interface SettingsPanelProps {
  authUser: TokenSet | null;
  authLoading: boolean;
  authError: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  settings: TabFlowSettings | null;
  onSettingChange: (patch: Partial<TabFlowSettings>) => void;
  onClose: () => void;
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-white/75">{label}</div>
        {description && <div className="text-[11px] text-white/35 mt-0.5">{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="w-8 h-4.5 rounded-full shrink-0 transition-colors duration-150 relative"
        style={{
          backgroundColor: checked ? 'rgba(99,179,237,0.8)' : 'rgba(255,255,255,0.12)',
          width: 32,
          height: 18,
        }}
      >
        <span
          className="absolute top-0.5 rounded-full bg-white transition-transform duration-150"
          style={{
            width: 14,
            height: 14,
            left: 2,
            transform: checked ? 'translateX(14px)' : 'translateX(0)',
          }}
        />
      </button>
    </div>
  );
}

export function SettingsPanel({
  authUser,
  authLoading,
  authError,
  onSignIn,
  onSignOut,
  settings,
  onSettingChange,
  onClose,
}: SettingsPanelProps) {
  return (
    <>
      {/* Click-outside backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 2147483645 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-12 right-4 rounded-2xl overflow-hidden"
        style={{
          zIndex: 2147483646,
          width: 280,
          background: 'rgba(18, 18, 30, 0.92)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-[13px] font-semibold text-white/70 tracking-wide">Settings</span>
          <button
            onClick={onClose}
            className="w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-1">
          {/* Account section */}
          <div className="py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Account</div>
            {authUser ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-white/50 truncate">{authUser.email}</span>
                <button
                  onClick={onSignOut}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-white/10 text-white/40 hover:bg-white/[0.06] hover:text-white/60 transition-colors shrink-0"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {authError && (
                  <span className="text-[10px] text-red-400/70 truncate" title={authError}>
                    {authError}
                  </span>
                )}
                <button
                  onClick={onSignIn}
                  disabled={authLoading}
                  className="w-full text-[12px] py-1.5 rounded-lg border border-white/10 text-white/50 hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-40 transition-colors"
                >
                  {authLoading ? 'Signing in…' : 'Sign in'}
                </button>
              </div>
            )}
          </div>

          {/* View section */}
          <div className="py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] text-white/25 uppercase tracking-widest mb-1 mt-1">View</div>
            {settings && (
              <>
                <Toggle
                  label="Hide today's activity"
                  description="Hides the top-visited domains bar"
                  checked={settings.hideTodayTabs}
                  onChange={(v) => onSettingChange({ hideTodayTabs: v })}
                />
                <Toggle
                  label="Show pinned tabs"
                  checked={settings.showPinnedTabs}
                  onChange={(v) => onSettingChange({ showPinnedTabs: v })}
                />
              </>
            )}
          </div>

          {/* Tab suspender */}
          <div className="py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] text-white/25 uppercase tracking-widest mb-1 mt-1">Performance</div>
            {settings && (
              <Toggle
                label="Auto-suspend inactive tabs"
                description="Frees memory for tabs you haven't used"
                checked={settings.autoSuspend}
                onChange={(v) => onSettingChange({ autoSuspend: v })}
              />
            )}
          </div>

          {/* AI Agent */}
          <div className="py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] text-white/25 uppercase tracking-widest mb-2 mt-1">AI Agent</div>
            {settings !== null && (
              <div className="flex flex-col gap-1">
                <input
                  type="password"
                  value={settings.groqApiKey ?? ''}
                  onChange={(e) => onSettingChange({ groqApiKey: e.target.value })}
                  placeholder="Groq API key…"
                  className="w-full rounded-lg px-2.5 py-1.5 text-[12px] text-white/70 placeholder-white/25 outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                />
                <span className="text-[10px] text-white/25">
                  Free key at{' '}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/40 hover:text-white/60 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    console.groq.com/keys
                  </a>
                  {' '}· Use @ in search to activate
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="py-3">
            <button
              onClick={() => {
                chrome.runtime.openOptionsPage();
                onClose();
              }}
              className="w-full flex items-center justify-between text-[12px] text-white/35 hover:text-white/60 transition-colors"
            >
              <span>Full settings</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
