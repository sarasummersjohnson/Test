import type { CaptionResult } from './CaptionForm'

export default function CaptionResults({ results }: { results: CaptionResult[] }) {
  if (!results.length) return null

  return (
    <div className="results">
      {results.map((result, index) => (
        <div key={`${result.pillar}-${index}`} className="result-card">
          <h3>{result.pillar}</h3>
          <p>{result.caption}</p>
        </div>
      ))}
    </div>
  )
}
