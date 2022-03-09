import {utils} from "../../viewer/scene/utils.js"
import {PerformanceModel} from "../../viewer/scene/PerformanceModel/PerformanceModel.js";
import {Node} from "../../viewer/scene/nodes/Node.js";
import {Plugin} from "../../viewer/Plugin.js";
import {GLTFSceneGraphLoader} from "./GLTFSceneGraphLoader.js";
import {GLTFPerformanceModelLoader} from "./GLTFPerformanceModelLoader.js";
import {IFCObjectDefaults} from "../../viewer/metadata/IFCObjectDefaults.js";
import {GLTFDefaultDataSource} from "./GLTFDefaultDataSource.js";
import {ShapePath} from "../../viewer/scene/paths/ShapePath";
import {math} from "../../viewer/scene/math/math.js";

/**
 * {@link Viewer} plugin that loads models from [glTF](https://www.khronos.org/gltf/).
 *
 * * Creates an {@link Entity} representing each model it loads, which will have {@link Entity#isModel} set ````true```` and will be registered by {@link Entity#id} in {@link Scene#models}.
 * * Creates an {@link Entity} for each object within the model, which is indicated by each glTF ````node```` that has a ````name```` attribute. Those Entities will have {@link Entity#isObject} set ````true```` and will be registered by {@link Entity#id} in {@link Scene#objects}.
 * * When loading, can set the World-space position, scale and rotation of each model within World space, along with initial properties for all the model's {@link Entity}s.
 *
 * ## Metadata
 *
 * SVGLoaderPlugin can also load an accompanying JSON metadata file with each model, which creates a {@link MetaModel} corresponding
 * to the model {@link Entity} and a {@link MetaObject} corresponding to each object {@link Entity}.
 *
 * Each {@link MetaObject} has a {@link MetaObject#type}, which indicates the classification of its corresponding {@link Entity}. When loading
 * metadata, we can also provide SVGLoaderPlugin with a custom lookup table of initial values to set on the properties of each type of {@link Entity}. By default, SVGLoaderPlugin
 * uses its own map of default colors and visibilities for IFC element types.
 *
 * ## Quality Setting
 *
 * By default, SVGLoaderPlugin will load a high-performance scene representation that's optimized for low memory usage and
 * optimal rendering. The high-performance representation renders large numbers of objects efficiently, using geometry
 * batching and instancing, with simple Lambertian shading that ignores any textures and realistic materials in the glTF.
 *
 * Specifying ````performance:false```` to {@link SVGLoaderPlugin#load} will internally load a heavier scene
 * representation comprised of {@link Node}, {@link Mesh}, {@link Geometry}, {@link Material} and {@link Texture} components,
 * that will exactly preserve the materials specified in the glTF. Use this when you want to load a model for a realistic preview,
 * maybe using PBR etc.
 *
 * We tend to use the default ````performance:true```` setting for CAD and BIM models, where structure is more important that
 * surface appearance.
 *
 * Publically, SVGLoaderPlugin creates the same {@link Entity}s for both levels of performance. Privately, however, it implements
 * {@link Entity}s using two different sets of concrete subtypes, for its two different internally-managed scene representations.
 *
 * ## Usage
 *
 * In the example below we'll load the Schependomlaan model from a [glTF file](http://xeokit.github.io/xeokit-sdk/examples/models/gltf/schependomlaan/), along
 * with an accompanying JSON [IFC metadata file](http://xeokit.github.io/xeokit-sdk/examples/metaModels/schependomlaan/).
 *
 * This will create a bunch of {@link Entity}s that represents the model and its objects, along with a {@link MetaModel} and {@link MetaObject}s
 * that hold their metadata.
 *
 * Since this model contains IFC types, the SVGLoaderPlugin will set the initial colors of object {@link Entity}s according
 * to the standard IFC element colors in the GLTFModel's current map. Override that with your own map via property {@link SVGLoaderPlugin#objectDefaults}.
 *
 * Read more about this example in the user guide on [Viewing BIM Models Offline](https://www.notion.so/xeokit/Viewing-an-IFC-Model-with-xeokit-c373e48bc4094ff5b6e5c5700ff580ee).
 *
 * We're leaving ````performance: true```` since our model has many objects and we're not interested in realistic rendering.
 *
 * [[Run this example](http://xeokit.github.io/xeokit-sdk/examples/#BIMOffline_glTF_OTCConferenceCenter)]
 *
 * ````javascript
 * import {Viewer, SVGLoaderPlugin} from "xeokit-sdk.es.js";
 *
 * //------------------------------------------------------------------------------------------------------------------
 * // 1. Create a Viewer,
 * // 2. Arrange the camera,
 * // 3. Tweak the selection material (tone it down a bit)
 * //------------------------------------------------------------------------------------------------------------------
 *
 * // 1
 * const viewer = new Viewer({
 *      canvasId: "myCanvas",
 *      transparent: true
 * });
 *
 * // 2
 * viewer.camera.orbitPitch(20);
 * viewer.camera.orbitYaw(-45);
 *
 * // 3
 * viewer.scene.selectedMaterial.fillAlpha = 0.1;
 *
 * //------------------------------------------------------------------------------------------------------------------
 * // 1. Create a glTF loader plugin,
 * // 2. Load a glTF building model and JSON IFC metadata
 * // 3. Emphasis the edges to make it look nice
 * //------------------------------------------------------------------------------------------------------------------
 *
 * // 1
 * const gltfLoader = new SVGLoaderPlugin(viewer);
 *
 * // 2
 * var model = gltfLoader.load({                                    // Returns an Entity that represents the model
 *      id: "myModel",
 *      src: "./models/gltf/OTCConferenceCenter/scene.gltf",
 *      metaModelSrc: "./models/gltf/OTCConferenceCenter/metaModel.json",     // Creates a MetaModel (see below)
 *      edges: true,
 *      performance: true  // Load high-performance scene representation (default is false)
 * });
 *
 * model.on("loaded", () => {
 *
 *      //--------------------------------------------------------------------------------------------------------------
 *      // 1. Find metadata on the third storey
 *      // 2. Select all the objects in the building's third storey
 *      // 3. Fit the camera to all the objects on the third storey
 *      //--------------------------------------------------------------------------------------------------------------
 *
 *      // 1
 *      const metaModel = viewer.metaScene.metaModels["myModel"];       // MetaModel with ID "myModel"
 *      const metaObject
 *          = viewer.metaScene.metaObjects["0u4wgLe6n0ABVaiXyikbkA"];   // MetaObject with ID "0u4wgLe6n0ABVaiXyikbkA"
 *
 *      const name = metaObject.name;                                   // "01 eerste verdieping"
 *      const type = metaObject.type;                                   // "IfcBuildingStorey"
 *      const parent = metaObject.parent;                               // MetaObject with type "IfcBuilding"
 *      const children = metaObject.children;                           // Array of child MetaObjects
 *      const objectId = metaObject.id;                                 // "0u4wgLe6n0ABVaiXyikbkA"
 *      const objectIds = viewer.metaScene.getObjectIDsInSubtree(objectId);   // IDs of leaf sub-objects
 *      const aabb = viewer.scene.getAABB(objectIds);                   // Axis-aligned boundary of the leaf sub-objects
 *
 *      // 2
 *      viewer.scene.setObjectsSelected(objectIds, true);
 *
 *      // 3
 *      viewer.cameraFlight.flyTo(aabb);
 * });
 *
 * // Find the model Entity by ID
 * model = viewer.scene.models["myModel"];
 *
 * // Destroy the model
 * model.destroy();
 * ````
 *
 * ## Transforming
 *
 * We have the option to rotate, scale and translate each  *````.glTF````* model as we load it.
 *
 * This lets us load multiple models, or even multiple copies of the same model, and position them apart from each other.
 *
 * In the example below, we'll scale our model to half its size, rotate it 90 degrees about its local X-axis, then
 * translate it 100 units along its X axis.
 *
 * [[Run example](https://xeokit.github.io/xeokit-sdk/examples/#loading_glTF_Duplex_transform)]
 *
 * ````javascript
 * const model = gltfLoader.load({
 *      src: "./models/gltf/Duplex/scene.gltf",
 *      metaModelSrc: "./models/gltf/Duplex/Duplex.json",
 *      rotation: [90,0,0],
 *      scale: [0.5, 0.5, 0.5],
 *      position: [100, 0, 0]
 * });
 * ````
 *
 * ## Including and excluding IFC types
 *
 * We can also load only those objects that have the specified IFC types. In the example below, we'll load only the
 * objects that represent walls.
 *
 * [[Run this example](http://xeokit.github.io/xeokit-sdk/examples/#BIMOffline_glTF_includeTypes_PlanView)]
 *
 * ````javascript
 * const model = gltfLoader.load({
 *     id: "myModel",
 *      src: "./models/gltf/OTCConferenceCenter/scene.gltf",
 *      metaModelSrc: "./models/gltf/OTCConferenceCenter/metaModel.json",
 *      includeTypes: ["IfcWallStandardCase"]
 * });
 * ````
 *
 * We can also load only those objects that **don't** have the specified IFC types. In the example below, we'll load only the
 * objects that do not represent empty space.
 *
 * ````javascript
 * const model = gltfLoader.load({
 *     id: "myModel",
 *      src: "./models/gltf/OTCConferenceCenter/scene.gltf",
 *      metaModelSrc: "./models/gltf/OTCConferenceCenter/metaModel.json",
 *      excludeTypes: ["IfcSpace"]
 * });
 * ````
 * @class SVGLoaderPlugin
 */
export class SVGLoaderPlugin extends Plugin {

    /**
     * @constructor
     *
     * @param {Viewer} viewer The Viewer.
     * @param {Object} cfg  Plugin configuration.
     * @param {String} [cfg.id="GLTFLoader"] Optional ID for this plugin, so that we can find it within {@link Viewer#plugins}.
     * @param {Object} [cfg.objectDefaults] Map of initial default states for each loaded {@link Entity} that represents an object.  Default value is {@link IFCObjectDefaults}.
     * @param {Object} [cfg.dataSource] A custom data source through which the SVGLoaderPlugin can load metadata, glTF and binary attachments. Defaults to an instance of {@link GLTFDefaultDataSource}, which loads over HTTP.
     */
    constructor(viewer, cfg = {}) {

        super("GLTFLoader", viewer, cfg);

        /**
         * @private
         */
        this._sceneGraphLoader = new GLTFSceneGraphLoader(this, cfg);

        /**
         * @private
         */
        this._performanceModelLoader = new GLTFPerformanceModelLoader(this, cfg);

        this.dataSource = cfg.dataSource;
        this.objectDefaults = cfg.objectDefaults;
    }

    /**
     * Sets a custom data source through which the SVGLoaderPlugin can load metadata, glTF and binary attachments.
     *
     * Default value is {@link GLTFDefaultDataSource}, which loads via an XMLHttpRequest.
     *
     * @type {Object}
     */
    set dataSource(value) {
        this._dataSource = value || new GLTFDefaultDataSource();
    }

