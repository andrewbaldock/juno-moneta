import type { Meta, StoryObj } from '@storybook/react-vite'
import { CompositionBars, LineChart, AccountCard } from './Dashboard'
import { MOCK_ACCOUNTS, CASH_POINTS } from './Design'
import { MarkOwn, MarkSavings, MarkOwe } from '../components/juno/motifs'

// The real workspace components, on the same mock ledger the /design page uses.
// Storybook runs in demo mode (VITE_DEMO=true) so the Supabase client stays a placeholder.
const meta = { title: 'Juno/Workspace', parameters: { layout: 'padded' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Cards: Story = {
  name: 'Account cards',
  render: () => (
    <div className="cards" style={{ maxWidth: 760 }}>
      <AccountCard mark={<MarkOwn />} name="What you own" balance="$997,400" />
      <AccountCard mark={<MarkSavings />} name="Savings & liquid" balance="$60,400" whisper="≈ 5 years of runway" />
      <AccountCard mark={<MarkOwe />} name="What you owe" balance="$466,000" />
    </div>
  ),
}

export const Banners: Story = {
  render: () => (
    <div style={{ maxWidth: 760 }}>
      <div className="prov"><b style={{ fontWeight: 500 }}>Provisional</b> — a couple of balances aren't entered yet, so they're left out of the totals rather than counted as $0.</div>
      <div className="mnet">
        <span className="lab">Kept each month, at current pace · runway 5+ yrs</span>
        <span className="v">+$3,101.67</span>
      </div>
    </div>
  ),
}

export const Composition: Story = {
  name: 'Composition strip',
  render: () => <div style={{ maxWidth: 760 }}><CompositionBars accounts={MOCK_ACCOUNTS} /></div>,
}

export const CashProjection: Story = {
  name: 'Cash projection chart',
  render: () => <div style={{ width: 640, maxWidth: '100%' }}><LineChart points={CASH_POINTS} showZero floor={3000000} /></div>,
}
