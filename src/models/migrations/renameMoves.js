export function renameMoves(data) {
  data.moves ||= [];
  for (const move of (data.coreMoves || [])) {
    if (!data.moves.some(existing => existing.id === move.id)) data.moves.push({ ...move, core: !['Initiated Response', 'Straight Offense', 'Offensive Defense'].includes(move.name), creatorId: move.creatorId || '', media: move.media || [], order: data.moves.length });
  }
  delete data.coreMoves;
}
