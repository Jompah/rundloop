import { TurnInstruction } from '@/types'

interface StreetDuplicateAnalysis {
  streetNames: string[]
  uniqueStreets: number
  totalSegments: number
  nonConsecutiveDuplicates: string[]
  duplicationRate: number  // 0-1, ratio of non-consecutive duplicates to total
}

/**
 * Analyze a route's turn instructions for street name duplication.
 * Consecutive segments on the same street are normal (not counted as duplicates).
 * Non-consecutive appearances of the same street name = running it twice.
 */
export function analyzeStreetDuplication(instructions: TurnInstruction[]): StreetDuplicateAnalysis {
  // Extract street names from instructions
  // Each instruction has format like "Turn left onto Main Street" or "Continue on Park Avenue"
  // The instruction text contains the street name

  const streetNames: string[] = []
  for (const inst of instructions) {
    // Extract street name from instruction text using regex
    const match = inst.text.match(/(?:onto|on|along)\s+(.+?)(?:\s*$)/i)
    if (match) {
      streetNames.push(match[1].trim().toLowerCase())
    }
  }

  // Collapse consecutive same-street segments
  const collapsed: string[] = []
  for (const name of streetNames) {
    if (collapsed.length === 0 || collapsed[collapsed.length - 1] !== name) {
      collapsed.push(name)
    }
  }

  // Find non-consecutive duplicates
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const name of collapsed) {
    if (seen.has(name)) {
      duplicates.push(name)
    } else {
      seen.add(name)
    }
  }

  return {
    streetNames: collapsed,
    uniqueStreets: seen.size,
    totalSegments: collapsed.length,
    nonConsecutiveDuplicates: duplicates,
    duplicationRate: collapsed.length > 0 ? duplicates.length / collapsed.length : 0,
  }
}

const DEDUP_THRESHOLD = 0.10  // Max 10% non-consecutive street repeats

export function shouldRejectRoute(analysis: StreetDuplicateAnalysis): boolean {
  return analysis.duplicationRate > DEDUP_THRESHOLD
}
