import { pool } from "@workspace/db";

type Queryable = {
  query: typeof pool.query;
};

type ActivityLogInput = {
  actorUserId?: number | null;
  actorRole?: string | null;
  actionType: string;
  entityType: string;
  entityId?: number | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function insertActivityLog(
  client: Queryable,
  {
    actorUserId = null,
    actorRole = null,
    actionType,
    entityType,
    entityId = null,
    summary,
    metadata = {},
  }: ActivityLogInput,
) {
  await client.query(
    `
      INSERT INTO activity_log (
        actor_user_id,
        actor_role,
        action_type,
        entity_type,
        entity_id,
        summary,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      actorUserId,
      actorRole,
      actionType,
      entityType,
      entityId,
      summary,
      JSON.stringify(metadata),
    ],
  );
}

export function activityActorFromSession(session: {
  userId?: number;
  role?: string;
}) {
  return {
    actorUserId: session.userId ?? null,
    actorRole: session.role ?? null,
  };
}
