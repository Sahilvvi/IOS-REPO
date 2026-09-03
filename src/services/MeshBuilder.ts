/**
 * Builds a render-ready socket mesh (positions + normals + 18 sensor
 * positions) from raw geometry, using the chosen sensor-mapping method and
 * grid layout — the piece that actually connects Settings' "Sensor Mapping"
 * picker to what the 3D viewer draws. Without this, SensorMapper.ts's three
 * mapping algorithms compute positions nobody ever looks at.
 */
import { RawMesh, PreparedMesh, orientMesh, orientedMeshBounds, finishMeshWithSensors, prepareMesh } from '@/gl/mesh';
import { mapSensors, MappingMethod } from './SensorMapper';

export interface MeshBuildOptions {
  method: MappingMethod;
  rows: number;
  cols: number;
  coverage?: number;
  offset?: number;
}

/**
 * Places `rows * cols` sensors on `raw` using `method`, scaled to the mesh's
 * own size, then snaps each target onto the nearest real mesh vertex.
 * Falls back to evenly-spaced auto placement if rows*cols doesn't match the
 * hardware's fixed 18-sensor array (mapSensors output would be the wrong length).
 *
 * Orients the mesh (centre + PCA-upright + open-end-up, see gl/mesh.ts)
 * *before* generating sensor targets, so SensorMapper's radius/height inputs
 * — and the targets it hands back — are already in the same frame as the
 * mesh the 3D viewer actually draws, not the scan's raw, arbitrary orientation.
 */
export function buildPreparedMesh(raw: RawMesh, opts: MeshBuildOptions): PreparedMesh {
  const { method, rows, cols, coverage = 0.85, offset = 2.0 } = opts;

  if (rows * cols !== 18) {
    return prepareMesh(raw);
  }

  const oriented = orientMesh(raw);
  const { height, avgRadius } = orientedMeshBounds(oriented.positions);
  const { sensors } = mapSensors(method, rows, cols, coverage, offset, avgRadius, height);

  const sensorTargets = new Float32Array(sensors.length * 3);
  sensors.forEach((s, i) => {
    sensorTargets[i * 3] = s.x;
    sensorTargets[i * 3 + 1] = s.y;
    sensorTargets[i * 3 + 2] = s.z;
  });

  return finishMeshWithSensors(oriented, sensorTargets);
}
