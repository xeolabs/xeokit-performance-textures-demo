# xeokit-performance-textures-demo

## Overview

Introduces the ability to load triangle meshes with color texture from glTF. This allows us to view photogrammetry models.

## NPM Package

Pre-release of the feature branch:

* @xeokit/xeokit-sdk 2.2.5-performance-textures-beta

## Examples

---

[![screenshot from 2018-02-01 02-02-50](assets/images/photogrammetry.gif)](https://xeolabs.github.io/xeokit-performance-textures-demo/examples/loading_glTF_photogrammetry)

* [Viewing a photogrammetry scan from glTF](https://xeolabs.github.io/xeokit-performance-textures-demo/examples/loading_glTF_photogrammetry)

---

[![screenshot from 2018-02-01 02-02-50](assets/images/slice.gif)](https://xeolabs.github.io/xeokit-performance-textures-demo/examples/gizmos_SectionPlanesPlugin_createWithMouse_photogrammetry)

* [Slicing a photogrammetry scan from glTF](https://xeolabs.github.io/xeokit-performance-textures-demo/examples/gizmos_SectionPlanesPlugin_createWithMouse_photogrammetry)

---

[![screenshot from 2018-02-01 02-02-50](assets/images/measureDistance.gif)](https://xeolabs.github.io/xeokit-performance-textures-demo/examples/measurements_distance_createWithMouse_photogrammetry)

* [Measuring distances on a photogrammetry scan from glTF](https://xeolabs.github.io/xeokit-performance-textures-demo/examples/measurements_distance_createWithMouse_photogrammetry)

---

[![screenshot from 2018-02-01 02-02-50](assets/images/measureAngle.gif)](https://xeolabs.github.io/xeokit-performance-textures-demo/examples/measurements_angle_createWithMouse_photogrammetry)

* [Measuring angles on a photogrammetry scan from glTF](https://xeolabs.github.io/xeokit-performance-textures-demo/examples/measurements_angle_createWithMouse_photogrammetry)

---

## Issues

1. Some geometries loaded by XKTLoaderPlugin are positioned incorrectly. This is a breakage in the transforms for those objects, an easy fix.

## Next Steps

1. Finish XKTLoaderPlugin support for textures
2. Finish XKT format with textures
3. Finish convert2xkt for textures