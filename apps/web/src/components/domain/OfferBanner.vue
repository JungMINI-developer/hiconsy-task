<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { WaitlistEntry } from '@hiconsy/shared';
import { Sparkles } from 'lucide-vue-next';
import { waitlistApi } from '@/api/waitlist';
import { useStudentGuard } from '@/composables/useStudentGuard';
import { useToast } from '@/composables/useToast';
import { useMyWaitlistStore } from '@/stores/myWaitlist';
import { useSessionStore } from '@/stores/session';
import { formatCountdown, formatDate, formatTimeRange } from '@/utils/datetime';
import { errorMessage } from '@/utils/errorMessage';
import { encodeSlot } from '@/utils/visitSlots';
import AppButton from '@/components/ui/AppButton.vue';

/**
 * S-24 자리 제안 배너 (#36). 알림이 없으므로 학생 화면 맨 위에 항상 보여준다.
 * [확정하기]는 원하는 시간이 채워진 신청 다이얼로그(S-22)로 이어지고, 신청하면 제안이 확정된다.
 */
const emit = defineEmits<{ changed: [] }>();

const router = useRouter();
const session = useSessionStore();
const myWaitlist = useMyWaitlistStore();
const toast = useToast();
const handleStudentGone = useStudentGuard();

// 1초마다 남은 시간을 갱신하고, 마감이 지나면 다시 받아 다음 순번으로 넘어간 것을 반영한다
const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | undefined;
let reloading = false;

async function reload() {
  if (reloading) return;
  reloading = true;
  try {
    await myWaitlist.load();
    emit('changed');
  } finally {
    reloading = false;
  }
}

watch(
  () => myWaitlist.offers.length > 0,
  (hasOffers) => {
    clearInterval(timer);
    timer = undefined;
    if (!hasOffers) return;
    timer = setInterval(() => {
      now.value = new Date();
      const expired = myWaitlist.offers.some(
        (o) => o.offerExpiresAt && new Date(o.offerExpiresAt).getTime() <= now.value.getTime(),
      );
      if (expired) void reload();
    }, 1000);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearInterval(timer));

const busyId = ref<number | null>(null);

function confirmOffer(offer: WaitlistEntry) {
  void router.push({
    name: 'student-rooms',
    query: {
      apply: String(offer.studyRoom.id),
      slot: encodeSlot(new Date(offer.startAt), new Date(offer.endAt)),
    },
  });
}

async function decline(offer: WaitlistEntry) {
  const studentId = session.studentId;
  if (studentId === null) return;
  busyId.value = offer.id;
  try {
    await waitlistApi.cancel(studentId, offer.id);
    toast.success(`${offer.studyRoom.name} 자리 제안을 거절했어요`);
  } catch (e) {
    if (handleStudentGone(e)) return;
    toast.error(errorMessage(e));
  } finally {
    busyId.value = null;
    await reload();
  }
}
</script>

<template>
  <section
    v-if="myWaitlist.offers.length"
    aria-label="자리 제안"
    aria-live="polite"
    class="mb-6 flex flex-col gap-2"
  >
    <div
      v-for="offer in myWaitlist.offers"
      :key="offer.id"
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl bg-accent-weak px-4 py-3 sm:px-5"
      data-testid="offer"
    >
      <div class="flex min-w-0 gap-3">
        <Sparkles class="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
        <div class="min-w-0">
          <p class="text-body font-semibold">{{ offer.studyRoom.name }} 자리가 났어요</p>
          <!-- 남은 시간이 방문 시각(10:00)처럼 읽히지 않도록 "확정까지"를 앞에 둔다 -->
          <p class="text-label text-fg-muted tabular-nums">
            {{ formatDate(offer.startAt) }} {{ formatTimeRange(offer.startAt, offer.endAt) }} ·
            확정까지
            <span class="font-semibold text-accent">
              {{ offer.offerExpiresAt ? formatCountdown(offer.offerExpiresAt, now) : '' }}
            </span>
          </p>
        </div>
      </div>
      <div class="ml-auto flex shrink-0 gap-2">
        <AppButton
          variant="light"
          size="sm"
          :loading="busyId === offer.id"
          :aria-label="`${offer.studyRoom.name} 자리 제안 거절`"
          @click="decline(offer)"
        >
          거절
        </AppButton>
        <AppButton
          size="sm"
          :aria-label="`${offer.studyRoom.name} 자리 확정하기`"
          @click="confirmOffer(offer)"
        >
          확정하기
        </AppButton>
      </div>
    </div>
  </section>
</template>
