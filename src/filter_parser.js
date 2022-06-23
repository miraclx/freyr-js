function deescapeFilterPart(filterPart) {
  return filterPart.replace(/{([^\s]+?)}/g, '$1');
}

function exceptEscapeFromFilterPart(str, noGlob) {
  return new RegExp(`(?=[^{])${str}(?=[^}])`, !noGlob ? 'g' : '');
}

function dissociate(str, sep) {
  let match;
  return (match = str.match(exceptEscapeFromFilterPart(sep, true)))
    ? [str.slice(0, match.index), str.slice(match.index + 1)]
    : [str];
}

function parseFilters(filterLine) {
  return filterLine
    ? filterLine
        .split(exceptEscapeFromFilterPart(','))
        .map(part => dissociate(part, '=').map(sect => deescapeFilterPart(sect.replace(/^\s*["']?|["']?\s*$/g, ''))))
    : [];
}

export default function parseSearchFilter(pattern) {
  let [query, filters] = dissociate(pattern, '@').map(str => str.trim());
  if (!filters) [query, filters] = [filters, query];
  filters = parseFilters(filters);
  if (!query && (filters[0] || []).length === 1) [query] = filters.shift();
  return {query: query ? deescapeFilterPart(query) : '*', filters: Object.fromEntries(filters)};
}
