function deescapeFilterPart(filterPart) {
  return filterPart.replace(/{([^\s]+?)}/g, '$1');
}

function exceptEscapeFromFilterPart(str) {
  return new RegExp(`(?=[^{])${str}(?=[^}])`, 'g');
}

function parseFilters(filterLine) {
  return filterLine
    ? filterLine
        .split(exceptEscapeFromFilterPart(','))
        .map(part =>
          part.split(exceptEscapeFromFilterPart('=')).map(sect => deescapeFilterPart(sect.replace(/^\s*["']?|["']?\s*$/g, ''))),
        )
    : [];
}

function parseSearchFilter(pattern) {
  let [query, filters] = pattern.split(exceptEscapeFromFilterPart('@')).map(str => str.trim());
  if (!filters) [query, filters] = [filters, query];
  filters = parseFilters(filters);
  if (!query && (filters[0] || []).length === 1) [query] = filters.shift();
  return {query: query ? deescapeFilterPart(query) : '*', filters: Object.fromEntries(filters)};
}

module.exports = parseSearchFilter;
