import { describe, it, expect, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { HealthStatus } from '@hiconsy/shared';
import HomeView from '../views/HomeView.vue';

vi.mock('@/api/client', () => ({
  fetchHealth: vi
    .fn<() => Promise<HealthStatus>>()
    .mockResolvedValue({ status: 'ok', database: 'up', timestamp: '' }),
}));

describe('HomeView', () => {
  it('API 상태를 렌더링한다', async () => {
    const wrapper = mount(HomeView);
    await flushPromises();
    expect(wrapper.text()).toContain('API: ok / DB: up');
  });
});
