# World quality verification

Run `npm run test:world` from the workspace root. The focused verifier covers
the motion and geometry invariants that are not visible to TypeScript:

- midpoint rotation, completion, and overlapping-input rejection;
- reduced-motion crossfade without spatial rotation;
- deterministic, bounded background motion;
- layered platform construction, connection sockets, modular bridge parts, and
  matching bridge/travel endpoints.

Rendered desktop and narrow-mobile review remains required because these checks
do not measure composition or visual fidelity.
