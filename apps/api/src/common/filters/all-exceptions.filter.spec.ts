import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function mockHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('HttpException을 ApiError 포맷으로 변환한다', () => {
    const { host, status, json } = mockHost();
    filter.catch(new NotFoundException('없는 리소스입니다.'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'NOT_FOUND', message: '없는 리소스입니다.', details: undefined },
    });
  });

  it('검증 실패 메시지 배열은 details로 담는다', () => {
    const { host, json } = mockHost();
    filter.catch(new BadRequestException(['name must be a string']), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'BAD_REQUEST', details: ['name must be a string'] }),
      }),
    );
  });

  it('알 수 없는 예외는 500으로 응답한다', () => {
    const { host, status } = mockHost();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(500);
  });
});
