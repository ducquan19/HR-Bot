import { Candidate } from '@/types'
import { CANDIDATE_STAGE_COLORS, CANDIDATE_STAGES } from '@/constants'
import { Badge } from '@/components/ui/badge'
import { formatDate, getInitials } from '@/lib/utils'
import { Eye, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CandidatesTableProps {
  candidates: Candidate[]
  onViewCandidate?: (id: string) => void
  onDownloadCV?: (candidate: Candidate) => void
}

export function CandidatesTable({
  candidates,
  onViewCandidate,
  onDownloadCV,
}: CandidatesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-semibold">Candidate</th>
            <th className="px-4 py-3 text-left font-semibold">Email</th>
            <th className="px-4 py-3 text-left font-semibold">Stage</th>
            <th className="px-4 py-3 text-left font-semibold">Score</th>
            <th className="px-4 py-3 text-left font-semibold">Applied</th>
            <th className="px-4 py-3 text-center font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr key={candidate.id} className="border-b border-border hover:bg-muted/50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold">
                    {getInitials(candidate.firstName, candidate.lastName)}
                  </div>
                  <div>
                    <p className="font-medium">{candidate.firstName} {candidate.lastName}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <a href={`mailto:${candidate.email}`} className="text-primary hover:underline text-sm">
                  {candidate.email}
                </a>
              </td>
              <td className="px-4 py-3">
                <Badge className={CANDIDATE_STAGE_COLORS[candidate.stage]}>
                  {CANDIDATE_STAGES[candidate.stage]}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(candidate.score || 0) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold">{Math.round((candidate.score || 0) * 100)}%</span>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {formatDate(candidate.appliedAt)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewCandidate?.(candidate.id)}
                    title="View candidate"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDownloadCV?.(candidate)}
                    title="Download CV"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
