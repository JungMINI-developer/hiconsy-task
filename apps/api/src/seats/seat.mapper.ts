import type { SeatRef } from '@hiconsy/shared';
import type { Seat as SeatRow } from '../generated/prisma/client.js';

export function toSeatRef(row: SeatRow | null): SeatRef | null {
  return row ? { id: row.id, number: row.number } : null;
}
