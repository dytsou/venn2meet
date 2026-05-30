export function classifyHeatmapCell(input) {
  const n = Number(input.n ?? 0);
  const count = Number(input.count ?? 0);
  const mine = Boolean(input.mine);

  if (n <= 0) {
    return {
      perfect: false,
      nearPerfect: false,
      onlyMissingMe: false,
      myTime: mine
    };
  }

  const perfect = mine && count === n;
  const nearPerfect = mine && count === n - 1;
  const onlyMissingMe = !mine && count === n - 1;

  return {
    perfect,
    nearPerfect,
    onlyMissingMe,
    myTime: mine
  };
}
