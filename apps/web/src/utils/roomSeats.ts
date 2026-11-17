import type { StudyRoom } from '@hiconsy/shared';

/**
 * 자습실 좌석 요약 — `좌석 10석 · 지금 6석 이용 중`. 운영 시간이 아니면 좌석 수만 (#49, #51).
 * 예약 건수는 좌석을 시간별로 나눠 쓰므로 좌석 수보다 많을 수 있어(10석에 14건) 보여주지 않는다.
 */
export function seatUsageText(room: Pick<StudyRoom, 'maxPersonnel' | 'occupiedSeats'>): string {
  const total = `좌석 ${room.maxPersonnel}석`;
  return room.occupiedSeats === null ? total : `${total} · 지금 ${room.occupiedSeats}석 이용 중`;
}
