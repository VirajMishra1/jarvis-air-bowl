export const LANE_START_Z = -0.6;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const laneRestY = (radius) => Math.max(radius + 0.08, 0.38);

export const getLaneLaunchX = (handPos) => {
  const normalizedHandX = (handPos.x * 2 - 1) * -1;
  return clamp(normalizedHandX * 0.95, -1.05, 1.05);
};

export const buildThrowProfile = (handPos, release, radius) => {
  const handX = (handPos.x * 2 - 1) * -1 * 2;
  const laneBias = clamp(-handX * 1.8, -3.4, 3.4);
  const releaseHeight = clamp(1 - handPos.y, 0, 1);
  const blendedX = release.averagedVelocity.x * 0.65 + release.peakVelocity.x * 0.35;
  const blendedY = release.averagedVelocity.y * 0.45 + release.peakVelocity.y * 0.55;
  const blendedZ = release.averagedVelocity.z * 0.45 + release.peakVelocity.z * 0.55;
  const driveInput =
    release.speed * 10 + Math.abs(blendedY) * 16 + Math.abs(blendedZ) * 14 + releaseHeight * 6;
  const forwardForce = clamp(driveInput, 36, 62);
  const sideForce = clamp(laneBias + blendedX * -7.5, -7.5, 7.5);
  const loft = clamp(0.22 + releaseHeight * 0.34 - Math.max(0, blendedY) * 0.95, 0.05, 0.55);
  const hookSpin = clamp(blendedX * -11 + release.roll * 6, -10, 10);
  const forwardSpin = clamp(forwardForce * 0.08 + Math.abs(blendedY) * 2.4, 2.5, 7.5);
  const axisTilt = clamp(release.roll * 8 + sideForce * 0.24, -9, 9);
  const launchPosition = [getLaneLaunchX(handPos), laneRestY(radius) + 0.015, LANE_START_Z];

  return {
    vector: [sideForce, loft, -forwardForce],
    spin: [forwardSpin, hookSpin, axisTilt],
    launchPosition,
  };
};

export const buildTrajectorySamples = (handPos, release, radius, count = 20) => {
  const { vector, spin, launchPosition } = buildThrowProfile(handPos, release, radius);
  const laneY = laneRestY(radius);
  const points = [];
  let x = launchPosition[0];
  let y = launchPosition[1];
  let z = launchPosition[2];
  let vx = vector[0] * 0.017;
  let vy = vector[1] * 0.022;
  let vz = vector[2] * 0.05;

  for (let index = 0; index < count; index += 1) {
    points.push([x, y, z]);

    const onLane = y <= laneY + 0.06;
    const hook = onLane && z < -2 ? clamp(spin[1] * 0.0017, -0.03, 0.03) : 0;

    vx += hook;
    vy -= 0.045;
    x += vx;
    y += vy;
    z += vz;

    if (y < laneY) {
      y = laneY;
      vy *= 0.3;
      vx *= 0.985;
    } else {
      vy *= 0.985;
    }

    vz *= 0.995;
  }

  return points;
};
