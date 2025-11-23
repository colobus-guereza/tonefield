/**
 * 톤필드 타점 계산 로직
 * 비즈니스 로직을 독립 모듈로 분리하여 재사용 가능하게 만듦
 */

// 물리 상수
export const TONEFIELD_CONSTANTS = {
  RADIUS_X: 0.3,
  RADIUS_Y: 0.425,
  THRESHOLD_C: 20.0,
  SCALING_S: 30.0,
  SAFETY_RATIO: 2.1,
  LIMIT: 42.0, // THRESHOLD_C * SAFETY_RATIO
  STIFFNESS_K: {
    tonic: 1.0,
    octave: 0.9,
    fifth: 1.2
  },
  HAMMERING_RULES: {
    INTERNAL: { SNAP_LIMIT: 1.0, PRESS_START: 10.0 },
    EXTERNAL: { SNAP_LIMIT: 5.0 }
  }
} as const;

export interface TuningErrors {
  tonic: number;    // 실제로는 fifthError
  octave: number;
  fifth: number;    // 실제로는 tonicError
}

export interface HitPointResult {
  coordinate: { x: number; y: number };
  strength: number;
  count: number;
  hammeringType: 'SNAP' | 'PULL' | 'PRESS';
  location: 'internal' | 'external';
  intent: '상향' | '하향';
  target: {
    primary: string;
    auxiliary: string | null;
    display: string;
  };
}

/**
 * 조율 오차를 기반으로 타점 좌표 계산
 */
export function calculateHitPointCoordinate(
  errors: TuningErrors,
  location: 'internal' | 'external'
): { x: number; y: number } {
  const { RADIUS_X, RADIUS_Y } = TONEFIELD_CONSTANTS;

  const eT = Math.abs(errors.tonic);
  const eO = Math.abs(errors.octave);
  const eF = Math.abs(errors.fifth);

  // 물리적 힘 (raw Hz 값)
  const forceTonic = eT;
  const forceOctave = eO;
  const forceFifth = eF;

  // Primary target 결정
  const scores = [
    { type: 'tonic', score: eT * 6, value: errors.tonic, force: forceTonic },
    { type: 'octave', score: eO * 3, value: errors.octave, force: forceOctave },
    { type: 'fifth', score: eF * 2, value: errors.fifth, force: forceFifth }
  ].sort((a, b) => b.score - a.score);

  const primary = scores[0];
  const primaryErrorValue = primary.value;

  // 벡터 힘 계산
  let vectorX = 0;
  let vectorY = 0;

  // Apply angular masking to prevent side region (fifth) from invading the top region.
  // The mask reduces the side component as the angle approaches the vertical (top) direction.
  // mask = 1 - sin(theta) where theta is the angle from the horizontal axis.
  // This will be applied after vector forces are determined.

  if (primary.type === 'fifth') {
    const isRight = Math.random() >= 0.5;
    vectorX = isRight ? forceFifth : -forceFifth;

    const fifthSign = Math.sign(primary.value);
    const candidates = [
      { type: 'octave', value: errors.octave, force: forceOctave, sign: Math.sign(errors.octave) },
      { type: 'tonic', value: errors.tonic, force: forceTonic, sign: Math.sign(errors.tonic) }
    ];

    const cooperatives = candidates.filter(c => c.sign === fifthSign && c.value !== 0);
    if (cooperatives.length > 0) {
      cooperatives.sort((a, b) => b.force - a.force);
      const partner = cooperatives[0];
      if (partner.type === 'octave') {
        vectorY = partner.force;
      } else {
        vectorY = -partner.force;
      }
    }
  } else {
    if (primary.type === 'octave') {
      vectorY = forceOctave;
    } else {
      vectorY = -forceTonic;
    }

    const isSignSame = Math.sign(primary.value) === Math.sign(errors.fifth);
    if (isSignSame || errors.fifth === 0) {
      const isRight = Math.random() >= 0.5;
      vectorX = isRight ? forceFifth : -forceFifth;
    }
  }

  // 각도 계산 및 타원 좌표 매핑
  const theta = Math.atan2(vectorY, vectorX);
  // Compute mask based on angle (0 = horizontal, π/2 = vertical)
  const mask = 1.0 - Math.sin(Math.abs(theta));
  // Apply mask only to the side (X) component when the primary target is not the top region.
  vectorX *= mask;
  const x = RADIUS_X * Math.cos(theta);
  const y = RADIUS_Y * Math.sin(theta);

  return { x, y };
}

