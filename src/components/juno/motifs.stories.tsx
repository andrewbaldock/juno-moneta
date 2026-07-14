import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  COIN_SRC, MarkOwn, MarkSavings, MarkSpending, MarkIncome, MarkOwe,
  Sun, Moon, Rays, TempleGarden,
} from './motifs'

const meta = { title: 'Juno/Motifs' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Coin: Story = {
  name: 'The coin (logo)',
  render: () => <img src={COIN_SRC} width={112} height={112} alt="The Juno coin" />,
}

export const Marks: Story = {
  name: 'Line marks',
  render: () => (
    <div className="flex items-center gap-6 [&_svg]:w-9 [&_svg]:h-9">
      <MarkOwn /><MarkSavings /><MarkSpending /><MarkIncome /><MarkOwe />
    </div>
  ),
}

export const DayNight: Story = {
  name: 'Sun / Moon',
  render: () => (
    <div className="flex items-center gap-6 [&_svg]:w-8 [&_svg]:h-8">
      <Sun /><Moon />
    </div>
  ),
}

export const Beam: Story = {
  name: 'Rays (beam)',
  render: () => <div className="w-40 h-40 grid place-items-center [&_svg]:w-full [&_svg]:h-full"><Rays /></div>,
}

export const Garden: Story = {
  name: 'Temple garden',
  render: () => <div style={{ color: 'var(--mint)' }}><TempleGarden w={360} h={140} coin={0} /></div>,
}
