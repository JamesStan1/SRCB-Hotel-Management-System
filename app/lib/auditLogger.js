import pool from './db'; // Adjust path to your db pool

export async function logAudit(userId, action, entity, entityId, details = {}, req) {
  let client;
  try {
    client = await pool.connect();
    const ipAddress = req?.headers?.get('x-forwarded-for') || req?.headers?.get('remote-addr') || null;
    // Ensure entity_id is an integer or NULL. Some callers may pass route strings like '/'.
    let parsedEntityId = null;
    if (typeof entityId === 'number' && Number.isInteger(entityId)) {
      parsedEntityId = entityId;
    } else if (typeof entityId === 'string') {
      const trimmed = entityId.trim();
      if (/^\d+$/.test(trimmed)) {
        parsedEntityId = parseInt(trimmed, 10);
      } else {
        // preserve original non-numeric id in details for debugging
        details = { ...details, _original_entity_id: entityId };
      }
    }

    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entity, parsedEntityId, JSON.stringify(details), ipAddress]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
    // Don't throw - logging shouldn't break the main flow
  } finally {
    if (client) client.release();
  }
}
