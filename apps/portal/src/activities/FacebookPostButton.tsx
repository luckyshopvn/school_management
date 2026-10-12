import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { messageOf, postJson } from './activities-api.js';

// Nút "Đăng lên Fanpage" cho hoạt động hoặc tin tức đã công bố (P14-08; BR-64, BR-65; YCTD-90): hiện trạng thái bài đã đăng,
// lỗi và nút thử lại khi đăng lỗi
export interface FacebookPost {
  id: string;
  source_type: 'activity' | 'news';
  source_id: string;
  status: 'posted' | 'failed';
  external_post_id: string | null;
  last_error: string | null;
  attempt_count: number;
  photo_file_ids: string[];
  excluded_photo_count: number;
}

export function useFacebookPosts(sourceType: 'activity' | 'news') {
  const allowed = useHasPermission(PERMISSION_CODES.facebookManage);
  const posts = useQuery({
    queryKey: ['facebook-posts', sourceType],
    queryFn: () => requestJson<FacebookPost[]>(`/api/v1/facebook-posts?source_type=${sourceType}`),
    enabled: allowed,
  });
  return { allowed, bySource: new Map((posts.data ?? []).map((post) => [post.source_id, post])) };
}

export function FacebookPostButton({
  sourceType,
  sourceId,
  post,
}: {
  sourceType: 'activity' | 'news';
  sourceId: string;
  post: FacebookPost | undefined;
}) {
  const queryClient = useQueryClient();
  const publish = useMutation({
    mutationFn: () =>
      post
        ? postJson<FacebookPost>(`/api/v1/facebook-posts/${post.id}/retry`)
        : postJson<FacebookPost>(
            `/api/v1/${sourceType === 'activity' ? 'activities' : 'news'}/${sourceId}/facebook-post`,
          ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['facebook-posts', sourceType] }),
  });
  return (
    <div className="flex flex-col gap-1" aria-label="Fanpage">
      {post?.status === 'posted' ? (
        <p className="text-label text-text-secondary">
          Đã đăng lên Fanpage (mã bài {post.external_post_id}, {post.photo_file_ids.length} hình
          {post.excluded_photo_count > 0 ? `, bỏ ${post.excluded_photo_count} hình có trẻ chưa đồng ý` : ''})
        </p>
      ) : (
        <div>
          <Button disabled={publish.isPending} onClick={() => publish.mutate()}>
            {post?.status === 'failed' ? 'Thử đăng lại lên Fanpage' : 'Đăng lên Fanpage'}
          </Button>
        </div>
      )}
      {post?.status === 'failed' ? <Alert tone="warning">Đăng Fanpage lỗi: {post.last_error}</Alert> : null}
      {publish.error ? <Alert tone="danger">{messageOf(publish.error)}</Alert> : null}
    </div>
  );
}
