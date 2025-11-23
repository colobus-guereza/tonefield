// src/lib/__tests__/tonefield-calculation.test.ts
import { calculateHitPointCoordinate, calculateHitPointStrength } from '../tonefield-calculation';

describe('Angular masking reduces side component', () => {
    test('vectorX is reduced by mask when primary is fifth', () => {
        const errors = { tonic: 0, octave: 0, fifth: 10 }; // primary will be fifth
        const coord = calculateHitPointCoordinate(errors, 'internal');
        // Since mask reduces vectorX, the absolute x should be less than raw force (10) scaled by RADIUS_X
        // RADIUS_X is 0.3, so raw x would be 0.3 * 10 = 3 without mask. With mask, it should be < 3.
        expect(Math.abs(coord.x)).toBeLessThan(3);
    });
});

describe('Smoothstep blending caps strength at safety limit', () => {
    test('strength does not exceed LIMIT', () => {
        // Choose errors that produce a large requiredForce > LIMIT (42)
        const errors = { tonic: 100, octave: 0, fifth: 0 };
        const result = calculateHitPointStrength(errors, { x: 0, y: 0 }, 'internal');
        expect(result.strength).toBeLessThanOrEqual(42);
    });
});
