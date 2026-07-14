import type { StorybookConfig } from '@storybook/react-vite'
import tailwindcss from '@tailwindcss/vite'

// Storybook 10 + react-vite. We push the app's Tailwind v4 plugin into Storybook's own
// Vite config via viteFinal, so component classes render exactly as they do in the app.
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: { name: '@storybook/react-vite', options: {} },
  viteFinal: async (cfg) => {
    cfg.plugins = cfg.plugins || []
    cfg.plugins.push(tailwindcss())
    return cfg
  },
}
export default config
