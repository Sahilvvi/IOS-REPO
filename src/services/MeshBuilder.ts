/**
 * Builds a render-ready socket mesh (positions + normals + 18 sensor
 * positions) from raw geometry, using the chosen sensor-mapping method and
 * grid layout — the piece that actually connects Settings' "Sensor Mapping"
 * picker to what the 3D viewer draws. Without this, SensorMapper.ts's three
 * mapping algorithms compute positions nobody ever looks at.
 */
import { RawMesh, PreparedMesh, prepareMesh } from './StlParser';
import { mapSensors, MappingMethod } from './SensorMapper';

export interface MeshBuildOptions {
  method: MappingMethod;
  rows: number;
  cols: number;
  coverage?: number;
  offset?: number;
}

function meshBounds(positions: Float32Array) {
  let minY = Infinity, maxY = -Infinity, rSum = 0, rCount = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    rSum += Math.hypot(positions[i], positions[i + 2]);
    rCount++;
  }
  return {
    minY, maxY,
    height: Math.max(1, maxY - minY),
    avgRadius: rCount ? rSum / rCount : 40,
  };
}

/**
 * Places `rows * cols` sensors on `raw` using `method`, scaled to the mesh's
 * own size, then snaps each target onto the nearest real mesh vertex.
 * Falls back to evenly-spaced auto placement if rows*cols doesn't match the
 * hardware's fixed 18-sensor array (mapSensors output would be the wrong length).
 */
export function buildPreparedMesh(raw: RawMesh, opts: MeshBuildOptions): PreparedMesh {
  const { method, rows, cols, coverage = 0.85, offset = 2.0 } = opts;

  if (rows * cols !== 18) {
    return prepareMesh(raw);
  }

  const { height, avgRadius } = meshBounds(raw.positions);
  const { sensors } = mapSensors(method, rows, cols, coverage, offset, avgRadius, height);
  return prepareMesh(raw, sensors);
}
