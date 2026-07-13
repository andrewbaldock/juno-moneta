/** A&A Yoda — the wise green money master. Same drawing as public/favicon.svg. */
export default function YodaLogo({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      {/* ears — long, pointed, nearly horizontal */}
      <path d="M17 23 Q8 22 1.5 16.5 Q5 13 10.5 13.5 Q16 14.5 21 19 Z" fill="#a4b878" stroke="#6b7d4f" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M47 23 Q56 22 62.5 16.5 Q59 13 53.5 13.5 Q48 14.5 43 19 Z" fill="#a4b878" stroke="#6b7d4f" strokeWidth="1.4" strokeLinejoin="round" />
      {/* head */}
      <ellipse cx="32" cy="26" rx="15" ry="12.5" fill="#a4b878" stroke="#6b7d4f" strokeWidth="1.4" />
      {/* forehead wrinkles */}
      <path d="M25 17.5 Q32 15.5 39 17.5 M26 20.5 Q32 19 38 20.5" fill="none" stroke="#8a9c66" strokeWidth="1.1" strokeLinecap="round" />
      {/* wispy white hair */}
      <path d="M22 15 Q20 11 16.5 10.5 M28 13.5 Q27 9 24.5 7.5 M40 14.5 Q42 10.5 45.5 10" fill="none" stroke="#f3f2ea" strokeWidth="1.3" strokeLinecap="round" />
      {/* eyes — big, heavy-lidded, kind */}
      <ellipse cx="25" cy="27.5" rx="3.5" ry="3.2" fill="#3a2f1d" />
      <ellipse cx="39" cy="27.5" rx="3.5" ry="3.2" fill="#3a2f1d" />
      <circle cx="26.2" cy="26.4" r="1.1" fill="#fff" />
      <circle cx="40.2" cy="26.4" r="1.1" fill="#fff" />
      <path d="M21.3 25.6 Q25 23.2 28.7 25.4 M35.3 25.4 Q39 23.2 42.7 25.6" fill="none" stroke="#6b7d4f" strokeWidth="1.5" strokeLinecap="round" />
      {/* under-eye creases */}
      <path d="M22.5 31.5 Q25 32.5 27.5 31.6 M36.5 31.6 Q39 32.5 41.5 31.5" fill="none" stroke="#8a9c66" strokeWidth="1" strokeLinecap="round" />
      {/* content little smile */}
      <path d="M27.5 34.5 Q32 37 36.5 34.5" fill="none" stroke="#6b7d4f" strokeWidth="1.5" strokeLinecap="round" />
      {/* robe with lighter inner collar */}
      <path d="M17 58 Q17 41 32 41 Q47 41 47 58 Z" fill="#8a6f4d" stroke="#6b5335" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M24.5 44 L32 52.5 L39.5 44 Q36 41.6 32 41.6 Q28 41.6 24.5 44 Z" fill="#cdbb96" stroke="#a8916a" strokeWidth="1" strokeLinejoin="round" />
      {/* the coin, held proudly */}
      <circle cx="32" cy="51.5" r="7" fill="#f4b942" stroke="#b07d1e" strokeWidth="1.4" />
      <text x="32" y="55.2" textAnchor="middle" fontFamily="Georgia, serif" fontSize="10.5" fontWeight="bold" fill="#7a5410">$</text>
      <circle cx="25" cy="50.5" r="2.5" fill="#a4b878" stroke="#6b7d4f" strokeWidth="1.1" />
      <circle cx="39" cy="50.5" r="2.5" fill="#a4b878" stroke="#6b7d4f" strokeWidth="1.1" />
    </svg>
  )
}
