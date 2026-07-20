# Layered platforms

`createLayeredPlatform` builds a camera-readable 2.5D floating-island silhouette:
a deterministic jagged shelf, tapered dark crag, faceted strata, raised polygonal
rim, inset walkable top, small edge stones, and clustered surface details. No
smooth cylinder or torus primitives are used for the island body.

Repeated details use instancing. All materials are supplied by the caller so a
world slice can share a small material palette across every platform. The
returned `dispose()` function releases only factory-owned geometries; material
and texture lifetime remains with the caller.

```ts
const platform = createLayeredPlatform({
  id: "foundation",
  radius: 5,
  materials,
  jaggedness: .16,
  cragDepth: 1.1,
  radialFacetCount: 26,
  verticalFacetCount: 7,
  sockets: [
    { id: "forward", angle: 0 },
    { id: "left", angle: -Math.PI / 4 },
  ],
});

scene.add(platform.group);
const bridgeStart = platform.sockets.get("forward")?.anchor;
```

The group origin is the platform center. `surfaceY` is the local walkable
height. A socket's local `+Z` points away from the platform; call
`anchor.getWorldPosition()` and `anchor.getWorldQuaternion()` after updating
world matrices when connecting geometry in world space.

Call `platform.dispose()` when the owning world slice is unloaded. Do not
dispose shared materials until every slice using them has been released.

## Shape controls

- `jaggedness` is the maximum fractional edge variation (`0` through `.45`;
  default `.13`). The same seeded outline drives the shelf, top, rim, and strata.
- `cragDepth` is the vertical underside depth as a radius multiplier (default
  `1`). A platform of radius `5` therefore reaches about `5` units below its
  walkable surface.
- `radialFacetCount` controls perimeter facets (default `28`, minimum `12`).
- `verticalFacetCount` controls tapered crag ledges (default `6`, minimum `3`).
- `seed` controls both silhouette and decoration placement, so rebuilding a
  platform with the same options produces the same shape.

The older `radialSegments` option remains supported as a fallback for current
quality-tier callers; `radialFacetCount` takes precedence when both are set.

For bespoke radial props, `createJaggedRadialProfile`,
`createFacetedRadialGeometry`, and `createFacetedAnnulusGeometry` expose the
same lightweight flat-shaded geometry path. They return ordinary
`THREE.BufferGeometry` instances whose ownership remains with the caller.
