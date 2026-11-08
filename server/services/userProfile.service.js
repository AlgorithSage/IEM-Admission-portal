const { query } = require('../config/postgres');

/**
 * Copies the contact details an applicant gave in the application form (full address, mobile,
 * name) into their account row in PostgreSQL, and records the previous values in user_history.
 * Registration only asks for name/email/phone, so without this the account address stays empty.
 *
 * Best effort: the application is already saved in MongoDB; a PostgreSQL outage must not fail
 * the submission. Returns true when the account row was updated.
 */
const syncProfileFromApplication = async (email, data) => {
  const fullAddress = [data.address, data.city, data.state && data.pincode ? `${data.state} - ${data.pincode}` : data.state || data.pincode]
    .filter(Boolean)
    .join(', ');
  const [firstName, ...rest] = String(data.fullName || '').trim().split(/\s+/);
  try {
    const res = await query(
      `WITH old AS (SELECT id, phone, address, row_version FROM users WHERE email = $1)
       UPDATE users u
          SET address = $2, phone = $3, first_name = $4, last_name = $5,
              row_version = u.row_version + 1, updated_at = CURRENT_TIMESTAMP
         FROM old
        WHERE u.id = old.id
       RETURNING u.id, old.phone AS old_phone, old.address AS old_address, old.row_version AS old_version`,
      [String(email).toLowerCase(), fullAddress, data.phone, firstName || '', rest.join(' ') || '.']
    );
    const row = res.rows[0];
    if (!row) return false; // account lives only in the MongoDB fallback
    await query(
      `INSERT INTO user_history (user_id, phone, address, row_version, change_reason) VALUES ($1, $2, $3, $4, $5)`,
      [row.id, row.old_phone, row.old_address, row.old_version, 'Updated from application form']
    );
    return true;
  } catch (err) {
    console.error('[Profile] Could not copy application address to PostgreSQL:', err.message);
    return false;
  }
};

module.exports = { syncProfileFromApplication };
