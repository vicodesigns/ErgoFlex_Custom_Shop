// Director People: a person's stays in a chapter (the film's `when[key]`: [[in, out, fade in, fade out], ...]).
// Pure: no DOM. Changing one stay keeps every other stay exactly as it was.
//   A stay that runs to the chapter's end is kept a second past it, so the person does not fade out under the dissolve.
export function withSpan(spans, k, change, T) {
  const all = Array.isArray(spans) ? spans.map(x => [...x]) : [], i = all[k] ? k : 0;
  const cur = all[i] || [0, T + 1, .5, .5], s = [cur[0], Math.min(cur[1], T), cur[2] ?? .5, cur[3] ?? .5];
  change(s); if (s[1] >= T - .001) s[1] = T + 1;
  all[i] = s; return all;
}
