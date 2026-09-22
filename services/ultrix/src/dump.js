// Turns what the router reported (names + current crosspoints) into files that are easy to review
// and to build categories from. Pure functions; src/dump-names.js does the connecting and file writing.

const csv = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));
const row = (cells) => cells.map(csv).join(',');

/** Leading letters of each name ("CAM 03" -> CAM); prefixes shared by 3+ ports become category suggestions. */
export function suggestCategories(names) {
  const groups = new Map();
  for (const [n, name] of [...names].sort((a, b) => a[0] - b[0])) {
    const m = /^[A-Za-z]+/.exec(name.trim());
    if (!m) continue;
    const key = m[0].toUpperCase();
    const g = groups.get(key) ?? { name: m[0], match: `^${m[0]}`, count: 0, first: n, last: n };
    g.count++;
    g.last = n;
    groups.set(key, g);
  }
  return [...groups.values()].filter((g) => g.count >= 3).sort((a, b) => a.first - b.first);
}

const maxKey = (iter) => Math.max(0, ...iter);

export function buildDump({ sourceNames, destNames, routes, levels }) {
  const sourcesUsed = new Map(); // src -> number of destinations taking it on level 1
  const routedSources = new Set();
  for (const perLevel of routes.values()) {
    for (const src of perLevel.values()) if (src > 0) routedSources.add(src);
    const first = perLevel.get(1);
    if (first > 0) sourcesUsed.set(first, (sourcesUsed.get(first) ?? 0) + 1);
  }

  const srcMax = Math.max(maxKey(sourceNames.keys()), maxKey(routedSources));
  const dstMax = Math.max(maxKey(destNames.keys()), maxKey(routes.keys()));
  const blank = (map, max) => Array.from({ length: max }, (_, i) => i + 1).filter((n) => !map.get(n));
  const unnamedSources = blank(sourceNames, srcMax);
  const unnamedDests = blank(destNames, dstMax);
  const routedButUnnamed = [...routedSources].filter((n) => !sourceNames.get(n)).sort((a, b) => a - b);

  const sourcesCsv = [row(['number', 'name', 'destinations_using_on_level_1'])];
  for (let n = 1; n <= srcMax; n++) sourcesCsv.push(row([n, sourceNames.get(n) ?? '', sourcesUsed.get(n) ?? 0]));

  const destinationsCsv = [row(['number', 'name', 'level_1_source_number', 'level_1_source_name', 'breakaway'])];
  for (let n = 1; n <= dstMax; n++) {
    const perLevel = routes.get(n) ?? new Map();
    const l1 = perLevel.get(1);
    const breakaway = new Set(perLevel.values()).size > 1;
    destinationsCsv.push(row([n, destNames.get(n) ?? '', l1 ?? '', !l1 ? '' : sourceNames.get(l1) ?? '', breakaway ? 'yes' : '']));
  }

  const suggestions = { sources: suggestCategories(sourceNames), destinations: suggestCategories(destNames) };
  const snippet = (list) => `[\n${list.map(({ name, match }) => `    { "name": ${JSON.stringify(name)}, "match": ${JSON.stringify(match)} }`).join(',\n')}\n  ]`;
  const listRanges = (nums) => {
    const runs = [];
    for (const n of nums) {
      const last = runs.at(-1);
      if (last && n === last[1] + 1) last[1] = n; else runs.push([n, n]);
    }
    return runs.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(',');
  };
  const cap = (text) => (text.length > 300 ? `${text.slice(0, 300)}...` : text);

  const summary = [
    `Sources:       ${srcMax} ports (${srcMax - unnamedSources.length} named, ${unnamedSources.length} unnamed)`,
    `Destinations:  ${dstMax} ports (${dstMax - unnamedDests.length} named, ${unnamedDests.length} unnamed)`,
    `Levels asked:  ${levels}`,
    routedButUnnamed.length ? `Routed from sources that have no name: ${cap(listRanges(routedButUnnamed))}` : 'Every routed source has a name.',
    unnamedSources.length ? `Unnamed sources: ${cap(listRanges(unnamedSources))}` : 'No unnamed sources.',
    unnamedDests.length ? `Unnamed destinations: ${cap(listRanges(unnamedDests))}` : 'No unnamed destinations.',
    '',
    'Category suggestions (name prefixes shared by 3+ ports). Paste into config.json under "sources" / "destinations":',
    '',
    `"sources": {\n  "categories": ${snippet(suggestions.sources)}\n}`,
    '',
    `"destinations": {\n  "categories": ${snippet(suggestions.destinations)}\n}`,
    '',
    'Prefix counts: sources ' + (suggestions.sources.map((g) => `${g.name} ${g.count} (${g.first}-${g.last})`).join(', ') || 'none')
      + ' | destinations ' + (suggestions.destinations.map((g) => `${g.name} ${g.count} (${g.first}-${g.last})`).join(', ') || 'none'),
  ].join('\n');

  return {
    summary,
    sourcesCsv: `${sourcesCsv.join('\n')}\n`,
    destinationsCsv: `${destinationsCsv.join('\n')}\n`,
    suggestions,
    stats: { sourcePorts: srcMax, destPorts: dstMax, unnamedSources, unnamedDests, routedButUnnamed },
  };
}

export function toJson({ sourceNames, destNames, routes }, meta) {
  return {
    ...meta,
    sources: Object.fromEntries(sourceNames),
    destinations: Object.fromEntries(destNames),
    routes: Object.fromEntries([...routes].map(([dest, levels]) => [dest, Object.fromEntries(levels)])),
  };
}
