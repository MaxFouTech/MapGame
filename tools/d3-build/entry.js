// Everything MapGame reaches through `window.d3`, and nothing else. The full
// d3 bundle is 273 KB (90 KB gzip) for ~18 functions from 8 modules; this
// build keeps only those. Keep this list in sync with `grep -o "d3\.[a-zA-Z]*" js/*.js`.

export { select } from 'd3-selection';
// d3-transition registers selection.transition() / .interrupt() as a side
// effect of being imported — the app never calls d3.transition() directly.
export { transition } from 'd3-transition';
export { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
export {
  geoPath, geoCentroid, geoDistance, geoInterpolate, geoArea,
  geoOrthographic, geoNaturalEarth1,
} from 'd3-geo';
export { scaleLinear } from 'd3-scale';
export { axisLeft, axisBottom } from 'd3-axis';
export { line, curveCatmullRom } from 'd3-shape';
export { range, max } from 'd3-array';
