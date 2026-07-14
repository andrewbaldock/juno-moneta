import type { Meta, StoryObj } from '@storybook/react-vite'
import { FlowDiagram, LoopDiagram, GrowDiagram, AgentDiagram, GroundedDiagram } from './diagrams'

const meta = {
  title: 'Juno/Diagrams',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const LedgerToNumbers: Story = { name: 'Ledger → numbers', render: () => <FlowDiagram /> }
export const AdvisorLoop: Story = { name: 'Advisor loop', render: () => <LoopDiagram /> }
export const Grounded: Story = { name: 'Grounded, not guessing', render: () => <GroundedDiagram /> }
export const GrowTogether: Story = { name: 'You ⇄ Juno (grow together)', render: () => <GrowDiagram /> }
export const AgenticLoop: Story = { name: 'Agentic loop (MCP)', render: () => <AgentDiagram /> }
