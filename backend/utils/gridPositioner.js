// A tiny "CSS Grid, but computed in JS" helper - since librsvg (the SVG
// renderer this project's pipeline uses via sharp/libvips) doesn't support
// real CSS Grid/Flexbox inside <foreignObject> (verified: it silently drops
// the content), layouts still have to be hand-positioned rectangles. This
// helper does the same bookkeeping CSS Grid would - named column/row
// tracks sized by relative weight (like `fr` units), addressed by line
// index the way CSS Grid's `grid-column`/`grid-row` lines work - so
// multi-column/row-spanning cells are computed instead of hand-typed.
//
// Columns/rows are given as arrays of relative weights (e.g. [1,1,1] for
// three equal tracks, or [4,2,4] for a wide/narrow/wide split) and
// allocated proportionally across the given pixel width/height. A cell
// spanning the first two of three columns is colStart=0, colEnd=2 - line
// indices, not track indices, matching CSS Grid's own convention.
function createGridPositioner({ x, y, width, height, columns, rows }) {
  const colLines = trackLines(columns, x, width);
  const rowLines = trackLines(rows, y, height);

  return {
    colLines,
    rowLines,
    // The pixel rect for a cell spanning [colStart, colEnd) x [rowStart, rowEnd).
    rect(colStart, colEnd, rowStart, rowEnd) {
      return {
        x: colLines[colStart],
        y: rowLines[rowStart],
        width: colLines[colEnd] - colLines[colStart],
        height: rowLines[rowEnd] - rowLines[rowStart],
      };
    },
    // Horizontal/vertical center of a span - colEnd/rowEnd default to
    // "one track wide" so centerX(2) means the center of column 2 alone.
    centerX(colStart, colEnd = colStart + 1) {
      return (colLines[colStart] + colLines[colEnd]) / 2;
    },
    centerY(rowStart, rowEnd = rowStart + 1) {
      return (rowLines[rowStart] + rowLines[rowEnd]) / 2;
    },
  };
}

// Cumulative pixel boundaries for a set of relative-weight tracks, e.g.
// weights [1,1,2] over 400px starting at 0 -> [0, 100, 200, 400] (four
// lines bounding three tracks: 100px, 100px, 200px).
function trackLines(weights, start, totalSize) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const lines = [start];
  let acc = start;
  for (const w of weights) {
    acc += (w / sum) * totalSize;
    lines.push(acc);
  }
  return lines;
}

module.exports = { createGridPositioner };
