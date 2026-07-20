# Segmented rope bridges

`createRopeBridge` builds a curved bridge between two local-space walking
surface anchors. It uses instanced deck planks and posts, four tubular rope
lines, and a cubic sag curve. Optional accent planks create visual rhythm
without adding draw calls per plank.

```ts
const bridge = createRopeBridge({
  id: "foundation-to-clarity",
  start: [0, 0.12, -4.4],
  end: [0, 1.32, -10.8],
  materials: { deck: wood, rope, accent: gold },
  width: 1.1,
  sag: 0.65,
});

scene.add(bridge.group);
bridge.sampleTravel(progress, character.position, forward);
```

`start`, `end`, `travelCurve`, and both endpoint sockets are in the bridge
group's local space. Each socket's `+Z` axis follows start-to-end travel.
Use `group.localToWorld()` or the socket world transforms when the group is
nested under a transformed world slice.

The caller owns all materials and textures. `bridge.dispose()` releases only
factory-owned geometries, so shared world materials remain valid. Remove the
group from its parent before disposing it.
