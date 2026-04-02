import { Task, BoardColumn } from '@/types/board';
import { differenceInDays, differenceInBusinessDays, parseISO, isValid, format } from 'date-fns';

/**
 * Formula engine supporting:
 * - Math operators: +, -, *, /
 * - Functions: SUM, COUNT, MOD, ROUND, DAYS, WORKDAYS, TODAY, DATE, ABS, MIN, MAX, AVERAGE, IF
 * - Column references: {Column Name}
 */
export function evaluateFormula(formula: string, task: Task, columns: BoardColumn[]): any {
  if (!formula || typeof formula !== 'string') return null;

  try {
    let expression = formula;

    // ============ FUNCTION HANDLERS ============

    // TODAY() → current date as ISO string
    expression = expression.replace(/TODAY\s*\(\s*\)/gi, () => {
      return `"${format(new Date(), 'yyyy-MM-dd')}"`;
    });

    // DATE({Column}) → extracts a date string from a column
    const dateRegex = /DATE\s*\(\s*\{(.+?)\}\s*\)/gi;
    expression = expression.replace(dateRegex, (_, colRef) => {
      const col = columns.find(c => c.title === colRef);
      const val = col ? task.columnValues[col.id] : null;
      const d = getAsDate(val, 'start');
      return d ? `"${format(d, 'yyyy-MM-dd')}"` : '"N/A"';
    });

    // DAYS({End}, {Start}) → difference in calendar days
    const daysRegex = /DAYS\s*\(\s*\{(.+?)\}\s*,\s*\{(.+?)\}\s*\)/gi;
    expression = expression.replace(daysRegex, (_, colRef1, colRef2) => {
      const col1 = columns.find(c => c.title === colRef1);
      const col2 = columns.find(c => c.title === colRef2);
      const val1 = col1 ? task.columnValues[col1.id] : null;
      const val2 = col2 ? task.columnValues[col2.id] : null;
      const d1 = getAsDate(val1, 'end');
      const d2 = getAsDate(val2, 'start');
      if (d1 && d2) return String(Math.abs(differenceInDays(d1, d2)));
      return '0';
    });

    // WORKDAYS({End}, {Start}) → difference in business days (Mon-Fri)
    const workdaysRegex = /WORKDAYS\s*\(\s*\{(.+?)\}\s*,\s*\{(.+?)\}\s*\)/gi;
    expression = expression.replace(workdaysRegex, (_, colRef1, colRef2) => {
      const col1 = columns.find(c => c.title === colRef1);
      const col2 = columns.find(c => c.title === colRef2);
      const val1 = col1 ? task.columnValues[col1.id] : null;
      const val2 = col2 ? task.columnValues[col2.id] : null;
      const d1 = getAsDate(val1, 'end');
      const d2 = getAsDate(val2, 'start');
      if (d1 && d2) return String(Math.abs(differenceInBusinessDays(d1, d2)));
      return '0';
    });

    // SUM({Col1}, {Col2}, ...) → sum of all referenced columns
    const sumRegex = /SUM\s*\(([^)]+)\)/gi;
    expression = expression.replace(sumRegex, (_, args: string) => {
      const refs = args.match(/\{(.+?)\}/g) || [];
      let total = 0;
      refs.forEach(ref => {
        const colName = ref.replace(/[{}]/g, '');
        const col = columns.find(c => c.title === colName);
        if (col) {
          const val = task.columnValues[col.id];
          total += typeof val === 'number' ? val : parseFloat(String(val)) || 0;
        }
      });
      return String(total);
    });

    // COUNT({Col1}, {Col2}, ...) → count of non-empty values
    const countRegex = /COUNT\s*\(([^)]+)\)/gi;
    expression = expression.replace(countRegex, (_, args: string) => {
      const refs = args.match(/\{(.+?)\}/g) || [];
      let count = 0;
      refs.forEach(ref => {
        const colName = ref.replace(/[{}]/g, '');
        const col = columns.find(c => c.title === colName);
        if (col) {
          const val = task.columnValues[col.id];
          if (val !== null && val !== undefined && val !== '' && val !== 0) count++;
        }
      });
      return String(count);
    });

    // AVERAGE({Col1}, {Col2}, ...) → average of all referenced columns
    const avgRegex = /AVERAGE\s*\(([^)]+)\)/gi;
    expression = expression.replace(avgRegex, (_, args: string) => {
      const refs = args.match(/\{(.+?)\}/g) || [];
      let total = 0;
      let n = 0;
      refs.forEach(ref => {
        const colName = ref.replace(/[{}]/g, '');
        const col = columns.find(c => c.title === colName);
        if (col) {
          const val = task.columnValues[col.id];
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          if (!isNaN(num)) { total += num; n++; }
        }
      });
      return n > 0 ? String(total / n) : '0';
    });

    // MOD(a, b) → remainder of a / b
    const modRegex = /MOD\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi;
    expression = expression.replace(modRegex, (_, a, b) => {
      const numA = parseFloat(resolveValue(a.trim(), task, columns));
      const numB = parseFloat(resolveValue(b.trim(), task, columns));
      if (isNaN(numA) || isNaN(numB) || numB === 0) return '0';
      return String(numA % numB);
    });

    // ROUND({Col}, decimals) → round to N decimal places
    const roundRegex = /ROUND\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi;
    expression = expression.replace(roundRegex, (_, valExpr, decExpr) => {
      const num = parseFloat(resolveValue(valExpr.trim(), task, columns));
      const dec = parseInt(decExpr.trim()) || 0;
      if (isNaN(num)) return '0';
      return String(parseFloat(num.toFixed(dec)));
    });

    // ABS(value) → absolute value
    const absRegex = /ABS\s*\(\s*([^)]+)\s*\)/gi;
    expression = expression.replace(absRegex, (_, valExpr) => {
      const num = parseFloat(resolveValue(valExpr.trim(), task, columns));
      return isNaN(num) ? '0' : String(Math.abs(num));
    });

    // MIN(a, b) → minimum of two values
    const minRegex = /MIN\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi;
    expression = expression.replace(minRegex, (_, a, b) => {
      const numA = parseFloat(resolveValue(a.trim(), task, columns));
      const numB = parseFloat(resolveValue(b.trim(), task, columns));
      return String(Math.min(numA || 0, numB || 0));
    });

    // MAX(a, b) → maximum of two values
    const maxRegex = /MAX\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi;
    expression = expression.replace(maxRegex, (_, a, b) => {
      const numA = parseFloat(resolveValue(a.trim(), task, columns));
      const numB = parseFloat(resolveValue(b.trim(), task, columns));
      return String(Math.max(numA || 0, numB || 0));
    });

    // IF(condition, trueVal, falseVal) — simple numeric comparison
    const ifRegex = /IF\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi;
    expression = expression.replace(ifRegex, (_, cond, trueVal, falseVal) => {
      const condStr = resolveValue(cond.trim(), task, columns);
      // Try to evaluate condition with simple >, <, >=, <=, ==
      try {
        // eslint-disable-next-line no-eval
        const result = eval(condStr);
        return result ? resolveValue(trueVal.trim(), task, columns) : resolveValue(falseVal.trim(), task, columns);
      } catch {
        return resolveValue(falseVal.trim(), task, columns);
      }
    });

    // ============ COLUMN VALUE REPLACEMENT ============
    // Replace {Column Name} with actual numeric values
    columns.forEach(col => {
      const val = task.columnValues[col.id];
      const numericValue = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
      const placeholder = `{${col.title}}`;
      if (expression.includes(placeholder)) {
        expression = expression.split(placeholder).join(String(numericValue));
      }
    });

    // ============ EVALUATE ============
    // Safety check: only allow numbers, operators, parens, decimals, spaces
    if (/^[\d+\-*/().,%\s]*$/.test(expression)) {
      // eslint-disable-next-line no-eval
      const result = eval(expression);
      return isFinite(result) ? Math.round(result * 100) / 100 : result;
    }

    // If it's a quoted string result (from DATE/TODAY), return it
    if (expression.startsWith('"') && expression.endsWith('"')) {
      return expression.slice(1, -1);
    }

    return expression || 'Error';
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return 'Error';
  }
}

/** Resolve a single value — could be a {Column} ref or a raw number */
function resolveValue(val: string, task: Task, columns: BoardColumn[]): string {
  const colMatch = val.match(/^\{(.+)\}$/);
  if (colMatch) {
    const col = columns.find(c => c.title === colMatch[1]);
    if (col) {
      const v = task.columnValues[col.id];
      return String(typeof v === 'number' ? v : parseFloat(String(v)) || 0);
    }
  }
  return val;
}

function getAsDate(val: any, preferredKey: 'start' | 'end'): Date | null {
  if (!val) return null;
  if (typeof val === 'object' && val[preferredKey]) {
    const d = parseISO(val[preferredKey]);
    return isValid(d) ? d : null;
  }
  if (typeof val === 'string') {
    const d = parseISO(val);
    return isValid(d) ? d : null;
  }
  return null;
}