/**
 * 타점 강도 및 타수 계산
 */
export function calculateHitPointStrength(
  errors: TuningErrors,
  coordinate: { x: number; y: number },
  location: 'internal' | 'external'
): { strength: number; count: number } {
  const {
    RADIUS_X,
    RADIUS_Y,
    THRESHOLD_C,
    SCALING_S,
    LIMIT,
    STIFFNESS_K
  } = TONEFIELD_CONSTANTS;

  const eT = Math.abs(errors.tonic);
  const eO = Math.abs(errors.octave);
  const eF = Math.abs(errors.fifth);

  const scores = [
    { type: 'tonic', score: eT * 6, value: errors.tonic },
    { type: 'octave', score: eO * 3, value: errors.octave },
    { type: 'fifth', score: eF * 2, value: errors.fifth }
  ].sort((a, b) => b.score - a.score);

  const primary = scores[0];
  const primaryErrorValue = primary.value;
  const mode = primary.type as 'tonic' | 'octave' | 'fifth';

  // 상대 효율성
  let currentPos = 0;
  let vertexPos = 1.0;
  if (mode === 'fifth') {
    currentPos = Math.abs(coordinate.x);
    vertexPos = RADIUS_X;
  } else {
    currentPos = Math.abs(coordinate.y);
    vertexPos = RADIUS_Y;
  }
  const efficiency = Math.max(currentPos / vertexPos, 0.1);
  const effectiveHz = Math.abs(primaryErrorValue) / efficiency;

  // 에너지 계산
  const stiffness = STIFFNESS_K[mode] || 1.0;
  const pureEnergy = Math.sqrt(effectiveHz * SCALING_S * stiffness);
  const requiredForce = THRESHOLD_C + pureEnergy;

  // Multi-hit safety splitting
  let finalForce = requiredForce;
  let finalCount = 1;

  // Helper for smoothstep blending (defined later in file)


  if (requiredForce > LIMIT) {
    let count = 2;
    while (true) {
      const splitEnergy = pureEnergy / Math.sqrt(count);
      const currentForce = THRESHOLD_C + splitEnergy;
      if (currentForce <= LIMIT) {
        finalForce = currentForce;
        finalCount = count;
        break;
      }
      count++;
      if (count > 10) {
        finalForce = LIMIT;
        finalCount = 10;
        break;
      }
    }
  }

  // Apply soft blending when the force approaches the safety limit
  const blendT = smoothstep(LIMIT * 0.8, LIMIT, finalForce);
  finalForce = finalForce * (1 - blendT) + LIMIT * blendT;

  return {
    strength: Number(finalForce.toFixed(1)),
    count: finalCount
  };
}

/**
 * Helper function for smoothstep blending
 */
function smoothstep(edge0: number, edge1: number, x: number): number {
  // Scale, bias and saturate x to 0..1 range
  x = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  // Evaluate polynomial
  return x * x * (3 - 2 * x);
}

/**
 * 해머링 타입 결정
 */
export function determineHammeringType(
  errors: TuningErrors,
  location: 'internal' | 'external'
): 'SNAP' | 'PULL' | 'PRESS' {
  const { HAMMERING_RULES } = TONEFIELD_CONSTANTS;

  const eT = Math.abs(errors.tonic);
  const eO = Math.abs(errors.octave);
  const eF = Math.abs(errors.fifth);

  const scores = [
    { type: 'tonic', score: eT * 6, value: errors.tonic },
    { type: 'octave', score: eO * 3, value: errors.octave },
    { type: 'fifth', score: eF * 2, value: errors.fifth }
  ].sort((a, b) => b.score - a.score);

  const primary = scores[0];
  const absHz = Math.abs(primary.value);

  if (location === 'internal') {
    if (absHz <= HAMMERING_RULES.INTERNAL.SNAP_LIMIT) {
      return 'SNAP';
    } else if (absHz < HAMMERING_RULES.INTERNAL.PRESS_START) {
      return 'PULL';
    } else {
      return 'PRESS';
    }
  } else {
    if (absHz <= HAMMERING_RULES.EXTERNAL.SNAP_LIMIT) {
      return 'SNAP';
    } else {
      return 'PRESS';
    }
  }
}

