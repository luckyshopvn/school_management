import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mediaKind, schoolMediaFor, type ResourceSummary } from './school-media-logic.ts';

// Bài hát, câu chuyện của trường (DT-29 phần 29e, YCTD-329)
describe('Bài hát, câu chuyện của trường', () => {
  const resource = (overrides: Partial<ResourceSummary>): ResourceSummary => ({
    id: overrides.title ?? 'x',
    title: 'x',
    type_code: 'song',
    school_level: 'MN',
    published_version: 1,
    status: 'published',
    ...overrides,
  });

  it('CT-29e-2: chỉ học liệu loại bài hát, câu chuyện đã công bố, của cấp của lớp hoặc không ghi cấp; bài hát trước', () => {
    const rows = [
      resource({ title: 'Truyện Thỏ con', type_code: 'story' }),
      resource({ title: 'Bài hát Bé vui', type_code: 'song' }),
      resource({ title: 'Bài hát Anh em', type_code: 'song', school_level: null }),
      resource({ title: 'Phiếu học tập', type_code: 'worksheet' }),
      resource({ title: 'Bài hát nháp', published_version: null }),
      resource({ title: 'Bài hát ẩn', status: 'hidden' }),
      resource({ title: 'Bài hát Tiểu học', school_level: 'TH' }),
    ];
    assert.deepEqual(
      schoolMediaFor(rows, 'MN').map((row) => row.title),
      ['Bài hát Anh em', 'Bài hát Bé vui', 'Truyện Thỏ con'],
    );
    assert.deepEqual(
      schoolMediaFor(rows, 'TH').map((row) => row.title),
      ['Bài hát Anh em', 'Bài hát Tiểu học'],
    );
    assert.equal(mediaKind('audio/mpeg'), 'audio');
    assert.equal(mediaKind('video/mp4; charset=binary'), 'video');
    assert.equal(mediaKind('image/png'), 'image');
    assert.equal(mediaKind('application/pdf'), 'pdf');
    assert.equal(mediaKind(null), 'other');
  });
});
