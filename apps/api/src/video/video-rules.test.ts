import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  participantMinutes,
  parseVideoIdentity,
  parseVideoRoomName,
  videoGrantsFor,
  videoIdentity,
  videoRoomName,
} from '@school-management/shared';
import { readVideoConfiguration } from '../common/configuration.js';

// Lớp video trực tiếp (DT-27 phần 27a, YCTD-251), kịch bản CT-27a-1, CT-27a-2: quyền theo vai trò, tên phòng có mã trường, mã người dự,
// đo phút người dự, cấu hình nhà cung cấp (biến không bắt buộc khi tắt video)
describe('Quy tắc lớp video', () => {
  it('CT-27a-1: gia sư chia sẻ và điều khiển; học sinh nói, chia sẻ khi được cho; cha mẹ, Ban Giám hiệu xem, nói khi được cho', () => {
    const host = videoGrantsFor('host');
    assert.equal(host.roomAdmin, true);
    assert.deepEqual(host.canPublishSources, ['camera', 'microphone', 'screen_share', 'screen_share_audio']);
    assert.deepEqual(videoGrantsFor('student').canPublishSources, ['camera', 'microphone']);
    assert.ok(videoGrantsFor('student', { share: true }).canPublishSources.includes('screen_share'));
    const guardian = videoGrantsFor('guardian');
    assert.equal(guardian.canPublish, false);
    assert.equal(guardian.canSubscribe, true);
    assert.deepEqual(guardian.canPublishSources, []);
    assert.deepEqual(videoGrantsFor('guardian', { speak: true }).canPublishSources, ['microphone']);
    assert.equal(videoGrantsFor('observer', { share: true }).canPublish, false, 'Ban Giám hiệu không chia sẻ');

    const room = videoRoomName('0b1c2d3e-aaaa-4bbb-8ccc-123456789abc', 'f0e1d2c3-1111-4222-8333-444455556666');
    assert.deepEqual(parseVideoRoomName(room), {
      school: '0b1c2d3e-aaaa-4bbb-8ccc-123456789abc',
      roomId: 'f0e1d2c3-1111-4222-8333-444455556666',
    });
    assert.equal(parseVideoRoomName('khong-co-tach'), null);
    assert.equal(parseVideoRoomName('a b--c'), null);
    assert.deepEqual(parseVideoIdentity(videoIdentity('student', 'abc')), { role: 'student', id: 'abc' });
    assert.equal(parseVideoIdentity('x:abc'), null);
  });

  it('CT-27a-2: phút người dự ghép vào với ra, còn trong phòng tính đến hiện tại; cấu hình nhà cung cấp', () => {
    const at = (minute: number) => new Date(Date.UTC(2026, 9, 27, 10, minute));
    assert.equal(
      participantMinutes(
        [
          { identity: 'h:1', kind: 'join', at: at(0) },
          { identity: 's:1', kind: 'join', at: at(5) },
          { identity: 's:1', kind: 'leave', at: at(20) },
          { identity: 's:1', kind: 'join', at: at(25) },
          { identity: 'h:1', kind: 'leave', at: at(45) },
        ],
        at(50),
      ),
      45 + 15 + 25,
    );
    assert.equal(participantMinutes([{ identity: 'g:1', kind: 'leave', at: at(5) }], at(10)), 0, 'ra không có vào');

    assert.equal(readVideoConfiguration({}), null, 'trống là tắt video, LIVEKIT_* không bắt buộc');
    assert.throws(
      () => readVideoConfiguration({ VIDEO_PROVIDER: 'livekit', LIVEKIT_URL: 'http://livekit:7880' }),
      /Thiếu biến môi trường LIVEKIT_API_KEY, LIVEKIT_API_SECRET/,
    );
    assert.throws(
      () => readVideoConfiguration({ VIDEO_PROVIDER: 'mock', NODE_ENV: 'production' }),
      /chỉ dùng cho kiểm thử/,
    );
    assert.throws(() => readVideoConfiguration({ VIDEO_PROVIDER: 'jitsi' }), /không hỗ trợ/);
    const cloud = readVideoConfiguration({
      VIDEO_PROVIDER: 'livekit-cloud',
      LIVEKIT_URL: 'https://du-an.livekit.cloud',
      LIVEKIT_API_KEY: 'khoa',
      LIVEKIT_API_SECRET: 'bi-mat',
    });
    assert.equal(cloud?.clientUrl, 'wss://du-an.livekit.cloud');
  });
});