/**
 * 조율 대상 자동 계산
 */
export function calculateTuningTarget(errors: TuningErrors): {
  primary: string;
  auxiliary: string | null;
  display: string;
} {
  const tonicValue = Math.abs(errors.tonic) * 6;
  const octaveValue = Math.abs(errors.octave) * 3;
  const fifthValue = Math.abs(errors.fifth) * 2;

  const scores = [
    { type: '토닉', key: 'tonic', score: tonicValue, value: errors.tonic },
    { type: '옥타브', key: 'octave', score: octaveValue, value: errors.octave },
    { type: '5도', key: 'fifth', score: fifthValue, value: errors.fifth }
  ].sort((a, b) => b.score - a.score);

  const primary = scores[0];
  const maxValue = primary.score;

  if (maxValue === 0) {
    return {
      primary: '',
      auxiliary: null,
      display: ''
    };
  }

  // 보조 조율대상 선정 로직 (좌표계 사분면 기반)
  // 토닉과 옥타브는 Y축을 공유하지만 방향이 반대이므로 절대로 보조가 될 수 없음
  let auxiliary: typeof scores[0] | undefined = undefined;

  if (primary.key === 'tonic' || primary.key === 'octave') {
    // Primary가 토닉 또는 옥타브인 경우 → 보조는 5도만 가능
    const fifthCandidate = scores.find(item => item.key === 'fifth' && item.value !== 0);
    if (fifthCandidate) {
      // 5도와 부호가 같은 경우에만 보조로 선정
      const primarySign = Math.sign(primary.value);
      const fifthSign = Math.sign(fifthCandidate.value);
      if (primarySign === fifthSign) {
        auxiliary = fifthCandidate;
      }
    }
  } else if (primary.key === 'fifth') {
    // Primary가 5도인 경우 → 보조는 토닉 또는 옥타브 중 부호가 같은 것
    const primarySign = Math.sign(primary.value);
    const candidates = scores
      .slice(1)
      .filter(item =>
        (item.key === 'tonic' || item.key === 'octave') &&
        item.value !== 0 &&
        Math.sign(item.value) === primarySign
      );

    if (candidates.length > 0) {
      // 가중치 점수가 더 높은 것을 선택
      candidates.sort((a, b) => b.score - a.score);
      auxiliary = candidates[0];
    }
  }

  if (auxiliary) {
    return {
      primary: primary.type,
      auxiliary: auxiliary.type,
      display: `${primary.type} (+${auxiliary.type})`
    };
  } else {
    return {
      primary: primary.type,
      auxiliary: null,
      display: primary.type
    };
  }
}

/**
 * 전체 타점 계산 (통합 함수)
 */
export function calculateHitPoint(
  errors: TuningErrors,
  location: 'internal' | 'external'
): HitPointResult {
  const coordinate = calculateHitPointCoordinate(errors, location);
  const { strength, count } = calculateHitPointStrength(errors, coordinate, location);
  const hammeringType = determineHammeringType(errors, location);
  const target = calculateTuningTarget(errors);

  // 의도 결정
  const scores = [
    { type: 'tonic', value: errors.tonic },
    { type: 'octave', value: errors.octave },
    { type: 'fifth', value: errors.fifth }
  ].sort((a, b) => Math.abs(b.value) * (b.type === 'tonic' ? 6 : b.type === 'octave' ? 3 : 2) -
    Math.abs(a.value) * (a.type === 'tonic' ? 6 : a.type === 'octave' ? 3 : 2));

  const primaryValue = scores[0].value;
  const intent = primaryValue > 0 ? '하향' : primaryValue < 0 ? '상향' : '상향';

  return {
    coordinate,
    strength,
    count,
    hammeringType,
    location,
    intent,
    target
  };
}

