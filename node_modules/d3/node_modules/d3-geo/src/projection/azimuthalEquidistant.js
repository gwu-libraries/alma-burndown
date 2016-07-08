import {acos, sin, tau} from "../math";
import {azimuthalRaw, azimuthalInvert} from "./azimuthal";
import projection from "./index";

export var azimuthalEquidistantRaw = azimuthalRaw(function(c) {
  return (c = acos(c)) && c / sin(c);
});

azimuthalEquidistantRaw.invert = azimuthalInvert(function(z) {
  return z;
});

export default function() {
  return projection(azimuthalEquidistantRaw)
      .scale(480 / tau)
      .clipAngle(180 - 1e-3);
}
