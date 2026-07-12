import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'Nonprofit Caption Generator',
  description: 'Generate on-brand social captions for nonprofit clients.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