    /**
     * Gets the custom data source through which the SVGLoaderPlugin can load metadata, glTF and binary attachments.
     *
     * Default value is {@link GLTFDefaultDataSource}, which loads via an XMLHttpRequest.
     *
     * @type {Object}
     */
    get dataSource() {
        return this._dataSource;
    }

    /**
     * Sets map of initial default states for each loaded {@link Entity} that represents an object.
     *
     * Default value is {@link IFCObjectDefaults}.
     *
     * @type {{String: Object}}
     */
    set objectDefaults(value) {
        this._objectDefaults = value || IFCObjectDefaults;
    }

    /**
     * Gets map of initial default states for each loaded {@link Entity} that represents an object.
     *
     * Default value is {@link IFCObjectDefaults}.
     *
     * @type {{String: Object}}
     */
    get objectDefaults() {
        return this._objectDefaults;
    }

    /**
     * Loads a glTF model from a file into this SVGLoaderPlugin's {@link Viewer}.
     *
     * @param {*} params Loading parameters.
     * @param {String} [params.id] ID to assign to the root {@link Entity#id}, unique among all components in the Viewer's {@link Scene}, generated automatically by default.
     * @param {String} [params.src] Path to a glTF file, as an alternative to the ````gltf```` parameter.
     * @param {*} [params.gltf] glTF JSON, as an alternative to the ````src```` parameter.
     * @param {String} [params.metaModelSrc] Path to an optional metadata file, as an alternative to the ````metaModelData```` parameter.
     * @param {*} [params.metaModelData] JSON model metadata, as an alternative to the ````metaModelSrc```` parameter.
     * @param {{String:Object}} [params.objectDefaults] Map of initial default states for each loaded {@link Entity} that represents an object. Default value is {@link IFCObjectDefaults}.
     * @params {String[]} [params.includeTypes] When loading metadata, only loads objects that have {@link MetaObject}s with {@link MetaObject#type} values in this list.
     * @params {String[]} [params.excludeTypes] When loading metadata, never loads objects that have {@link MetaObject}s with {@link MetaObject#type} values in this list.
     * @param {Boolean} [params.edges=false] Whether or not xeokit renders the model with edges emphasized.
     * @param {Number[]} [params.origin=[0,0,0]] The double-precision World-space origin of the model's coordinates.
     * @param {Number[]} [params.position=[0,0,0]] The single-precision position, relative to ````origin````.
     * @param {Number[]} [params.scale=[1,1,1]] The model's scale.
     * @param {Number[]} [params.rotation=[0,0,0]] The model's orientation, as Euler angles given in degrees, for each of the X, Y and Z axis.
     * @param {Number[]} [params.matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]] The model's world transform matrix. Overrides the position, scale and rotation parameters. Relative to ````origin````.
     * @param {Boolean} [params.backfaces=false] When true, allows visible backfaces, wherever specified in the glTF. When false, ignores backfaces.
     * @param {Number} [params.edgeThreshold=10] When xraying, highlighting, selecting or edging, this is the threshold angle between normals of adjacent triangles, below which their shared wireframe edge is not drawn.
     * @params {Boolean} [params.performance=true] Set ````false```` to load all the materials and textures provided by the glTF file, otherwise leave ````true```` to load the default high-performance representation optimized for low memory usage and efficient rendering.
     * @returns {Entity} Entity representing the model, which will have {@link Entity#isModel} set ````true```` and will be registered by {@link Entity#id} in {@link Scene#models}
     */
    load(params = {}) {

        if (params.id && this.viewer.scene.components[params.id]) {
            this.error("Component with this ID already exists in viewer: " + params.id + " - will autogenerate this ID");
            delete params.id;
        }

        const performance = params.performance !== false;

        const model = performance

            // PerformanceModel provides performance-oriented scene representation
            // converting glTF materials to simple flat-shading without textures

            ? new PerformanceModel(this.viewer.scene, utils.apply(params, {
                isModel: true
            }))

            // Scene Node graph supports original glTF materials

            : new Node(this.viewer.scene, utils.apply(params, {
                isModel: true
            }));

        const modelId = model.id;  // In case ID was auto-generated

        if (!params.src && !params.gltf) {
            this.error("load() param expected: src or gltf");
            return model; // Return new empty model
        }

        const loader = performance ? this._performanceModelLoader : this._sceneGraphLoader;

        if (params.metaModelSrc || params.metaModelData) {

            const objectDefaults = params.objectDefaults || this._objectDefaults || IFCObjectDefaults;

            const processMetaModelData = (metaModelData) => {

                this.viewer.metaScene.createMetaModel(modelId, metaModelData, {
                    includeTypes: params.includeTypes,
                    excludeTypes: params.excludeTypes
                });

                this.viewer.scene.canvas.spinner.processes--;

                var includeTypes;
                if (params.includeTypes) {
                    includeTypes = {};
                    for (let i = 0, len = params.includeTypes.length; i < len; i++) {
                        includeTypes[params.includeTypes[i]] = true;
                    }
                }

                var excludeTypes;
                if (params.excludeTypes) {
                    excludeTypes = {};
                    if (!includeTypes) {
                        includeTypes = {};
                    }
                    for (let i = 0, len = params.excludeTypes.length; i < len; i++) {
                        includeTypes[params.excludeTypes[i]] = true;
                    }
                }

                params.readableGeometry = false;

                params.handleGLTFNode = (modelId, glTFNode, actions) => {

                    const name = glTFNode.name;

                    if (!name) {
                        return true; // Continue descending this node subtree
                    }

                    const nodeId = name;
                    const metaObject = this.viewer.metaScene.metaObjects[nodeId];
                    const type = (metaObject ? metaObject.type : "DEFAULT") || "DEFAULT";

                    actions.createEntity = {
                        id: nodeId,
                        isObject: true // Registers the Entity in Scene#objects
                    };

                    const props = objectDefaults[type];

                    if (props) { // Set Entity's initial rendering state for recognized type

                        if (props.visible === false) {
                            actions.createEntity.visible = false;
                        }

                        if (props.colorize) {
                            actions.createEntity.colorize = props.colorize;
                        }

                        if (props.pickable === false) {
                            actions.createEntity.pickable = false;
                        }

                        if (props.opacity !== undefined && props.opacity !== null) {
                            actions.createEntity.opacity = props.opacity;
                        }
                    }

                    return true; // Continue descending this glTF node subtree
                };

                if (params.src) {
                    loader.load(this, model, params.src, params);
                } else {
                    loader.parse(this, model, params.gltf, params);
                }
            };

            if (params.metaModelSrc) {

                const metaModelSrc = params.metaModelSrc;

                this.viewer.scene.canvas.spinner.processes++;

                this._dataSource.getMetaModel(metaModelSrc, (metaModelData) => {

                    this.viewer.scene.canvas.spinner.processes--;

                    processMetaModelData(metaModelData);

                }, (errMsg) => {
                    this.error(`load(): Failed to load model metadata for model '${modelId} from  '${metaModelSrc}' - ${errMsg}`);
                    this.viewer.scene.canvas.spinner.processes--;
                });

            } else if (params.metaModelData) {

                processMetaModelData(params.metaModelData);
            }

        } else {

            params.handleGLTFNode = (modelId, glTFNode, actions) => {

                const name = glTFNode.name;

                if (!name) {
                    return true; // Continue descending this node subtree
                }

                const id = name;

                actions.createEntity = { // Create an Entity for this glTF scene node
                    id: id,
                    isObject: true // Registers the Entity in Scene#objects
                };

                return true; // Continue descending this glTF node subtree
            };

            if (params.src) {
                loader.load(this, model, params.src, params);
            } else {
                loader.parse(this, model, params.gltf, params);
            }
        }

        model.once("destroyed", () => {
            this.viewer.metaScene.destroyMetaModel(modelId);
        });

        return model;
    }

    /**
     * Destroys this SVGLoaderPlugin.
     */
    destroy() {
        super.destroy();
    }
}


constructor(manager)
{

    super(manager);

    // Default dots per inch
    this.defaultDPI = 90;

    // Accepted units: 'mm', 'cm', 'in', 'pt', 'pc', 'px'
    this.defaultUnit = 'px';

}

// function load(url, onLoad, onProgress, onError) {
//
//     const scope = this;
//
//     const loader = new FileLoader(scope.manager);
//     loader.setPath(scope.path);
//     loader.setRequestHeader(scope.requestHeader);
//     loader.setWithCredentials(scope.withCredentials);
//     loader.load(url, function (text) {
//
//         try {
//
//             onLoad(scope.parse(text));
//
//         } catch (e) {
//
//             if (onError) {
//
//                 onError(e);
//
//             } else {
//
//                 console.error(e);
//
//             }
//
//             scope.manager.itemError(url);
//
//         }
//
//     }, onProgress, onError);
//
// }

