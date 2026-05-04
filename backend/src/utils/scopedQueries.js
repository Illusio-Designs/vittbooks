/**
 * Scoped query helpers — single-source-of-truth for tenant isolation.
 *
 * In single-shared-database mode, every read/write of a tenant-owned
 * record MUST include the caller's tenant_id (and where the model has
 * one, the caller's company_id) in the where clause. Forgetting that
 * once = an IDOR (any user can guess ids and read another tenant's
 * data). These helpers centralize the rule so call sites become hard
 * to get wrong.
 *
 * Usage:
 *   const { findByIdScoped, findOneScoped } = require('../utils/scopedQueries');
 *
 *   // Replace:
 *   const item = await Model.findByPk(req.params.id);
 *   // With:
 *   const item = await findByIdScoped(req, Model, req.params.id);
 *
 *   // Replace:
 *   const item = await Model.findOne({ where: { barcode } });
 *   // With:
 *   const item = await findOneScoped(req, Model, { barcode });
 */

/**
 * Build a where-fragment that pins the query to the caller's tenant
 * (and company, when the model has a company_id column).
 *
 * @param {object} req - the Express request
 * @param {object} Model - a Sequelize model
 * @param {object} extra - extra where conditions to merge
 */
function scopeWhere(req, Model, extra = {}) {
  const where = { ...extra };

  if (req && req.tenant_id) {
    where.tenant_id = req.tenant_id;
  }

  // company_id only applies if the model declares such a column.
  if (
    req &&
    req.company_id &&
    Model &&
    Model.rawAttributes &&
    Object.prototype.hasOwnProperty.call(Model.rawAttributes, 'company_id')
  ) {
    where.company_id = req.company_id;
  }

  return where;
}

/**
 * Look up a record by primary key, scoped to the caller's tenant.
 * Returns null if no record matches OR if it exists but belongs to a
 * different tenant — both look the same to the caller (no oracle).
 */
async function findByIdScoped(req, Model, id, options = {}) {
  if (id == null) return null;
  return Model.findOne({
    ...options,
    where: scopeWhere(req, Model, { id, ...(options.where || {}) }),
  });
}

/**
 * Like Model.findOne, but the where clause is scoped to the caller's
 * tenant (and company_id if the model has one). Caller passes only
 * the business filters they care about.
 */
async function findOneScoped(req, Model, where = {}, options = {}) {
  return Model.findOne({
    ...options,
    where: scopeWhere(req, Model, { ...where, ...(options.where || {}) }),
  });
}

/**
 * Like Model.findAll, scoped to tenant. Useful for list endpoints
 * that currently do `findAll({ where: {} })` and accidentally page
 * through every tenant's rows.
 */
async function findAllScoped(req, Model, where = {}, options = {}) {
  return Model.findAll({
    ...options,
    where: scopeWhere(req, Model, { ...where, ...(options.where || {}) }),
  });
}

module.exports = {
  scopeWhere,
  findByIdScoped,
  findOneScoped,
  findAllScoped,
};
