import { compareNo, incrementNo, isWithinRange } from './numberSeries';
import { NoSeriesConflictError, type BcNoSeriesLine, type NoSeriesClient } from './noSeriesClient';

export class SeriesNotFoundError extends Error {
  constructor(seriesCode: string) { super(`No. Series '${seriesCode}' has no line in BC`); this.name = 'SeriesNotFoundError'; }
}
export class SeriesNotNormalError extends Error {
  constructor(seriesCode: string) { super(`No. Series '${seriesCode}' is not Normal (Allow Gaps must be off) — set it to Normal in BC to enable auto-numbering`); this.name = 'SeriesNotNormalError'; }
}
export class SeriesExhaustedError extends Error {
  constructor(seriesCode: string) { super(`No. Series '${seriesCode}' has no numbers left — update its range in BC`); this.name = 'SeriesExhaustedError'; }
}

export interface PreparedNumber {
  seriesCode: string;
  candidate: string;
  line: BcNoSeriesLine;
}

export interface NumberAssigner {
  prepare(seriesCode: string): Promise<PreparedNumber>;
  bump(prepared: PreparedNumber): PreparedNumber;
  commit(prepared: PreparedNumber, usedNumber: string, today?: string): Promise<void>;
}

const MAX_COMMIT_RETRIES = 5;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createBcNoSeriesAssigner(noSeries: NoSeriesClient): NumberAssigner {
  function candidateFor(line: BcNoSeriesLine): string {
    return incrementNo(line.lastNoUsed, line.incrementByNo, line.startingNo);
  }

  async function prepare(seriesCode: string): Promise<PreparedNumber> {
    const line = await noSeries.getOpenLine(seriesCode);
    if (!line) throw new SeriesNotFoundError(seriesCode);
    if (line.implementation !== 'Normal') throw new SeriesNotNormalError(seriesCode);
    const candidate = candidateFor(line);
    if (!isWithinRange(candidate, line.startingNo, line.endingNo)) throw new SeriesExhaustedError(seriesCode);
    return { seriesCode, candidate, line };
  }

  function bump(prepared: PreparedNumber): PreparedNumber {
    const candidate = incrementNo(prepared.candidate, prepared.line.incrementByNo, prepared.line.startingNo);
    if (!isWithinRange(candidate, prepared.line.startingNo, prepared.line.endingNo)) {
      throw new SeriesExhaustedError(prepared.seriesCode);
    }
    return { ...prepared, candidate };
  }

  async function commit(prepared: PreparedNumber, usedNumber: string, today = todayIso()): Promise<void> {
    let line = prepared.line;
    for (let attempt = 0; attempt < MAX_COMMIT_RETRIES; attempt += 1) {
      // advance-only: never lower Last_No_Used below what BC currently holds
      const target = compareNo(usedNumber, line.lastNoUsed) > 0 ? usedNumber : line.lastNoUsed;
      try {
        await noSeries.advanceLine(line, target, today);
        return;
      } catch (error) {
        if (!(error instanceof NoSeriesConflictError)) throw error;
        const fresh = await noSeries.getOpenLine(prepared.seriesCode);
        if (!fresh) throw new SeriesNotFoundError(prepared.seriesCode);
        line = fresh;
      }
    }
    throw new NoSeriesConflictError();
  }

  return { prepare, bump, commit };
}