function parse(ctx, text) {

    const scope = this;

    function parseNode(ctx, node, style) {
        if (node.nodeType !== 1) {
            return;
        }
        const transform = getNodeTransform(node);
        let traverseChildNodes = true;
        let path = null;
        switch (node.nodeName) {
            case 'svg':
                break;
            case 'style':
                parseCSSStylesheet(ctx, node);
                break;
            case 'g':
                style = parseStyle(ctx, node, style);
                break;
            case 'path':
                style = parseStyle(ctx, node, style);
                if (node.hasAttribute('d')) {
                    path = parsePathNode(ctx, node);
                }
                break;
            case 'rect':
                style = parseStyle(ctx, node, style);
                path = parseRectNode(ctx, node);
                break;
            case 'polygon':
                style = parseStyle(ctx, node, style);
                path = parsePolygonNode(ctx, node);
                break;
            case 'polyline':
                style = parseStyle(ctx, node, style);
                path = parsePolylineNode(ctx, node);
                break;
            case 'circle':
                style = parseStyle(ctx, node, style);
                path = parseCircleNode(ctx, node);
                break;
            case 'ellipse':
                style = parseStyle(ctx, node, style);
                path = parseEllipseNode(ctx, node);
                break;
            case 'line':
                style = parseStyle(ctx, node, style);
                path = parseLineNode(ctx, node);
                break;
            case 'defs':
                traverseChildNodes = false;
                break;
            case 'use':
                style = parseStyle(ctx, node, style);
                const href = node.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
                const usedNodeId = href.substring(1);
                const usedNode = node.viewportElement.getElementById(usedNodeId);
                if (usedNode) {
                    parseNode(ctx, usedNode, style);
                } else {
                    console.warn('SVGLoader: \'use node\' references non-existent node id: ' + usedNodeId);
                }
                break;
            default:
        }
        if (path) {
            if (style.fill !== undefined && style.fill !== 'none') {
                path.color.setStyle(style.fill);
            }
            transformPath(path, currentTransform);
            paths.push(path);
            path.userData = {node: node, style: style};
        }
        if (traverseChildNodes) {
            const nodes = node.childNodes;
            for (let i = 0; i < nodes.length; i++) {
                parseNode(ctx, nodes[i], style);
            }
        }
        if (transform) {
            transformStack.pop();
            if (transformStack.length > 0) {
                currentTransform.copy(transformStack[transformStack.length - 1]);
            } else {
                currentTransform.identity();
            }
        }
    }

    function parsePathNode(ctx, node) {
        const path = new ShapePath();
        const point = math.vec2();
        const control = math.vec2();
        const firstPoint = math.vec2();
        let isFirstPoint = true;
        let doSetFirstPoint = false;
        const d = node.getAttribute('d');
        const commands = d.match(/[a-df-z][^a-df-z]*/ig);
        for (let i = 0, l = commands.length; i < l; i++) {
            const command = commands[i];
            const type = command.charAt(0);
            const data = command.substr(1).trim();
            if (isFirstPoint === true) {
                doSetFirstPoint = true;
                isFirstPoint = false;
            }
            let numbers;
            switch (type) {
                case 'M':
                    numbers = parseFloats(data);
                    for (let j = 0, jl = numbers.length; j < jl; j += 2) {
                        point[0] = numbers[j + 0];
                        point[2] = numbers[j + 1];
                        control[0] = point[0];
                        control[2] = point[2];
                        if (j === 0) {
                            path.moveTo(point[0], point[2]);
                        } else {
                            path.lineTo(point[0], point[2]);
                        }
                        if (j === 0) {
                            firstPoint.copy(point);
                        }
                    }
                    break;
                case 'H':
                    numbers = parseFloats(data);
                    for (let j = 0, jl = numbers.length; j < jl; j++) {
                        point[0] = numbers[j];
                        control[0] = point[0];
                        control[2] = point[2];
                        path.lineTo(point[0], point[2]);
                        if (j === 0 && doSetFirstPoint === true) {
                            firstPoint.copy(point);
                        }
                    }
                    break;
                case 'V':
                    numbers = parseFloats(data);
                    for (let j = 0, jl = numbers.length; j < jl; j++) {
                        point[2] = numbers[j];
                        control[0] = point[0];
                        control[2] = point[2];
                        path.lineTo(point[0], point[2]);
                        if (j === 0 && doSetFirstPoint === true) {
                            firstPoint.set(point);
                        }
                    }

                    break;

                case 'L':
                    numbers = parseFloats(data);

                    for (let j = 0, jl = numbers.length; j < jl; j += 2) {

                        point[0] = numbers[j + 0];
                        point[2] = numbers[j + 1];
                        control[0] = point[0];
                        control[2] = point[2];
                        path.lineTo(point[0], point[2]);

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 'C':
                    numbers = parseFloats(data);

                    for (let j = 0, jl = numbers.length; j < jl; j += 6) {

                        path.bezierCurveTo(
                            numbers[j + 0],
                            numbers[j + 1],
                            numbers[j + 2],
                            numbers[j + 3],
                            numbers[j + 4],
                            numbers[j + 5]
                        );
                        control[0] = numbers[j + 2];
                        control[2] = numbers[j + 3];
                        point[0] = numbers[j + 4];
                        point[2] = numbers[j + 5];

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 'S':
                    numbers = parseFloats(data);

                    for (let j = 0, jl = numbers.length; j < jl; j += 4) {

                        path.bezierCurveTo(
                            getReflection(point[0], control[0]),
                            getReflection(point[2], control[2]),
                            numbers[j + 0],
                            numbers[j + 1],
                            numbers[j + 2],
                            numbers[j + 3]
                        );
                        control[0] = numbers[j + 0];
                        control[2] = numbers[j + 1];
                        point[0] = numbers[j + 2];
                        point[2] = numbers[j + 3];

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 'Q':
                    numbers = parseFloats(data);

                    for (let j = 0, jl = numbers.length; j < jl; j += 4) {

                        path.quadraticCurveTo(
                            numbers[j + 0],
                            numbers[j + 1],
                            numbers[j + 2],
                            numbers[j + 3]
                        );
                        control[0] = numbers[j + 0];
                        control[2] = numbers[j + 1];
                        point[0] = numbers[j + 2];
                        point[2] = numbers[j + 3];

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 'T':
                    numbers = parseFloats(data);

                    for (let j = 0, jl = numbers.length; j < jl; j += 2) {

                        const rx = getReflection(point[0], control[0]);
                        const ry = getReflection(point[2], control[2]);
                        path.quadraticCurveTo(
                            rx,
                            ry,
                            numbers[j + 0],
                            numbers[j + 1]
                        );
                        control[0] = rx;
                        control[2] = ry;
                        point[0] = numbers[j + 0];
                        point[2] = numbers[j + 1];

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 'A':
                    numbers = parseFloats(data, [3, 4], 7);

                    for (let j = 0, jl = numbers.length; j < jl; j += 7) {

                        // skip command if start point == end point
                        if (numbers[j + 5] == point[0] && numbers[j + 6] == point[2]) continue;

                        const start = point.clone();
                        point[0] = numbers[j + 5];
                        point[2] = numbers[j + 6];
                        control[0] = point[0];
                        control[2] = point[2];
                        parseArcCommand(
                            path, numbers[j], numbers[j + 1], numbers[j + 2], numbers[j + 3], numbers[j + 4], start, point
                        );

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 'm':
                    numbers = parseFloats(data);

                    for (let j = 0, jl = numbers.length; j < jl; j += 2) {

                        point[0] += numbers[j + 0];
                        point[2] += numbers[j + 1];
                        control[0] = point[0];
                        control[2] = point[2];

                        if (j === 0) {

                            path.moveTo(point[0], point[2]);

                        } else {

                            path.lineTo(point[0], point[2]);

                        }

                        if (j === 0) firstPoint.set(point);

                    }

                    break;

                case 'h':
                    numbers = parseFloats(data);

                    for (let j = 0, jl = numbers.length; j < jl; j++) {

                        point[0] += numbers[j];
                        control[0] = point[0];
                        control[2] = point[2];
                        path.lineTo(point[0], point[2]);

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 'v':
                    numbers = parseFloats(data);

                    for (let j = 0, jl = numbers.length; j < jl; j++) {

                        point[2] += numbers[j];
                        control[0] = point[0];
                        control[2] = point[2];
                        path.lineTo(point[0], point[2]);

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 'l':
                    numbers = parseFloats(data);

                    for (let j = 0, jl = numbers.length; j < jl; j += 2) {

                        point[0] += numbers[j + 0];
                        point[2] += numbers[j + 1];
                        control[0] = point[0];
                        control[2] = point[2];
                        path.lineTo(point[0], point[2]);

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 'c':
                    numbers = parseFloats(data);

                    for (let j = 0, jl = numbers.length; j < jl; j += 6) {

                        path.bezierCurveTo(
                            point[0] + numbers[j + 0],
                            point[2] + numbers[j + 1],
                            point[0] + numbers[j + 2],
                            point[2] + numbers[j + 3],
                            point[0] + numbers[j + 4],
                            point[2] + numbers[j + 5]
                        );
                        control[0] = point[0] + numbers[j + 2];
                        control[2] = point[2] + numbers[j + 3];
                        point[0] += numbers[j + 4];
                        point[2] += numbers[j + 5];

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 's':
                    numbers = parseFloats(data);

                    for (let j = 0, jl = numbers.length; j < jl; j += 4) {

                        path.bezierCurveTo(
                            getReflection(point[0], control[0]),
                            getReflection(point[2], control[2]),
                            point[0] + numbers[j + 0],
                            point[2] + numbers[j + 1],
                            point[0] + numbers[j + 2],
                            point[2] + numbers[j + 3]
                        );
                        control[0] = point[0] + numbers[j + 0];
                        control[2] = point[2] + numbers[j + 1];
                        point[0] += numbers[j + 2];
                        point[2] += numbers[j + 3];

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 'q':
                    numbers = parseFloats(data);

                    for (let j = 0, jl = numbers.length; j < jl; j += 4) {

                        path.quadraticCurveTo(
                            point[0] + numbers[j + 0],
                            point[2] + numbers[j + 1],
                            point[0] + numbers[j + 2],
                            point[2] + numbers[j + 3]
                        );
                        control[0] = point[0] + numbers[j + 0];
                        control[2] = point[2] + numbers[j + 1];
                        point[0] += numbers[j + 2];
                        point[2] += numbers[j + 3];

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 't':
                    numbers = parseFloats(data);

                    for (let j = 0, jl = numbers.length; j < jl; j += 2) {

                        const rx = getReflection(point[0], control[0]);
                        const ry = getReflection(point[2], control[2]);
                        path.quadraticCurveTo(
                            rx,
                            ry,
                            point[0] + numbers[j + 0],
                            point[2] + numbers[j + 1]
                        );
                        control[0] = rx;
                        control[2] = ry;
                        point[0] = point[0] + numbers[j + 0];
                        point[2] = point[2] + numbers[j + 1];

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 'a':
                    numbers = parseFloats(data, [3, 4], 7);

                    for (let j = 0, jl = numbers.length; j < jl; j += 7) {

                        // skip command if no displacement
                        if (numbers[j + 5] == 0 && numbers[j + 6] == 0) continue;

                        const start = point.clone();
                        point[0] += numbers[j + 5];
                        point[2] += numbers[j + 6];
                        control[0] = point[0];
                        control[2] = point[2];
                        parseArcCommand(
                            path, numbers[j], numbers[j + 1], numbers[j + 2], numbers[j + 3], numbers[j + 4], start, point
                        );

                        if (j === 0 && doSetFirstPoint === true) firstPoint.set(point);

                    }

                    break;

                case 'Z':
                case 'z':
                    path.currentPath.autoClose = true;

                    if (path.currentPath.curves.length > 0) {

                        // Reset point to beginning of Path
                        point.set(firstPoint);
                        path.currentPath.currentPoint.set(point);
                        isFirstPoint = true;

                    }

                    break;

                default:
                    console.warn(command);

            }

            // console.log( type, parseFloats( data ), parseFloats( data ).length  )

            doSetFirstPoint = false;

        }

        return path;

    }

    function parseCSSStylesheet(node) {

        if (!node.sheet || !node.sheet.cssRules || !node.sheet.cssRules.length) return;

        for (let i = 0; i < node.sheet.cssRules.length; i++) {

            const stylesheet = node.sheet.cssRules[i];

            if (stylesheet.type !== 1) continue;

            const selectorList = stylesheet.selectorText
                .split(/,/gm)
                .filter(Boolean)
                .map(i => i.trim());

            for (let j = 0; j < selectorList.length; j++) {

                // Remove empty rules
                const definitions = Object.fromEntries(
                    Object.entries(stylesheet.style).filter(([, v]) => v !== '')
                );

                stylesheets[selectorList[j]] = Object.assign(
                    stylesheets[selectorList[j]] || {},
                    definitions
                );

            }

        }

    }

    /**
     * https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
     * https://mortoray.com/2017/02/16/rendering-an-svg-elliptical-arc-as-bezier-curves/ Appendix: Endpoint to center arc conversion
     * From
     * rx ry x-axis-rotation large-arc-flag sweep-flag x y
     * To
     * aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation
     */

    function parseArcCommand(path, rx, ry, x_axis_rotation, large_arc_flag, sweep_flag, start, end) {

        if (rx == 0 || ry == 0) {

            // draw a line if either of the radii == 0
            path.lineTo(end[0], end[2]);
            return;

        }

        x_axis_rotation = x_axis_rotation * Math.PI / 180;

        // Ensure radii are positive
        rx = Math.abs(rx);
        ry = Math.abs(ry);

        // Compute (x1', y1')
        const dx2 = (start[0] - end[0]) / 2.0;
        const dy2 = (start[2] - end[2]) / 2.0;
        const x1p = Math.cos(x_axis_rotation) * dx2 + Math.sin(x_axis_rotation) * dy2;
        const y1p = -Math.sin(x_axis_rotation) * dx2 + Math.cos(x_axis_rotation) * dy2;

        // Compute (cx', cy')
        let rxs = rx * rx;
        let rys = ry * ry;
        const x1ps = x1p * x1p;
        const y1ps = y1p * y1p;

        // Ensure radii are large enough
        const cr = x1ps / rxs + y1ps / rys;

        if (cr > 1) {

            // scale up rx,ry equally so cr == 1
            const s = Math.sqrt(cr);
            rx = s * rx;
            ry = s * ry;
            rxs = rx * rx;
            rys = ry * ry;

        }

        const dq = (rxs * y1ps + rys * x1ps);
        const pq = (rxs * rys - dq) / dq;
        let q = Math.sqrt(Math.max(0, pq));
        if (large_arc_flag === sweep_flag) q = -q;
        const cxp = q * rx * y1p / ry;
        const cyp = -q * ry * x1p / rx;

        // Step 3: Compute (cx, cy) from (cx', cy')
        const cx = Math.cos(x_axis_rotation) * cxp - Math.sin(x_axis_rotation) * cyp + (start[0] + end[0]) / 2;
        const cy = Math.sin(x_axis_rotation) * cxp + Math.cos(x_axis_rotation) * cyp + (start[2] + end[2]) / 2;

        // Step 4: Compute θ1 and Δθ
        const theta = svgAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
        const delta = svgAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry) % (Math.PI * 2);

        path.currentPath.absellipse(cx, cy, rx, ry, theta, theta + delta, sweep_flag === 0, x_axis_rotation);

    }

    function svgAngle(ux, uy, vx, vy) {

        const dot = ux * vx + uy * vy;
        const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
        let ang = Math.acos(Math.max(-1, Math.min(1, dot / len))); // floating point precision, slightly over values appear
        if ((ux * vy - uy * vx) < 0) ang = -ang;
        return ang;

    }

    /*
    * According to https://www.w3.org/TR/SVG/shapes.html#RectElementRXAttribute
    * rounded corner should be rendered to elliptical arc, but bezier curve does the job well enough
    */
    function parseRectNode(node) {

        const x = parseFloatWithUnits(node.getAttribute('x') || 0);
        const y = parseFloatWithUnits(node.getAttribute('y') || 0);
        const rx = parseFloatWithUnits(node.getAttribute('rx') || node.getAttribute('ry') || 0);
        const ry = parseFloatWithUnits(node.getAttribute('ry') || node.getAttribute('rx') || 0);
        const w = parseFloatWithUnits(node.getAttribute('width'));
        const h = parseFloatWithUnits(node.getAttribute('height'));

        // Ellipse arc to Bezier approximation Coefficient (Inversed). See:
        // https://spencermortensen.com/articles/bezier-circle/
        const bci = 1 - 0.551915024494;

        const path = new ShapePath();

        // top left
        path.moveTo(x + rx, y);

        // top right
        path.lineTo(x + w - rx, y);
        if (rx !== 0 || ry !== 0) {

            path.bezierCurveTo(
                x + w - rx * bci,
                y,
                x + w,
                y + ry * bci,
                x + w,
                y + ry
            );

        }

        // bottom right
        path.lineTo(x + w, y + h - ry);
        if (rx !== 0 || ry !== 0) {

            path.bezierCurveTo(
                x + w,
                y + h - ry * bci,
                x + w - rx * bci,
                y + h,
                x + w - rx,
                y + h
            );

        }

        // bottom left
        path.lineTo(x + rx, y + h);
        if (rx !== 0 || ry !== 0) {

            path.bezierCurveTo(
                x + rx * bci,
                y + h,
                x,
                y + h - ry * bci,
                x,
                y + h - ry
            );

        }

        // back to top left
        path.lineTo(x, y + ry);
        if (rx !== 0 || ry !== 0) {

            path.bezierCurveTo(x, y + ry * bci, x + rx * bci, y, x + rx, y);

        }

        return path;

    }

    function parsePolygonNode(node) {

        function iterator(match, a, b) {

            const x = parseFloatWithUnits(a);
            const y = parseFloatWithUnits(b);

            if (index === 0) {

                path.moveTo(x, y);

            } else {

                path.lineTo(x, y);

            }

            index++;

        }

        const regex = /(-?[\d\.?]+)[,|\s](-?[\d\.?]+)/g;

        const path = new ShapePath();

        let index = 0;

        node.getAttribute('points').replace(regex, iterator);

        path.currentPath.autoClose = true;

        return path;

    }

    function parsePolylineNode(node) {

        function iterator(match, a, b) {

            const x = parseFloatWithUnits(a);
            const y = parseFloatWithUnits(b);

            if (index === 0) {

                path.moveTo(x, y);

            } else {

                path.lineTo(x, y);

            }

            index++;

        }

        const regex = /(-?[\d\.?]+)[,|\s](-?[\d\.?]+)/g;

        const path = new ShapePath();

        let index = 0;

        node.getAttribute('points').replace(regex, iterator);

        path.currentPath.autoClose = false;

        return path;

    }

    function parseCircleNode(node) {

        const x = parseFloatWithUnits(node.getAttribute('cx') || 0);
        const y = parseFloatWithUnits(node.getAttribute('cy') || 0);
        const r = parseFloatWithUnits(node.getAttribute('r') || 0);

        const subpath = new Path();
        subpath.absarc(x, y, r, 0, Math.PI * 2);

        const path = new ShapePath();
        path.subPaths.push(subpath);

        return path;

    }

    function parseEllipseNode(node) {

        const x = parseFloatWithUnits(node.getAttribute('cx') || 0);
        const y = parseFloatWithUnits(node.getAttribute('cy') || 0);
        const rx = parseFloatWithUnits(node.getAttribute('rx') || 0);
        const ry = parseFloatWithUnits(node.getAttribute('ry') || 0);

        const subpath = new Path();
        subpath.absellipse(x, y, rx, ry, 0, Math.PI * 2);

        const path = new ShapePath();
        path.subPaths.push(subpath);

        return path;

    }

    function parseLineNode(node) {

        const x1 = parseFloatWithUnits(node.getAttribute('x1') || 0);
        const y1 = parseFloatWithUnits(node.getAttribute('y1') || 0);
        const x2 = parseFloatWithUnits(node.getAttribute('x2') || 0);
        const y2 = parseFloatWithUnits(node.getAttribute('y2') || 0);

        const path = new ShapePath();
        path.moveTo(x1, y1);
        path.lineTo(x2, y2);
        path.currentPath.autoClose = false;

        return path;

    }

    //

    function parseStyle(node, style) {

        style = Object.assign({}, style); // clone style

        let stylesheetStyles = {};

        if (node.hasAttribute('class')) {

            const classSelectors = node.getAttribute('class')
                .split(/\s/)
                .filter(Boolean)
                .map(i => i.trim());

            for (let i = 0; i < classSelectors.length; i++) {

                stylesheetStyles = Object.assign(stylesheetStyles, stylesheets['.' + classSelectors[i]]);

            }

        }

        if (node.hasAttribute('id')) {

            stylesheetStyles = Object.assign(stylesheetStyles, stylesheets['#' + node.getAttribute('id')]);

        }

        function addStyle(svgName, jsName, adjustFunction) {

            if (adjustFunction === undefined) adjustFunction = function copy(v) {

                if (v.startsWith('url')) console.warn('SVGLoader: url access in attributes is not implemented.');

                return v;

            };

            if (node.hasAttribute(svgName)) style[jsName] = adjustFunction(node.getAttribute(svgName));
            if (stylesheetStyles[svgName]) style[jsName] = adjustFunction(stylesheetStyles[svgName]);
            if (node.style && node.style[svgName] !== '') style[jsName] = adjustFunction(node.style[svgName]);

        }

        function clamp(v) {

            return Math.max(0, Math.min(1, parseFloatWithUnits(v)));

        }

        function positive(v) {

            return Math.max(0, parseFloatWithUnits(v));

        }

        addStyle('fill', 'fill');
        addStyle('fill-opacity', 'fillOpacity', clamp);
        addStyle('fill-rule', 'fillRule');
        addStyle('opacity', 'opacity', clamp);
        addStyle('stroke', 'stroke');
        addStyle('stroke-opacity', 'strokeOpacity', clamp);
        addStyle('stroke-width', 'strokeWidth', positive);
        addStyle('stroke-linejoin', 'strokeLineJoin');
        addStyle('stroke-linecap', 'strokeLineCap');
        addStyle('stroke-miterlimit', 'strokeMiterLimit', positive);
        addStyle('visibility', 'visibility');

        return style;

    }

    // http://www.w3.org/TR/SVG11/implnote.html#PathElementImplementationNotes

    function getReflection(a, b) {

        return a - (b - a);

    }

    // from https://github.com/ppvg/svg-numbers (MIT License)

    function parseFloats(input, flags, stride) {

        if (typeof input !== 'string') {

            throw new TypeError('Invalid input: ' + typeof input);

        }

        // Character groups
        const RE = {
            SEPARATOR: /[ \t\r\n\,.\-+]/,
            WHITESPACE: /[ \t\r\n]/,
            DIGIT: /[\d]/,
            SIGN: /[-+]/,
            POINT: /\./,
            COMMA: /,/,
            EXP: /e/i,
            FLAGS: /[01]/
        };

        // States
        const SEP = 0;
        const INT = 1;
        const FLOAT = 2;
        const EXP = 3;

        let state = SEP;
        let seenComma = true;
        let number = '', exponent = '';
        const result = [];

        function throwSyntaxError(current, i, partial) {

            const error = new SyntaxError('Unexpected character "' + current + '" at index ' + i + '.');
            error.partial = partial;
            throw error;

        }

        function newNumber() {

            if (number !== '') {

                if (exponent === '') result.push(Number(number));
                else result.push(Number(number) * Math.pow(10, Number(exponent)));

            }

            number = '';
            exponent = '';

        }

        let current;
        const length = input.length;

        for (let i = 0; i < length; i++) {

            current = input[i];

            // check for flags
            if (Array.isArray(flags) && flags.includes(result.length % stride) && RE.FLAGS.test(current)) {

                state = INT;
                number = current;
                newNumber();
                continue;

            }

            // parse until next number
            if (state === SEP) {

                // eat whitespace
                if (RE.WHITESPACE.test(current)) {

                    continue;

                }

                // start new number
                if (RE.DIGIT.test(current) || RE.SIGN.test(current)) {

                    state = INT;
                    number = current;
                    continue;

                }

                if (RE.POINT.test(current)) {

                    state = FLOAT;
                    number = current;
                    continue;

                }

                // throw on double commas (e.g. "1, , 2")
                if (RE.COMMA.test(current)) {

                    if (seenComma) {

                        throwSyntaxError(current, i, result);

                    }

                    seenComma = true;

                }

            }

            // parse integer part
            if (state === INT) {

                if (RE.DIGIT.test(current)) {

                    number += current;
                    continue;

                }

                if (RE.POINT.test(current)) {

                    number += current;
                    state = FLOAT;
                    continue;

                }

                if (RE.EXP.test(current)) {

                    state = EXP;
                    continue;

                }

                // throw on double signs ("-+1"), but not on sign as separator ("-1-2")
                if (RE.SIGN.test(current)
                    && number.length === 1
                    && RE.SIGN.test(number[0])) {

                    throwSyntaxError(current, i, result);

                }

            }

            // parse decimal part
            if (state === FLOAT) {

                if (RE.DIGIT.test(current)) {

                    number += current;
                    continue;

                }

                if (RE.EXP.test(current)) {

                    state = EXP;
                    continue;

                }

                // throw on double decimal points (e.g. "1..2")
                if (RE.POINT.test(current) && number[number.length - 1] === '.') {

                    throwSyntaxError(current, i, result);

                }

            }

            // parse exponent part
            if (state === EXP) {

                if (RE.DIGIT.test(current)) {

                    exponent += current;
                    continue;

                }

                if (RE.SIGN.test(current)) {

                    if (exponent === '') {

                        exponent += current;
                        continue;

                    }

                    if (exponent.length === 1 && RE.SIGN.test(exponent)) {

                        throwSyntaxError(current, i, result);

                    }

                }

            }


            // end of number
            if (RE.WHITESPACE.test(current)) {

                newNumber();
                state = SEP;
                seenComma = false;

            } else if (RE.COMMA.test(current)) {

                newNumber();
                state = SEP;
                seenComma = true;

            } else if (RE.SIGN.test(current)) {

                newNumber();
                state = INT;
                number = current;

            } else if (RE.POINT.test(current)) {

                newNumber();
                state = FLOAT;
                number = current;

            } else {

                throwSyntaxError(current, i, result);

            }

        }

        // add the last number found (if any)
        newNumber();

        return result;

    }

    // Units

    const units = ['mm', 'cm', 'in', 'pt', 'pc', 'px'];

    // Conversion: [ fromUnit ][ toUnit ] (-1 means dpi dependent)
    const unitConversion = {

        'mm': {
            'mm': 1,
            'cm': 0.1,
            'in': 1 / 25.4,
            'pt': 72 / 25.4,
            'pc': 6 / 25.4,
            'px': -1
        },
        'cm': {
            'mm': 10,
            'cm': 1,
            'in': 1 / 2.54,
            'pt': 72 / 2.54,
            'pc': 6 / 2.54,
            'px': -1
        },
        'in': {
            'mm': 25.4,
            'cm': 2.54,
            'in': 1,
            'pt': 72,
            'pc': 6,
            'px': -1
        },
        'pt': {
            'mm': 25.4 / 72,
            'cm': 2.54 / 72,
            'in': 1 / 72,
            'pt': 1,
            'pc': 6 / 72,
            'px': -1
        },
        'pc': {
            'mm': 25.4 / 6,
            'cm': 2.54 / 6,
            'in': 1 / 6,
            'pt': 72 / 6,
            'pc': 1,
            'px': -1
        },
        'px': {
            'px': 1
        }

    };

    function parseFloatWithUnits(string) {

        let theUnit = 'px';

        if (typeof string === 'string' || string instanceof String) {

            for (let i = 0, n = units.length; i < n; i++) {

                const u = units[i];

                if (string.endsWith(u)) {

                    theUnit = u;
                    string = string.substring(0, string.length - u.length);
                    break;

                }

            }

        }

        let scale = undefined;

        if (theUnit === 'px' && scope.defaultUnit !== 'px') {

            // Conversion scale from  pixels to inches, then to default units

            scale = unitConversion['in'][scope.defaultUnit] / scope.defaultDPI;

        } else {

            scale = unitConversion[theUnit][scope.defaultUnit];

            if (scale < 0) {

                // Conversion scale to pixels

                scale = unitConversion[theUnit]['in'] * scope.defaultDPI;

            }

        }

        return scale * parseFloat(string);

    }

    // Transforms

    function getNodeTransform(node) {

        if (!(node.hasAttribute('transform') || (node.nodeName === 'use' && (node.hasAttribute('x') || node.hasAttribute('y'))))) {

            return null;

        }

        const transform = parseNodeTransform(node);

        if (transformStack.length > 0) {

            transform.premultiply(transformStack[transformStack.length - 1]);

        }

        currentTransform.set(transform);
        transformStack.push(transform);

        return transform;

    }

    function parseNodeTransform(node) {

        const transform = math.mat3();
        const currentTransform = tempTransform0;

        if (node.nodeName === 'use' && (node.hasAttribute('x') || node.hasAttribute('y'))) {

            const tx = parseFloatWithUnits(node.getAttribute('x'));
            const ty = parseFloatWithUnits(node.getAttribute('y'));

            transform.translate(tx, ty);

        }

        if (node.hasAttribute('transform')) {

            const transformsTexts = node.getAttribute('transform').split(')');

            for (let tIndex = transformsTexts.length - 1; tIndex >= 0; tIndex--) {

                const transformText = transformsTexts[tIndex].trim();

                if (transformText === '') continue;

                const openParPos = transformText.indexOf('(');
                const closeParPos = transformText.length;

                if (openParPos > 0 && openParPos < closeParPos) {

                    const transformType = transformText.substr(0, openParPos);

                    const array = parseFloats(transformText.substr(openParPos + 1, closeParPos - openParPos - 1));

                    currentTransform.identity();

                    switch (transformType) {

                        case 'translate':

                            if (array.length >= 1) {

                                const tx = array[0];
                                let ty = tx;

                                if (array.length >= 2) {

                                    ty = array[1];

                                }

                                currentTransform.translate(tx, ty);

                            }

                            break;

                        case 'rotate':

                            if (array.length >= 1) {

                                let angle = 0;
                                let cx = 0;
                                let cy = 0;

                                // Angle
                                angle = -array[0] * Math.PI / 180;

                                if (array.length >= 3) {

                                    // Center x, y
                                    cx = array[1];
                                    cy = array[2];

                                }

                                // Rotate around center (cx, cy)
                                tempTransform1.identity().translate(-cx, -cy);
                                tempTransform2.identity().rotate(angle);
                                tempTransform3.multiplyMatrices(tempTransform2, tempTransform1);
                                tempTransform1.identity().translate(cx, cy);
                                currentTransform.multiplyMatrices(tempTransform1, tempTransform3);

                            }

                            break;

                        case 'scale':

                            if (array.length >= 1) {

                                const scaleX = array[0];
                                let scaleY = scaleX;

                                if (array.length >= 2) {

                                    scaleY = array[1];

                                }

                                currentTransform.scale(scaleX, scaleY);

                            }

                            break;

                        case 'skewX':

                            if (array.length === 1) {

                                currentTransform.set(
                                    1, Math.tan(array[0] * Math.PI / 180), 0,
                                    0, 1, 0,
                                    0, 0, 1
                                );

                            }

                            break;

                        case 'skewY':

                            if (array.length === 1) {

                                currentTransform.set(
                                    1, 0, 0,
                                    Math.tan(array[0] * Math.PI / 180), 1, 0,
                                    0, 0, 1
                                );

                            }

                            break;

                        case 'matrix':

                            if (array.length === 6) {

                                currentTransform.set(
                                    array[0], array[2], array[4],
                                    array[1], array[3], array[5],
                                    0, 0, 1
                                );

                            }

                            break;

                    }

                }

                transform.premultiply(currentTransform);

            }

        }

        return transform;

    }

    function transformPath(path, m) {

        function transfVec2(v2) {

            tempV3.set(v2[0], v2[2], 1).applyMatrix3(m);

            v2.set(tempV3[0], tempV3[2]);

        }

        const isRotated = isTransformRotated(m);

        const subPaths = path.subPaths;

        for (let i = 0, n = subPaths.length; i < n; i++) {

            const subPath = subPaths[i];
            const curves = subPath.curves;

            for (let j = 0; j < curves.length; j++) {

                const curve = curves[j];

                if (curve.isLineCurve) {

                    transfVec2(curve.v1);
                    transfVec2(curve.v2);

                } else if (curve.isCubicBezierCurve) {

                    transfVec2(curve.v0);
                    transfVec2(curve.v1);
                    transfVec2(curve.v2);
                    transfVec2(curve.v3);

                } else if (curve.isQuadraticBezierCurve) {

                    transfVec2(curve.v0);
                    transfVec2(curve.v1);
                    transfVec2(curve.v2);

                } else if (curve.isEllipseCurve) {

                    if (isRotated) {

                        console.warn('SVGLoader: Elliptic arc or ellipse rotation or skewing is not implemented.');

                    }

                    tempV2.set(curve.aX, curve.aY);
                    transfVec2(tempV2);
                    curve.aX = tempV2[0];
                    curve.aY = tempV2[2];

                    curve.xRadius *= getTransformScaleX(m);
                    curve.yRadius *= getTransformScaleY(m);

                }

            }

        }

    }

    function isTransformRotated(m) {
        return m[1] !== 0 || m[3] !== 0;
    }

    function getTransformScaleX(m) {
        return Math.sqrt(m[0] * m[0] + m[1] * m[1]);

    }

    function getTransformScaleY(m) {
        return Math.sqrt(m[3] * m[3] + m[4] * m[4]);
    }

    //

    const paths = [];
    const stylesheets = {};

    const transformStack = [];

    const tempTransform0 = math.mat3();
    const tempTransform1 = math.mat3();
    const tempTransform2 = math.mat3();
    const tempTransform3 = math.mat3();
    const tempV2 = math.vec2();
    const tempV3 = math.vec3();

    const currentTransform = math.mat3();

    const xml = new DOMParser().parseFromString(text, 'image/svg+xml'); // application/xml

    parseNode(xml.documentElement, {
        fill: '#000',
        fillOpacity: 1,
        strokeOpacity: 1,
        strokeWidth: 1,
        strokeLineJoin: 'miter',
        strokeLineCap: 'butt',
        strokeMiterLimit: 4
    });

    const data = {paths: paths, xml: xml.documentElement};

    // console.log( paths );
    return data;

}

function createShapes(shapePath) {

    // Param shapePath: a shapepath as returned by the parse function of this class
    // Returns Shape object

    const BIGNUMBER = 999999999;

    const IntersectionLocationType = {
        ORIGIN: 0,
        DESTINATION: 1,
        BETWEEN: 2,
        LEFT: 3,
        RIGHT: 4,
        BEHIND: 5,
        BEYOND: 6
    };

    const classifyResult = {
        loc: IntersectionLocationType.ORIGIN,
        t: 0
    };

    function findEdgeIntersection(a0, a1, b0, b1) {
        const x1 = a0[0];
        const x2 = a1[0];
        const x3 = b0[0];
        const x4 = b1[0];
        const y1 = a0[2];
        const y2 = a1[2];
        const y3 = b0[2];
        const y4 = b1[2];
        const nom1 = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
        const nom2 = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);
        const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        const t1 = nom1 / denom;
        const t2 = nom2 / denom;
        if (((denom === 0) && (nom1 !== 0)) || (t1 <= 0) || (t1 >= 1) || (t2 < 0) || (t2 > 1)) {
            //1. lines are parallel or edges don't intersect
            return null;
        } else if ((nom1 === 0) && (denom === 0)) {
            //2. lines are colinear
            //check if endpoints of edge2 (b0-b1) lies on edge1 (a0-a1)
            for (let i = 0; i < 2; i++) {
                classifyPoint(i === 0 ? b0 : b1, a0, a1);
                //find position of this endpoints relatively to edge1
                if (classifyResult.loc == IntersectionLocationType.ORIGIN) {
                    const point = (i === 0 ? b0 : b1);
                    return {x: point[0], y: point[2], t: classifyResult.t};
                } else if (classifyResult.loc == IntersectionLocationType.BETWEEN) {
                    const x = +((x1 + classifyResult.t * (x2 - x1)).toPrecision(10));
                    const y = +((y1 + classifyResult.t * (y2 - y1)).toPrecision(10));
                    return {x: x, y: y, t: classifyResult.t,};
                }
            }
            return null;
        } else {
            //3. edges intersect
            for (let i = 0; i < 2; i++) {
                classifyPoint(i === 0 ? b0 : b1, a0, a1);
                if (classifyResult.loc == IntersectionLocationType.ORIGIN) {
                    const point = (i === 0 ? b0 : b1);
                    return {x: point[0], y: point[2], t: classifyResult.t};
                }
            }
            const x = +((x1 + t1 * (x2 - x1)).toPrecision(10));
            const y = +((y1 + t1 * (y2 - y1)).toPrecision(10));
            return {x: x, y: y, t: t1};
        }
    }

    function classifyPoint(p, edgeStart, edgeEnd) {
        const ax = edgeEnd[0] - edgeStart[0];
        const ay = edgeEnd[2] - edgeStart[2];
        const bx = p[0] - edgeStart[0];
        const by = p[2] - edgeStart[2];
        const sa = ax * by - bx * ay;
        if ((p[0] === edgeStart[0]) && (p[2] === edgeStart[2])) {
            classifyResult.loc = IntersectionLocationType.ORIGIN;
            classifyResult.t = 0;
            return;
        }
        if ((p[0] === edgeEnd[0]) && (p[2] === edgeEnd[2])) {
            classifyResult.loc = IntersectionLocationType.DESTINATION;
            classifyResult.t = 1;
            return;
        }
        if (sa < -Number.EPSILON) {
            classifyResult.loc = IntersectionLocationType.LEFT;
            return;
        }
        if (sa > Number.EPSILON) {
            classifyResult.loc = IntersectionLocationType.RIGHT;
            return;
        }
        if (((ax * bx) < 0) || ((ay * by) < 0)) {
            classifyResult.loc = IntersectionLocationType.BEHIND;
            return;
        }
        if ((Math.sqrt(ax * ax + ay * ay)) < (Math.sqrt(bx * bx + by * by))) {
            classifyResult.loc = IntersectionLocationType.BEYOND;
            return;
        }
        let t;
        if (ax !== 0) {
            t = bx / ax;
        } else {
            t = by / ay;
        }
        classifyResult.loc = IntersectionLocationType.BETWEEN;
        classifyResult.t = t;
    }

    function getIntersections(path1, path2) {
        const intersectionsRaw = [];
        const intersections = [];
        for (let index = 1; index < path1.length; index++) {
            const path1EdgeStart = path1[index - 1];
            const path1EdgeEnd = path1[index];
            for (let index2 = 1; index2 < path2.length; index2++) {
                const path2EdgeStart = path2[index2 - 1];
                const path2EdgeEnd = path2[index2];
                const intersection = findEdgeIntersection(path1EdgeStart, path1EdgeEnd, path2EdgeStart, path2EdgeEnd);
                if (intersection !== null && intersectionsRaw.find(i => i.t <= intersection.t + Number.EPSILON && i.t >= intersection.t - Number.EPSILON) === undefined) {
                    intersectionsRaw.push(intersection);
                    intersections.push(new Vector2(intersection[0], intersection[2]));
                }
            }
        }
        return intersections;
    }

    function getScanlineIntersections(scanline, boundingBox, paths) {
        const center = math.vec2();
        boundingBox.getCenter(center);
        const allIntersections = [];
        paths.forEach(path => {
            // check if the center of the bounding box is in the bounding box of the paths.
            // this is a pruning method to limit the search of intersections in paths that can't envelop of the current path.
            // if a path envelops another path. The center of that oter path, has to be inside the bounding box of the enveloping path.
            if (path.boundingBox.containsPoint(center)) {
                const intersections = getIntersections(scanline, path.points);
                intersections.forEach(p => {
                    allIntersections.push({identifier: path.identifier, isCW: path.isCW, point: p});
                });
            }
        });
        allIntersections.sort((i1, i2) => {
            return i1.point[0] - i2.point[0];
        });
        return allIntersections;
    }

    function isHoleTo(simplePath, allPaths, scanlineMinX, scanlineMaxX, _fillRule) {
        if (_fillRule === null || _fillRule === undefined || _fillRule === '') {
            _fillRule = 'nonzero';
        }
        const centerBoundingBox = math.vec2();
        simplePath.boundingBox.getCenter(centerBoundingBox);
        const scanline = [new Vector2(scanlineMinX, centerBoundingBox[2]), new Vector2(scanlineMaxX, centerBoundingBox[2])];
        const scanlineIntersections = getScanlineIntersections(scanline, simplePath.boundingBox, allPaths);
        scanlineIntersections.sort((i1, i2) => {
            return i1.point[0] - i2.point[0];
        });
        const baseIntersections = [];
        const otherIntersections = [];
        scanlineIntersections.forEach(i => {
            if (i.identifier === simplePath.identifier) {
                baseIntersections.push(i);
            } else {
                otherIntersections.push(i);
            }
        });
        const firstXOfPath = baseIntersections[0].point[0];
        // build up the path hierarchy
        const stack = [];
        let i = 0;
        while (i < otherIntersections.length && otherIntersections[i].point[0] < firstXOfPath) {
            if (stack.length > 0 && stack[stack.length - 1] === otherIntersections[i].identifier) {
                stack.pop();
            } else {
                stack.push(otherIntersections[i].identifier);
            }
            i++;
        }
        stack.push(simplePath.identifier);
        if (_fillRule === 'evenodd') {
            const isHole = stack.length % 2 === 0 ? true : false;
            const isHoleFor = stack[stack.length - 2];
            return {identifier: simplePath.identifier, isHole: isHole, for: isHoleFor};
        } else if (_fillRule === 'nonzero') {
            // check if path is a hole by counting the amount of paths with alternating rotations it has to cross.
            let isHole = true;
            let isHoleFor = null;
            let lastCWValue = null;
            for (let i = 0; i < stack.length; i++) {
                const identifier = stack[i];
                if (isHole) {
                    lastCWValue = allPaths[identifier].isCW;
                    isHole = false;
                    isHoleFor = identifier;
                } else if (lastCWValue !== allPaths[identifier].isCW) {
                    lastCWValue = allPaths[identifier].isCW;
                    isHole = true;
                }
            }
            return {identifier: simplePath.identifier, isHole: isHole, for: isHoleFor};
        } else {
            console.warn('fill-rule: "' + _fillRule + '" is currently not implemented.');
        }
    }

    // check for self intersecting paths
    // TODO
    // check intersecting paths
    // TODO
    // prepare paths for hole detection
    let identifier = 0;
    let scanlineMinX = BIGNUMBER;
    let scanlineMaxX = -BIGNUMBER;
    let simplePaths = shapePath.subPaths.map(p => {
        const points = p.getPoints();
        let maxY = -BIGNUMBER;
        let minY = BIGNUMBER;
        let maxX = -BIGNUMBER;
        let minX = BIGNUMBER;
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (p[2] > maxY) {
                maxY = p[2];
            }
            if (p[2] < minY) {
                minY = p[2];
            }
            if (p[0] > maxX) {
                maxX = p[0];
            }
            if (p[0] < minX) {
                minX = p[0];
            }
        }
        if (scanlineMaxX <= maxX) {
            scanlineMaxX = maxX + 1;
        }
        if (scanlineMinX >= minX) {
            scanlineMinX = minX - 1;
        }
        return {
            curves: p.curves,
            points: points,
            isCW: ShapeUtils.isClockWise(points),
            identifier: identifier++,
            boundingBox: new Box2(new Vector2(minX, minY), new Vector2(maxX, maxY))
        };
    });
    simplePaths = simplePaths.filter(sp => sp.points.length > 1);
    // check if path is solid or a hole
    const isAHole = simplePaths.map(p => isHoleTo(p, simplePaths, scanlineMinX, scanlineMaxX, shapePath.userData.style.fillRule));
    const shapesToReturn = [];
    simplePaths.forEach(p => {
        const amIAHole = isAHole[p.identifier];
        if (!amIAHole.isHole) {
            const shape = new Shape();
            shape.curves = p.curves;
            const holes = isAHole.filter(h => h.isHole && h.for === p.identifier);
            holes.forEach(h => {
                const hole = simplePaths[h.identifier];
                const path = new Path();
                path.curves = hole.curves;
                shape.holes.push(path);
            });
            shapesToReturn.push(shape);
        }
    });
    return shapesToReturn;
}

function getStrokeStyle(width, color, lineJoin, lineCap, miterLimit) {
    // Param width: Stroke width
    // Param color: As returned by THREE.Color.getStyle()
    // Param lineJoin: One of "round", "bevel", "miter" or "miter-limit"
    // Param lineCap: One of "round", "square" or "butt"
    // Param miterLimit: Maximum join length, in multiples of the "width" parameter (join is truncated if it exceeds that distance)
    // Returns style object
    width = width !== undefined ? width : 1;
    color = color !== undefined ? color : '#000';
    lineJoin = lineJoin !== undefined ? lineJoin : 'miter';
    lineCap = lineCap !== undefined ? lineCap : 'butt';
    miterLimit = miterLimit !== undefined ? miterLimit : 4;
    return {
        strokeColor: color,
        strokeWidth: width,
        strokeLineJoin: lineJoin,
        strokeLineCap: lineCap,
        strokeMiterLimit: miterLimit
    };
}

function pointsToStroke(points, style, arcDivisions, minDistance) {
    // Generates a stroke with some witdh around the given path.
    // The path can be open or closed (last point equals to first point)
    // Param points: Array of Vector2D (the path). Minimum 2 points.
    // Param style: Object with SVG properties as returned by SVGLoader.getStrokeStyle(), or SVGLoader.parse() in the path.userData.style object
    // Params arcDivisions: Arc divisions for round joins and endcaps. (Optional)
    // Param minDistance: Points closer to this distance will be merged. (Optional)
    // Returns BufferGeometry with stroke triangles (In plane z = 0). UV coordinates are generated ('u' along path. 'v' across it, from left to right)
    const vertices = [];
    const normals = [];
    const uvs = [];
    if (SVGLoader.pointsToStrokeWithBuffers(points, style, arcDivisions, minDistance, vertices, normals, uvs) === 0) {
        return null;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    return geometry;
}

function pointsToStrokeWithBuffers(points, style, arcDivisions, minDistance, vertices, normals, uvs, vertexOffset) {

    // This function can be called to update existing arrays or buffers.
    // Accepts same parameters as pointsToStroke, plus the buffers and optional offset.
    // Param vertexOffset: Offset vertices to start writing in the buffers (3 elements/vertex for vertices and normals, and 2 elements/vertex for uvs)
    // Returns number of written vertices / normals / uvs pairs
    // if 'vertices' parameter is undefined no triangles will be generated, but the returned vertices count will still be valid (useful to preallocate the buffers)
    // 'normals' and 'uvs' buffers are optional

    const tempV2_1 = math.vec2();
    const tempV2_2 = math.vec2();
    const tempV2_3 = math.vec2();
    const tempV2_4 = math.vec2();
    const tempV2_5 = math.vec2();
    const tempV2_6 = math.vec2();
    const tempV2_7 = math.vec2();
    const lastPointL = math.vec2();
    const lastPointR = math.vec2();
    const point0L = math.vec2();
    const point0R = math.vec2();
    const currentPointL = math.vec2();
    const currentPointR = math.vec2();
    const nextPointL = math.vec2();
    const nextPointR = math.vec2();
    const innerPoint = math.vec2();
    const outerPoint = math.vec2();

    arcDivisions = arcDivisions !== undefined ? arcDivisions : 12;
    minDistance = minDistance !== undefined ? minDistance : 0.001;
    vertexOffset = vertexOffset !== undefined ? vertexOffset : 0;

    // First ensure there are no duplicated points
    points = removeDuplicatedPoints(points);

    const numPoints = points.length;

    if (numPoints < 2) {
        return 0;
    }

    const isClosed = points[0].equals(points[numPoints - 1]);

    let currentPoint;
    let previousPoint = points[0];
    let nextPoint;

    const strokeWidth2 = style.strokeWidth / 2;

    const deltaU = 1 / (numPoints - 1);
    let u0 = 0, u1;

    let innerSideModified;
    let joinIsOnLeftSide;
    let isMiter;
    let initialJoinIsOnLeftSide = false;

    let numVertices = 0;
    let currentCoordinate = vertexOffset * 3;
    let currentCoordinateUV = vertexOffset * 2;

    // Get initial left and right stroke points
    getNormal(points[0], points[1], tempV2_1).multiplyScalar(strokeWidth2);
    lastPointL.set(points[0]).sub(tempV2_1);
    lastPointR.set(points[0]).add(tempV2_1);
    point0L.set(lastPointL);
    point0R.set(lastPointR);

    for (let iPoint = 1; iPoint < numPoints; iPoint++) {

        currentPoint = points[iPoint];

        // Get next point
        if (iPoint === numPoints - 1) {

            if (isClosed) {

                // Skip duplicated initial point
                nextPoint = points[1];

            } else nextPoint = undefined;

        } else {

            nextPoint = points[iPoint + 1];

        }

        // Normal of previous segment in tempV2_1
        const normal1 = tempV2_1;
        getNormal(previousPoint, currentPoint, normal1);

        tempV2_3.set(normal1).multiplyScalar(strokeWidth2);
        currentPointL.set(currentPoint).sub(tempV2_3);
        currentPointR.set(currentPoint).add(tempV2_3);

        u1 = u0 + deltaU;

        innerSideModified = false;

        if (nextPoint !== undefined) {

            // Normal of next segment in tempV2_2
            getNormal(currentPoint, nextPoint, tempV2_2);

            tempV2_3.set(tempV2_2).multiplyScalar(strokeWidth2);
            nextPointL.set(currentPoint).sub(tempV2_3);
            nextPointR.set(currentPoint).add(tempV2_3);

            joinIsOnLeftSide = true;
            tempV2_3.subVectors(nextPoint, previousPoint);
            if (normal1.dot(tempV2_3) < 0) {

                joinIsOnLeftSide = false;

            }

            if (iPoint === 1) initialJoinIsOnLeftSide = joinIsOnLeftSide;

            tempV2_3.subVectors(nextPoint, currentPoint);
            tempV2_3.normalize();
            const dot = Math.abs(normal1.dot(tempV2_3));

            // If path is straight, don't create join
            if (dot !== 0) {

                // Compute inner and outer segment intersections
                const miterSide = strokeWidth2 / dot;
                tempV2_3.multiplyScalar(-miterSide);
                tempV2_4.subVectors(currentPoint, previousPoint);
                tempV2_5.set(tempV2_4).setLength(miterSide).add(tempV2_3);
                innerPoint.set(tempV2_5).negate();
                const miterLength2 = tempV2_5.length();
                const segmentLengthPrev = tempV2_4.length();
                tempV2_4.divideScalar(segmentLengthPrev);
                tempV2_6.subVectors(nextPoint, currentPoint);
                const segmentLengthNext = tempV2_6.length();
                tempV2_6.divideScalar(segmentLengthNext);
                // Check that previous and next segments doesn't overlap with the innerPoint of intersection
                if (tempV2_4.dot(innerPoint) < segmentLengthPrev && tempV2_6.dot(innerPoint) < segmentLengthNext) {

                    innerSideModified = true;

                }

                outerPoint.set(tempV2_5).add(currentPoint);
                innerPoint.add(currentPoint);

                isMiter = false;

                if (innerSideModified) {

                    if (joinIsOnLeftSide) {

                        nextPointR.set(innerPoint);
                        currentPointR.set(innerPoint);

                    } else {

                        nextPointL.set(innerPoint);
                        currentPointL.set(innerPoint);

                    }

                } else {

                    // The segment triangles are generated here if there was overlapping

                    makeSegmentTriangles();

                }

                switch (style.strokeLineJoin) {

                    case 'bevel':

                        makeSegmentWithBevelJoin(joinIsOnLeftSide, innerSideModified, u1);

                        break;

                    case 'round':

                        // Segment triangles

                        createSegmentTrianglesWithMiddleSection(joinIsOnLeftSide, innerSideModified);

                        // Join triangles

                        if (joinIsOnLeftSide) {

                            makeCircularSector(currentPoint, currentPointL, nextPointL, u1, 0);

                        } else {

                            makeCircularSector(currentPoint, nextPointR, currentPointR, u1, 1);

                        }

                        break;

                    case 'miter':
                    case 'miter-clip':
                    default:

                        const miterFraction = (strokeWidth2 * style.strokeMiterLimit) / miterLength2;

                        if (miterFraction < 1) {

                            // The join miter length exceeds the miter limit

                            if (style.strokeLineJoin !== 'miter-clip') {

                                makeSegmentWithBevelJoin(joinIsOnLeftSide, innerSideModified, u1);
                                break;

                            } else {

                                // Segment triangles

                                createSegmentTrianglesWithMiddleSection(joinIsOnLeftSide, innerSideModified);

                                // Miter-clip join triangles

                                if (joinIsOnLeftSide) {

                                    tempV2_6.subVectors(outerPoint, currentPointL).multiplyScalar(miterFraction).add(currentPointL);
                                    tempV2_7.subVectors(outerPoint, nextPointL).multiplyScalar(miterFraction).add(nextPointL);

                                    addVertex(currentPointL, u1, 0);
                                    addVertex(tempV2_6, u1, 0);
                                    addVertex(currentPoint, u1, 0.5);

                                    addVertex(currentPoint, u1, 0.5);
                                    addVertex(tempV2_6, u1, 0);
                                    addVertex(tempV2_7, u1, 0);

                                    addVertex(currentPoint, u1, 0.5);
                                    addVertex(tempV2_7, u1, 0);
                                    addVertex(nextPointL, u1, 0);

                                } else {

                                    tempV2_6.subVectors(outerPoint, currentPointR).multiplyScalar(miterFraction).add(currentPointR);
                                    tempV2_7.subVectors(outerPoint, nextPointR).multiplyScalar(miterFraction).add(nextPointR);

                                    addVertex(currentPointR, u1, 1);
                                    addVertex(tempV2_6, u1, 1);
                                    addVertex(currentPoint, u1, 0.5);

                                    addVertex(currentPoint, u1, 0.5);
                                    addVertex(tempV2_6, u1, 1);
                                    addVertex(tempV2_7, u1, 1);

                                    addVertex(currentPoint, u1, 0.5);
                                    addVertex(tempV2_7, u1, 1);
                                    addVertex(nextPointR, u1, 1);

                                }

                            }

                        } else {

                            // Miter join segment triangles

                            if (innerSideModified) {

                                // Optimized segment + join triangles

                                if (joinIsOnLeftSide) {

                                    addVertex(lastPointR, u0, 1);
                                    addVertex(lastPointL, u0, 0);
                                    addVertex(outerPoint, u1, 0);

                                    addVertex(lastPointR, u0, 1);
                                    addVertex(outerPoint, u1, 0);
                                    addVertex(innerPoint, u1, 1);

                                } else {

                                    addVertex(lastPointR, u0, 1);
                                    addVertex(lastPointL, u0, 0);
                                    addVertex(outerPoint, u1, 1);

                                    addVertex(lastPointL, u0, 0);
                                    addVertex(innerPoint, u1, 0);
                                    addVertex(outerPoint, u1, 1);

                                }


                                if (joinIsOnLeftSide) {

                                    nextPointL.set(outerPoint);

                                } else {

                                    nextPointR.set(outerPoint);

                                }


                            } else {

                                // Add extra miter join triangles

                                if (joinIsOnLeftSide) {

                                    addVertex(currentPointL, u1, 0);
                                    addVertex(outerPoint, u1, 0);
                                    addVertex(currentPoint, u1, 0.5);

                                    addVertex(currentPoint, u1, 0.5);
                                    addVertex(outerPoint, u1, 0);
                                    addVertex(nextPointL, u1, 0);

                                } else {

                                    addVertex(currentPointR, u1, 1);
                                    addVertex(outerPoint, u1, 1);
                                    addVertex(currentPoint, u1, 0.5);

                                    addVertex(currentPoint, u1, 0.5);
                                    addVertex(outerPoint, u1, 1);
                                    addVertex(nextPointR, u1, 1);

                                }

                            }

                            isMiter = true;

                        }

                        break;

                }

            } else {

                // The segment triangles are generated here when two consecutive points are collinear

                makeSegmentTriangles();

            }

        } else {

            // The segment triangles are generated here if it is the ending segment

            makeSegmentTriangles();

        }

        if (!isClosed && iPoint === numPoints - 1) {

            // Start line endcap
            addCapGeometry(points[0], point0L, point0R, joinIsOnLeftSide, true, u0);

        }

        // Increment loop variables

        u0 = u1;

        previousPoint = currentPoint;

        lastPointL.set(nextPointL);
        lastPointR.set(nextPointR);

    }

    if (!isClosed) {

        // Ending line endcap
        addCapGeometry(currentPoint, currentPointL, currentPointR, joinIsOnLeftSide, false, u1);

    } else if (innerSideModified && vertices) {

        // Modify path first segment vertices to adjust to the segments inner and outer intersections

        let lastOuter = outerPoint;
        let lastInner = innerPoint;

        if (initialJoinIsOnLeftSide !== joinIsOnLeftSide) {

            lastOuter = innerPoint;
            lastInner = outerPoint;

        }

        if (joinIsOnLeftSide) {

            if (isMiter || initialJoinIsOnLeftSide) {

               toArray(lastInner,vertices, 0 * 3);
                toArray(lastInner,vertices, 3 * 3);

                if (isMiter) {

                 toArray(lastOuter, vertices, 1 * 3);

                }

            }

        } else {

            if (isMiter || !initialJoinIsOnLeftSide) {

                toArray(lastInner, vertices, 1 * 3);
                toArray(lastInner,vertices, 3 * 3);

                if (isMiter) {

                    toArray(lastOuter,vertices, 0 * 3);

                }

            }

        }

    }

    return numVertices;

    // -- End of algorithm

    // -- Functions

    function getNormal(p1, p2, result) {
        result.subVectors(p2, p1);
        return result.set(-result[2], result[0]).normalize();
    }

    function addVertex(position, u, v) {
        if (vertices) {
            vertices[currentCoordinate] = position[0];
            vertices[currentCoordinate + 1] = position[2];
            vertices[currentCoordinate + 2] = 0;
            if (normals) {
                normals[currentCoordinate] = 0;
                normals[currentCoordinate + 1] = 0;
                normals[currentCoordinate + 2] = 1;
            }
            currentCoordinate += 3;
            if (uvs) {
                uvs[currentCoordinateUV] = u;
                uvs[currentCoordinateUV + 1] = v;
                currentCoordinateUV += 2;
            }
        }
        numVertices += 3;
    }

    function makeCircularSector(center, p1, p2, u, v) {
        // param p1, p2: Points in the circle arc.
        // p1 and p2 are in clockwise direction.
        tempV2_1.set(math.normalizeVec2(math.subVec2(p1, center, math.vec2())));
        tempV2_2.set(math.normalizeVec2(math.subVec2(p2, center, math.vec2())));
        let angle = Math.PI;
        const dot = math.dotVec2(tempV2_1, tempV2_2);
        if (Math.abs(dot) < 1) {
            angle = Math.abs(Math.acos(dot));
        }
        angle /= arcDivisions;
        tempV2_3.set(p1);
        for (let i = 0, il = arcDivisions - 1; i < il; i++) {
            math.rotateVec2(tempV2_3, center, angle, tempV2_4);
            addVertex(tempV2_3, u, v);
            addVertex(tempV2_4, u, v);
            addVertex(center, u, 0.5);
            tempV2_3.set(tempV2_4);
        }
        addVertex(tempV2_4, u, v);
        addVertex(p2, u, v);
        addVertex(center, u, 0.5);

    }

    function makeSegmentTriangles() {
        addVertex(lastPointR, u0, 1);
        addVertex(lastPointL, u0, 0);
        addVertex(currentPointL, u1, 0);
        addVertex(lastPointR, u0, 1);
        addVertex(currentPointL, u1, 1);
        addVertex(currentPointR, u1, 0);
    }

    function makeSegmentWithBevelJoin(joinIsOnLeftSide, innerSideModified, u) {
        if (innerSideModified) {
            // Optimized segment + bevel triangles
            if (joinIsOnLeftSide) {
                // Path segments triangles
                addVertex(lastPointR, u0, 1);
                addVertex(lastPointL, u0, 0);
                addVertex(currentPointL, u1, 0);
                addVertex(lastPointR, u0, 1);
                addVertex(currentPointL, u1, 0);
                addVertex(innerPoint, u1, 1);
                // Bevel join triangle
                addVertex(currentPointL, u, 0);
                addVertex(nextPointL, u, 0);
                addVertex(innerPoint, u, 0.5);
            } else {
                // Path segments triangles
                addVertex(lastPointR, u0, 1);
                addVertex(lastPointL, u0, 0);
                addVertex(currentPointR, u1, 1);
                addVertex(lastPointL, u0, 0);
                addVertex(innerPoint, u1, 0);
                addVertex(currentPointR, u1, 1);
                // Bevel join triangle
                addVertex(currentPointR, u, 1);
                addVertex(nextPointR, u, 0);
                addVertex(innerPoint, u, 0.5);
            }
        } else {
            // Bevel join triangle. The segment triangles are done in the main loop
            if (joinIsOnLeftSide) {
                addVertex(currentPointL, u, 0);
                addVertex(nextPointL, u, 0);
                addVertex(currentPoint, u, 0.5);
            } else {
                addVertex(currentPointR, u, 1);
                addVertex(nextPointR, u, 0);
                addVertex(currentPoint, u, 0.5);
            }
        }
    }

    function createSegmentTrianglesWithMiddleSection(joinIsOnLeftSide, innerSideModified) {
        if (innerSideModified) {
            if (joinIsOnLeftSide) {
                addVertex(lastPointR, u0, 1);
                addVertex(lastPointL, u0, 0);
                addVertex(currentPointL, u1, 0);
                addVertex(lastPointR, u0, 1);
                addVertex(currentPointL, u1, 0);
                addVertex(innerPoint, u1, 1);
                addVertex(currentPointL, u0, 0);
                addVertex(currentPoint, u1, 0.5);
                addVertex(innerPoint, u1, 1);
                addVertex(currentPoint, u1, 0.5);
                addVertex(nextPointL, u0, 0);
                addVertex(innerPoint, u1, 1);
            } else {
                addVertex(lastPointR, u0, 1);
                addVertex(lastPointL, u0, 0);
                addVertex(currentPointR, u1, 1);
                addVertex(lastPointL, u0, 0);
                addVertex(innerPoint, u1, 0);
                addVertex(currentPointR, u1, 1);
                addVertex(currentPointR, u0, 1);
                addVertex(innerPoint, u1, 0);
                addVertex(currentPoint, u1, 0.5);
                addVertex(currentPoint, u1, 0.5);
                addVertex(innerPoint, u1, 0);
                addVertex(nextPointR, u0, 1);
            }
        }

    }

    function addCapGeometry(center, p1, p2, joinIsOnLeftSide, start, u) {
        // param center: End point of the path
        // param p1, p2: Left and right cap points
        switch (style.strokeLineCap) {
            case 'round':
                if (start) {
                    makeCircularSector(center, p2, p1, u, 0.5);
                } else {
                    makeCircularSector(center, p1, p2, u, 0.5);
                }
                break;
            case 'square':
                if (start) {
                    tempV2_1.subVectors(p1, center);
                    tempV2_2.set(tempV2_1[2], -tempV2_1[0]);
                    tempV2_3.addVectors(tempV2_1, tempV2_2).add(center);
                    tempV2_4.subVectors(tempV2_2, tempV2_1).add(center);
                    // Modify already existing vertices
                    if (joinIsOnLeftSide) {
                        toArray(tempV2_3, vertices, 1 * 3);
                        toArray(tempV2_4, vertices, 0 * 3);
                        toArray(tempV2_4, vertices, 3 * 3);
                    } else {
                        toArray(tempV2_3,vertices, 1 * 3);
                        toArray(tempV2_3, vertices, 3 * 3);
                        toArray(tempV2_4, vertices, 0 * 3);
                    }
                } else {
                    math.subVec2(p2, center, tempV2_1);
                    tempV2_2[0] = tempV2_1[1];
                    tempV2_2[1] = -tempV2_1[0];
                    math.addVec2(math.subVec2(tempV2_1, tempV2_2, tempV2_3), center, tempV2_3);
                    math.addVec2(math.subVec2(tempV2_2, tempV2_1, tempV2_4), center, tempV2_4);
                    const vl = vertices.length;
                    // Modify already existing vertices
                    if (joinIsOnLeftSide) {
                        toArray(tempV2_3, vertices, vl - 1 * 3);
                        toArray(tempV2_4, vertices, vl - 2 * 3);
                        toArray(tempV2_4, vertices, vl - 4 * 3);
                    } else {
                        toArray(tempV2_3, vertices, vl - 2 * 3);
                        toArray(tempV2_4, vertices, vl - 1 * 3);
                        toArray(tempV2_4, vertices, vl - 4 * 3);
                    }
                }
                break;
            case 'butt':
            default:
                break;
        }
    }

    function removeDuplicatedPoints(points) {
        let dupPoints = false;
        for (let i = 1, n = points.length - 1; i < n; i++) {
            if (vec3Dist(points[i], points[i + 1]) < minDistance) {
                dupPoints = true;
                break;
            }
        }
        if (!dupPoints) return points;
        const newPoints = [];
        newPoints.push(points[0]);
        for (let i = 1, n = points.length - 1; i < n; i++) {
            if (vec3Dist(points[i], points[i + 1]) >= minDistance) {
                newPoints.push(points[i]);
            }
        }
        newPoints.push(points[points.length - 1]);
        return newPoints;
    }

    function vec3Dist(a, b) {
        const dx = a[0] - b[0];
        const dy = a[1] - b[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function toArray(a, array, offset) {
        array[0 + offset] = a[0];
        array[1 + offset] = a[1];
        return array;
    }
}
