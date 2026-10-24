import { seatKey, type SeatAssignment, type SeatPosition, type SeatingLayout } from '@school-management/shared';

// Lưới sơ đồ chỗ ngồi (DT-21 phần 21d, YCTD-171): bàn giáo viên ở trên, bàn 1 là bàn đầu; mỗi dãy một cột, mỗi bàn một ô có
// các chỗ. Chế độ sửa: kéo một học sinh (ở chỗ hoặc ở danh sách chưa xếp) thả vào chỗ khác, hoặc bấm chọn rồi bấm chỗ đích;
// chỗ đích đã có người thì hai người đổi chỗ
export interface SeatingGridProps {
  layout: SeatingLayout;
  assignments: Array<SeatAssignment & { full_name?: string }>;
  names: Record<string, string>;
  selected?: string;
  onSelect?(childId: string | undefined): void;
  onPlace?(childId: string, seat: SeatPosition): void;
}

export const DRAG_TYPE = 'application/x-seating-child';

export function SeatingGrid({ layout, assignments, names, selected, onSelect, onPlace }: SeatingGridProps) {
  const editable = Boolean(onPlace);
  const bySeat = new Map(assignments.map((assignment) => [seatKey(assignment), assignment.child_id]));
  const rows = Array.from({ length: layout.desk_rows }, (_value, index) => index + 1);
  const columns = Array.from({ length: layout.desk_columns }, (_value, index) => index + 1);
  const seats = Array.from({ length: layout.seats_per_desk }, (_value, index) => index + 1);
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Sơ đồ chỗ ngồi">
      <div className="rounded-lg border border-dashed border-border px-3 py-1 text-center text-label text-text-secondary">
        Bàn giáo viên, bảng
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${layout.desk_columns}, minmax(0, 1fr))` }}>
        {rows.flatMap((row) =>
          columns.map((column) => (
            <div
              key={`${column}:${row}`}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card p-2"
              aria-label={`Dãy ${column} bàn ${row}`}
            >
              <span className="text-label text-text-secondary">
                Dãy {column} · Bàn {row}
              </span>
              <div className="flex gap-1">
                {seats.map((seat) => {
                  const position = { column_no: column, row_no: row, seat_no: seat };
                  const childId = bySeat.get(seatKey(position));
                  const label = `Dãy ${column} bàn ${row} chỗ ${seat}`;
                  const name = childId ? (names[childId] ?? '') : '';
                  if (!editable) {
                    return (
                      <span
                        key={seat}
                        className="min-h-9 flex-1 rounded-md border border-border px-2 py-1 text-content"
                        aria-label={`${label}: ${name || 'trống'}`}
                      >
                        {name}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={seat}
                      type="button"
                      aria-label={`${label}: ${name || 'trống'}`}
                      aria-pressed={childId !== undefined && childId === selected}
                      draggable={Boolean(childId)}
                      onDragStart={(event) => childId && event.dataTransfer.setData(DRAG_TYPE, childId)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const dragged = event.dataTransfer.getData(DRAG_TYPE);
                        if (dragged) {
                          onPlace?.(dragged, position);
                        }
                      }}
                      onClick={() => {
                        if (selected && selected !== childId) {
                          onPlace?.(selected, position);
                          onSelect?.(undefined);
                        } else {
                          onSelect?.(childId && childId !== selected ? childId : undefined);
                        }
                      }}
                      className={`min-h-9 flex-1 rounded-md border px-2 py-1 text-left text-content ${
                        childId && childId === selected ? 'border-primary bg-primary/10' : 'border-border'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )),
        )}
      </div>
    </div>
  );
}

// Đặt học sinh vào chỗ: chỗ đích có người thì người đó sang chỗ cũ của học sinh được kéo (chưa có chỗ thì ra danh sách chưa
// xếp)
export function placeChild(assignments: SeatAssignment[], childId: string, seat: SeatPosition): SeatAssignment[] {
  const current = assignments.find((assignment) => assignment.child_id === childId);
  const occupant = assignments.find(
    (assignment) => seatKey(assignment) === seatKey(seat) && assignment.child_id !== childId,
  );
  const rest = assignments.filter(
    (assignment) => assignment.child_id !== childId && assignment.child_id !== occupant?.child_id,
  );
  const placed = [...rest, { child_id: childId, ...seat }];
  if (occupant && current) {
    placed.push({
      child_id: occupant.child_id,
      column_no: current.column_no,
      row_no: current.row_no,
      seat_no: current.seat_no,
    });
  }
  return placed;
}
