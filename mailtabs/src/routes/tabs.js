'use strict';

/**
 * /api/tabs — the user's tabs: a name, a color, which accounts feed it (all or a chosen set) and
 * optional rules (from/to/subject/body contains …). "All inboxes" is virtual and not stored.
 */

const express = require('express');
const { HttpError } = require('../errors');
const { requireAuth } = require('../middleware');
const queries = require('../queries');

const { validate } = queries;

const MAX_TABS = 50;
const MAX_NAME = 40;
const MAX_CONDITIONS = 20;
const MAX_RULE_VALUE = 200;

/** Validate a rules payload -> normalised object, or null for "no filtering". */
function normalizeRules(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw validate.badRequest('Rules must be an object like {match, conditions}.', 'INVALID_RULES');
  }
  const match = value.match === undefined ? 'all' : value.match;
  if (match !== 'all' && match !== 'any') throw validate.badRequest('Rules "match" must be "all" or "any".', 'INVALID_RULES');
  const conditions = value.conditions === undefined || value.conditions === null ? [] : value.conditions;
  if (!Array.isArray(conditions)) throw validate.badRequest('Rules "conditions" must be a list.', 'INVALID_RULES');
  if (conditions.length > MAX_CONDITIONS) {
    throw validate.badRequest(`A tab can have at most ${MAX_CONDITIONS} conditions.`, 'INVALID_RULES');
  }
  const out = conditions.map((c, i) => {
    const n = i + 1;
    if (!c || typeof c !== 'object' || Array.isArray(c)) throw validate.badRequest(`Condition ${n} is not valid.`, 'INVALID_RULES');
    if (!queries.RULE_FIELDS.includes(c.field)) {
      throw validate.badRequest(`Condition ${n}: field must be one of ${queries.RULE_FIELDS.join(', ')}.`, 'INVALID_RULES');
    }
    if (!queries.RULE_OPS.includes(c.op)) {
      throw validate.badRequest(`Condition ${n}: op must be "contains" or "not_contains".`, 'INVALID_RULES');
    }
    if (typeof c.value !== 'string' || !c.value.trim()) {
      throw validate.badRequest(`Condition ${n}: enter the text to look for.`, 'INVALID_RULES');
    }
    const text = c.value.trim();
    if (text.length > MAX_RULE_VALUE) {
      throw validate.badRequest(`Condition ${n}: the text must be at most ${MAX_RULE_VALUE} characters.`, 'INVALID_RULES');
    }
    return { field: c.field, op: c.op, value: text };
  });
  return out.length ? { match, conditions: out } : null;
}

function requireName(value) {
  return validate.optionalText(value, { field: 'Tab name', max: MAX_NAME, allowEmpty: false });
}

