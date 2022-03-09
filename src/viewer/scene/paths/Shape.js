import {Path} from './Path.js';

class Shape extends Path {

    constructor(points) {
        super(points);
        this.holes = [];
    }

    getPointsHoles(divisions) {
        const holesPts = [];
        for (let i = 0, l = this.holes.length; i < l; i++) {
            holesPts[i] = this.holes[i].getPoints(divisions);
        }
        return holesPts;
    }

    extractPoints(divisions) {
        return {
            shape: this.getPoints(divisions),
            holes: this.getPointsHoles(divisions)
        };
    }
}


export {Shape};
