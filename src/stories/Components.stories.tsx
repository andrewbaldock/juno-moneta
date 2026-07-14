import type { Meta, StoryObj } from '@storybook/react-vite'

// The house UI vocabulary — all plain CSS classes from index.css, shown together so the
// token system reads at a glance. Flip the toolbar Mode to check day and night.
const meta = { title: 'Juno/Components' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2.5">
      <button type="button" className="btn-mint">Primary (mint)</button>
      <button type="button" className="btn-gold">What-if (gold)</button>
      <button type="button" className="btn-quiet">Quiet</button>
    </div>
  ),
}

export const Chips: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="whopill">Name pill</span>
      <span className="pchip">amber chip</span>
      <span className="bluechip">mint chip</span>
    </div>
  ),
}

export const Field: Story = {
  render: () => <input className="field" style={{ width: 220 }} placeholder="A field" readOnly />,
}

export const Voice: Story = {
  render: () => (
    <div className="rounded-xl border border-gold-line bg-card p-4" style={{ maxWidth: 460 }}>
      <p className="voice text-[15px]" style={{ color: 'var(--ink)' }}>
        “Evening. The month runs about <span className="n">$840</span> out at the current pace, with{' '}
        <span className="n">14 months</span> of runway behind it. Nothing to fix tonight.”
      </p>
    </div>
  ),
}
