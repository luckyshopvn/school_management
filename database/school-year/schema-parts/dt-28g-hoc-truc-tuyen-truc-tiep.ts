import type { Generated } from 'kysely';
import type { CreatedTimestamp } from '../schema.js';

// Giờ học trực tuyến, phòng video nhóm, phòng chia nhỏ (DT-28 phần 28g, YCTD-277)
export type LearningLiveRoomKind = 'live_session' | 'group' | 'breakout';
export type LearningLiveRole = 'host' | 'student' | 'observer';

export interface LearningLiveRoomsTable {
  id: Generated<string>;
  kind: LearningLiveRoomKind;
  space_id: string | null;
  activity_id: string | null;
  group_id: string | null;
  parent_room_id: string | null;
  title: string;
  opened_by: string;
  opened_by_name: string;
  opened_by_kind: 'teacher' | 'student';
  status: Generated<'open' | 'ended'>;
  provider: string;
  max_participants: number;
  ends_at: Date | null;
  created_at: CreatedTimestamp;
  ended_at: Date | null;
}

export interface LearningLiveParticipantsTable {
  room_id: string;
  identity: string;
  role: LearningLiveRole;
  display_name: string;
  user_id: string;
  child_id: string | null;
  joined_at: Date;
  left_at: Date | null;
}

export interface LearningLiveEventsTable {
  id: Generated<string>;
  room_id: string;
  identity: string;
  role: LearningLiveRole;
  kind: 'join' | 'leave';
  at: Date;
  source: string;
}

export interface LearningGroupRoomSettingsTable {
  group_set_id: string;
  student_open: Generated<boolean>;
  updated_by_name: string;
  updated_at: Generated<Date>;
}

export interface LearningBreakoutMembersTable {
  parent_room_id: string;
  child_id: string;
  room_id: string;
  moved_by_name: string | null;
  updated_at: Generated<Date>;
}

export interface LearningLiveNoticesTable {
  id: Generated<string>;
  room_id: string;
  body: string;
  sent_by_name: string;
  created_at: CreatedTimestamp;
}

export interface LearningLiveHelpRequestsTable {
  id: Generated<string>;
  room_id: string;
  child_id: string;
  child_name: string;
  created_at: CreatedTimestamp;
  resolved_at: Date | null;
}

declare module '../schema.js' {
  interface SchoolYearDatabase {
    learning_live_rooms: LearningLiveRoomsTable;
    learning_live_participants: LearningLiveParticipantsTable;
    learning_live_events: LearningLiveEventsTable;
    learning_group_room_settings: LearningGroupRoomSettingsTable;
    learning_breakout_members: LearningBreakoutMembersTable;
    learning_live_notices: LearningLiveNoticesTable;
    learning_live_help_requests: LearningLiveHelpRequestsTable;
  }
}
