import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'TabFlow',
    description: 'Alt+Tab style tab switching with fuzzy search',
    version: '0.1.0',
    permissions: ['tabs', 'activeTab', 'storage', 'favicon', 'sessions', 'tabGroups', 'alarms', 'identity'],
    commands: {
      'toggle-hud': {
        suggested_key: {
          default: 'Alt+Q',
          windows: 'Alt+Q',
          mac: 'Alt+Q',
        },
        description: 'Toggle TabFlow HUD overlay',
      },
    },
  },
});
