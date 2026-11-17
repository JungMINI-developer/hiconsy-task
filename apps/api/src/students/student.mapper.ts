import type { Student, StudentContact } from '@hiconsy/shared';
import { toKstIso, toKstIsoOrNull } from '../common/utils/date.js';
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

/** 강사 화면 기록의 학생 — 탈퇴(삭제)한 학생이면 deletedAt이 있다 (#61) */
export function toStudentContact(
  student: Pick<StudentRow, 'id' | 'name' | 'phone' | 'deletedAt'>,
): StudentContact {
  return {
    id: student.id,
    name: student.name,
    phone: student.phone,
    deletedAt: toKstIsoOrNull(student.deletedAt),
  };
}
