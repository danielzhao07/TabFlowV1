import './style.css';
import { HudOverlay } from '@/components/hud/HudOverlay';
import ReactDOM from 'react-dom/client';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'tabflow-hud',
      position: 'overlay',
      anchor: 'body',
      onMount: (container) => {
        const wrapper = document.createElement('div');
        wrapper.id = 'tabflow-root';
        container.append(wrapper);
        const root = ReactDOM.createRoot(wrapper);
        root.render(<HudOverlay />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
