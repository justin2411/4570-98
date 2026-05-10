import { scoreColor, scoreEmoji } from '@/lib/utils'

export function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${scoreColor(score)}`}>
      {scoreEmoji(score)}{score.toFixed(1)}
    </span>
  )
}