module.exports = function tabsRoutes({ db }) {
  const router = express.Router();
  router.use(requireAuth);

  const ownedAccountIds = (userId, ids) => {
    if (!ids.length) return [];
    const rows = db
      .prepare(`SELECT id FROM accounts WHERE user_id = ? AND id IN (${ids.map(() => '?').join(', ')})`)
      .all(userId, ...ids);
    return rows.map((r) => r.id);
  };

  /** accountIds from a body, validated as the user's own accounts. */
  function readAccountIds(userId, value) {
    const ids = validate.requireIdList(value, { what: 'accountIds' });
    const owned = new Set(ownedAccountIds(userId, ids));
    if (ids.some((id) => !owned.has(id))) {
      throw validate.badRequest('One of the selected accounts does not exist.', 'INVALID_ACCOUNT');
    }
    return ids;
  }

  const insertTab = db.prepare(
    'INSERT INTO tabs (user_id, name, color, position, all_accounts, rules, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertTabAccount = db.prepare('INSERT OR IGNORE INTO tab_accounts (tab_id, account_id) VALUES (?, ?)');
  const clearTabAccounts = db.prepare('DELETE FROM tab_accounts WHERE tab_id = ?');
  const findTab = db.prepare('SELECT * FROM tabs WHERE id = ? AND user_id = ?');

  function loadTab(userId, rawId) {
    const id = validate.requireId(rawId, 'tab id');
    const row = findTab.get(id, userId);
    if (!row) throw new HttpError(404, 'Tab not found', 'NOT_FOUND');
    return row;
  }

  router.get('/', (req, res) => {
    res.json(queries.listTabsJson(db, req.user.id));
  });

  router.post('/', (req, res) => {
    const body = validate.requireBody(req);
    const userId = req.user.id;
    const name = requireName(body.name);
    const color = body.color === undefined || body.color === null ? queries.DEFAULT_COLOR : validate.requireColor(body.color);
    const allAccounts = body.allAccounts === undefined ? false : validate.requireBoolean(body.allAccounts, 'allAccounts');
    const accountIds = body.accountIds === undefined || body.accountIds === null ? [] : readAccountIds(userId, body.accountIds);
    const rules = normalizeRules(body.rules);

    const id = db.transaction(() => {
      const { n, maxPos } = db.prepare('SELECT COUNT(*) AS n, MAX(position) AS maxPos FROM tabs WHERE user_id = ?').get(userId);
      if (n >= MAX_TABS) throw validate.badRequest(`You can have at most ${MAX_TABS} tabs.`, 'TOO_MANY_TABS');
      const position = maxPos === null ? 0 : maxPos + 1;
      const info = insertTab.run(userId, name, color, position, allAccounts ? 1 : 0, rules ? JSON.stringify(rules) : null, Date.now());
      const tabId = Number(info.lastInsertRowid);
      for (const accountId of accountIds) insertTabAccount.run(tabId, accountId);
      return tabId;
    })();

    res.status(201).json({ tab: queries.getTabJson(db, userId, id) });
  });

  // Must come before '/:id' routes of the same method (it is PUT; PATCH/DELETE use :id).
  router.put('/order', (req, res) => {
    const body = validate.requireBody(req);
    const userId = req.user.id;
    if (!Array.isArray(body.ids)) throw validate.badRequest('ids must be a list of tab ids.', 'INVALID_ORDER');
    const ids = body.ids.map((v) => validate.requireId(v, 'tab id'));
    const current = db.prepare('SELECT id FROM tabs WHERE user_id = ?').all(userId).map((r) => r.id);
    const unique = new Set(ids);
    const currentSet = new Set(current);
    if (unique.size !== ids.length || ids.length !== current.length || ids.some((id) => !currentSet.has(id))) {
      throw validate.badRequest('The new order must list each of your tabs exactly once.', 'INVALID_ORDER');
    }
    const setPosition = db.prepare('UPDATE tabs SET position = ? WHERE id = ? AND user_id = ?');
    db.transaction(() => {
      ids.forEach((id, index) => setPosition.run(index, id, userId));
    })();
    res.json({ ok: true });
  });

  router.patch('/:id', (req, res) => {
    const userId = req.user.id;
    const tab = loadTab(userId, req.params.id);
    const body = validate.requireBody(req);

    const sets = [];
    const params = [];
    if (body.name !== undefined) {
      sets.push('name = ?');
      params.push(requireName(body.name));
    }
    if (body.color !== undefined) {
      sets.push('color = ?');
      params.push(validate.requireColor(body.color));
    }
    if (body.allAccounts !== undefined) {
      sets.push('all_accounts = ?');
      params.push(validate.requireBoolean(body.allAccounts, 'allAccounts') ? 1 : 0);
    }
    if (body.rules !== undefined) {
      const rules = normalizeRules(body.rules);
      sets.push('rules = ?');
      params.push(rules ? JSON.stringify(rules) : null);
    }
    const accountIds = body.accountIds === undefined ? undefined : body.accountIds === null ? [] : readAccountIds(userId, body.accountIds);

    db.transaction(() => {
      if (sets.length) db.prepare(`UPDATE tabs SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...params, tab.id, userId);
      if (accountIds !== undefined) {
        clearTabAccounts.run(tab.id);
        for (const accountId of accountIds) insertTabAccount.run(tab.id, accountId);
      }
    })();

    res.json({ tab: queries.getTabJson(db, userId, tab.id) });
  });

  router.delete('/:id', (req, res) => {
    const userId = req.user.id;
    const tab = loadTab(userId, req.params.id);
    // tab_accounts rows go with it (ON DELETE CASCADE); accounts and mail are untouched.
    db.prepare('DELETE FROM tabs WHERE id = ? AND user_id = ?').run(tab.id, userId);
    res.json({ ok: true });
  });

  return router;
};

module.exports.normalizeRules = normalizeRules;
module.exports.MAX_TABS = MAX_TABS;
