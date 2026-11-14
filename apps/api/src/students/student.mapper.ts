import type { Student } from '@hiconsy/shared';
import { toKstIso } from '../common/utils/date.js';
import type { Student as StudentRow } from '../generated/prisma/client.js';

export function toStudent(row: StudentRow): Student {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    createdAt: toKstIso(row.createdAt),
    updatedAt: toKstIso(row.updatedAt),
  };
}
