import type { ReactNode } from 'react'
import { COIN_SM_SRC, Yod } from './motifs'

/**
 * Her bubble — the emotional primitive (02-components.md).
 * Coin avatar + gold-soft bubble, tail top-left, her line in Newsreader.
 * One bubble per view; she doesn't chatter.
 */
export default function JunoSays({ children, yod }: { children: ReactNode; yod?: string }) {
  return (
    <div className="msg j">
      <div className="av"><img src={COIN_SM_SRC} alt="" aria-hidden="true" /></div>
      <div className="bd">
        <div className="voice">{children}</div>
        {yod && <div className="yodline"><Yod />{yod}</div>}
      </div>
    </div>
  )
}
