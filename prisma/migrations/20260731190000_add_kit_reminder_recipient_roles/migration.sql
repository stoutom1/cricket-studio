-- Add role-specific recipients for one shared league kit.
--
-- Existing PLAYER rows remain valid. New reminders use:
--   ASSIGNED_CARRIER
--   CURRENT_HOLDER
--
-- Because recipientType is part of the KitReminderLog unique key,
-- the assigned carrier and current holder can each receive one
-- reminder for the same assignment/timing without collisions.

ALTER TYPE "KitReminderRecipientType"
ADD VALUE IF NOT EXISTS 'ASSIGNED_CARRIER';

ALTER TYPE "KitReminderRecipientType"
ADD VALUE IF NOT EXISTS 'CURRENT_HOLDER';
