// BUDGET ROUTES PATCH
// In your budgetRoutes.js, find the query that calculates actual_spent.
// It currently joins against `indents` table directly. Replace that subquery/join
// to aggregate from `indent_lines` through `indents`.
//
// FIND this pattern (or similar):
//
//   SUM(CASE WHEN i.source='HO' AND NOT i.is_carried_forward THEN i.cost_usd ELSE 0 END) as ho_spent
//
// REPLACE with:
//
//   SUM(CASE WHEN i.source='HO' AND NOT i.is_carried_forward THEN il.cost_usd ELSE 0 END) as ho_spent
//
// And change the FROM/JOIN to go through indent_lines:
//
//   FROM indent_lines il JOIN indents i ON il.indent_id = i.id
//   WHERE i.vessel_id = $1
//   GROUP BY il.sub_category

// Here's the full replacement query for the budget GET endpoint.
// Replace the actual_spent subquery with this:

const BUDGET_QUERY = `
  SELECT
    b.id, b.vessel_id, b.cost_group, b.sub_category, b.annual_budget, b.year,
    COALESCE(spent.total_spent, 0) as actual_spent,
    COALESCE(spent.ho_spent, 0) as ho_spent,
    COALESCE(spent.outport_spent, 0) as outport_spent,
    COALESCE(spent.cf_spent, 0) as cf_spent
  FROM budgets b
  LEFT JOIN (
    SELECT
      il.sub_category,
      SUM(il.cost_usd) as total_spent,
      SUM(CASE WHEN i.source = 'HO' AND NOT COALESCE(i.is_carried_forward, false) THEN il.cost_usd ELSE 0 END) as ho_spent,
      SUM(CASE WHEN i.source = 'Outport' AND NOT COALESCE(i.is_carried_forward, false) THEN il.cost_usd ELSE 0 END) as outport_spent,
      SUM(CASE WHEN COALESCE(i.is_carried_forward, false) THEN il.cost_usd ELSE 0 END) as cf_spent
    FROM indent_lines il
    JOIN indents i ON il.indent_id = i.id
    WHERE i.vessel_id = $1
    GROUP BY il.sub_category
  ) spent ON b.sub_category = spent.sub_category
  WHERE b.vessel_id = $1 AND b.year = $2
  ORDER BY b.cost_group, b.sub_category
`;

module.exports = { BUDGET_QUERY };
