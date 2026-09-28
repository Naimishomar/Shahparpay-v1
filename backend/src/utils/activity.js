import ActivityLog from '../models/activityLog.model.js';

const clientIp = (req) =>
  String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || req?.ip || undefined;

/**
 * Records an activity. Fire-and-forget: a logging failure must never fail
 * the request that triggered it, so errors are swallowed after a console line.
 *
 * actor/target: { _id|id, role, name } — a user document plus its role works.
 */
export const logActivity = ({ req, actor, action, target, summary, meta }) => {
  const who = actor || req?.user;
  ActivityLog.create({
    action,
    actorId: who?._id || who?.id,
    actorRole: who?.role || (who ? undefined : 'system'),
    actorName: who?.name,
    targetId: target?._id || target?.id,
    targetRole: target?.role,
    targetName: target?.name,
    summary,
    meta,
    ip: clientIp(req),
  }).catch((error) => console.error('[activity] could not record', action, error?.message));
};
