import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EQUIPMENT_AGE_GROUPS } from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { listEquipmentItems } from '../facilities/facilities-api.js';
import { messageOf, postJson, type Asset } from './inventory-api.js';

// Gắn tài sản với thiết bị dạy học trong danh mục (DT-16 phần 16i; máy chủ có từ YCTD-102): tài sản gắn còn dùng được cộng
// vào số hiện có của 2.1 Tổng hợp thiết bị dạy học. Cần quyền quản lý thiết bị dạy học
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';

export function useEquipmentNames(enabled: boolean) {
  const items = useQuery({
    queryKey: ['equipment-items', 'asset-link'],
    queryFn: () => listEquipmentItems({}),
    enabled,
  });
  return new Map((items.data ?? []).map((item) => [item.id, `${item.code} ${item.name}`]));
}

export function AssetEquipmentLink({ assets, onDone }: { assets: Asset[]; onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const [assetId, setAssetId] = useState('');
  const [itemId, setItemId] = useState('');
  const items = useQuery({ queryKey: ['equipment-items', 'asset-link'], queryFn: () => listEquipmentItems({}) });
  const link = useMutation({
    mutationFn: (equipmentItemId: string | null) =>
      postJson('/api/v1/equipment-assets', { asset_id: assetId, equipment_item_id: equipmentItemId }),
    onSuccess: async (_result, equipmentItemId) => {
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      await queryClient.invalidateQueries({ queryKey: ['equipment-report'] });
      onDone(equipmentItemId ? 'Đã gắn tài sản với thiết bị dạy học' : 'Đã bỏ gắn thiết bị dạy học');
    },
  });
  const ageLabel = (value: string) => EQUIPMENT_AGE_GROUPS.find((group) => group.value === value)?.label ?? value;
  const selected = assets.find((asset) => asset.id === assetId);
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-3" aria-label="Gắn thiết bị dạy học">
      {items.error ? <Alert tone="danger">{messageOf(items.error)}</Alert> : null}
      {link.error ? <Alert tone="danger">{messageOf(link.error)}</Alert> : null}
      <label className="text-label font-medium text-text">
        Tài sản cần gắn
        <select value={assetId} onChange={(event) => setAssetId(event.target.value)} className={selectClass}>
          <option value="">Chọn tài sản</option>
          {assets
            .filter((asset) => asset.status !== 'disposed')
            .map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.code} {asset.name}
              </option>
            ))}
        </select>
      </label>
      <label className="text-label font-medium text-text">
        Thiết bị dạy học
        <select value={itemId} onChange={(event) => setItemId(event.target.value)} className={selectClass}>
          <option value="">Chọn thiết bị</option>
          {(items.data ?? [])
            .filter((item) => item.status === 'active')
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} {item.name} ({ageLabel(item.age_group)})
              </option>
            ))}
        </select>
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <Button disabled={!assetId || !itemId || link.isPending} onClick={() => link.mutate(itemId)}>
          Gắn thiết bị dạy học
        </Button>
        <Button
          variant="text"
          disabled={!selected?.equipment_item_id || link.isPending}
          onClick={() => link.mutate(null)}
        >
          Bỏ gắn
        </Button>
      </div>
    </div>
  );
}
