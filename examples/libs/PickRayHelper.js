import {buildSphereGeometry, Component, math, Node, Mesh, PhongMaterial, VBOGeometry} from "./../../dist/xeokit-sdk.es.js";

const zeroVec = new Float64Array([0, 0, -1]);
const quat = new Float64Array(4);

class PickRayHelper extends Component {

    constructor(owner, cfg={}) {

        super(owner, cfg);

        this._node = new Node(this, {
            pickable: false,
            visible: true,
            position: [0, 0, 0],

            children: [
                new Mesh(this, {
                    geometry: new VBOGeometry(this, buildSphereGeometry({radius: .1})),
                    material: new PhongMaterial(this, {emissive: [0, 1, 0], diffuse: [0, 0, 0]}),
                    pickable: false
                }),
                new Mesh(this, {
                    geometry: new VBOGeometry(this, {
                        primitive: "lines",
                        positions: [
                            0.0, 0.0, 0.0, 0.0, 0.0, -2.0
                        ],
                        indices: [0, 1]
                    }),
                    material: new PhongMaterial(this, {emissive: [0, 1, 0], diffuse: [0, 0, 0], lineWidth: 4}),
                    pickable: false
                })
            ]
        });
    }

    setRay(origin, dir) {
        if (origin) {
            this._node.position = origin;
            this._node.visible = true;
            (this._dir = this._dir || math.vec3()).set(dir || [0, 0, 1]);
            math.vec3PairToQuaternion(zeroVec, this._dir, quat);
            this._node.quaternion = quat;
        } else {
            this._node.visible = false;
        }
    }
}

export {PickRayHelper};

