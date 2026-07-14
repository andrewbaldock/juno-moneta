import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

// A toolbar toggle drives data-mode, so every story is checkable in day and night —
// the same mechanism the app uses. Stories sit on the parchment ground.
const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: { expanded: true },
  },
  globalTypes: {
    mode: {
      description: 'Day / night',
      defaultValue: 'light',
      toolbar: {
        title: 'Mode',
        icon: 'sun',
        items: [
          { value: 'light', title: 'Day' },
          { value: 'dark', title: 'Night' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, ctx) => {
      document.documentElement.setAttribute('data-mode', ctx.globals.mode === 'dark' ? 'dark' : 'light')
      return (
        <div style={{ background: 'var(--page)', color: 'var(--ink)', padding: 28, borderRadius: 14 }}>
          <Story />
        </div>
      )
    },
  ],
}
export default preview
