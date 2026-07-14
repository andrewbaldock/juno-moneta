import type { Meta, StoryObj } from '@storybook/react-vite'

// The landing page of the component explorer — orients a visitor and links back out
// to the app, the design system, the demo, and the source (Storybook is a separate origin,
// so these open in a new tab). Pinned first via storySort in .storybook/preview.tsx.
const meta = { title: 'Juno/Overview' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--mint-ink)', textDecoration: 'underline', textUnderlineOffset: 2 }}>{children}</a>
}

export const About: Story = {
  render: () => (
    <div style={{ maxWidth: 560, fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      <p style={{ fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--gold-ink)', margin: 0 }}>Component explorer</p>
      <h1 style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 36, margin: '4px 0 12px', lineHeight: 1.1 }}>Juno Moneta</h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--muted)', margin: 0 }}>
        The components behind Juno — a private financial companion for one household. Every story renders
        in the app's live design tokens; flip the <b style={{ color: 'var(--ink)' }}>Day / Night</b> toggle in
        the toolbar to check both. Browse the diagrams, motifs, workspace pieces, and base components in the sidebar.
      </p>
      <ul style={{ fontSize: 14, lineHeight: 2.1, marginTop: 18, listStyle: 'none', padding: 0 }}>
        <li>→ <A href="https://juno.andrewbaldock.com/design">The full design system</A></li>
        <li>→ <A href="https://juno-demo.andrewbaldock.com">Live demo — a fictional household, no login</A></li>
        <li>→ <A href="https://juno.andrewbaldock.com">The app</A></li>
        <li>→ <A href="https://github.com/andrewbaldock/juno-moneta">Source on GitHub</A></li>
        <li>→ <A href="https://andrewbaldock.com">Andrew Baldock — portfolio</A></li>
      </ul>
    </div>
  ),
}
