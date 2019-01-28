const degree = Math.PI / 180;

let Body = Matter.Body,
    Vector = Matter.Vector;

class Car {

    constructor(body, options) {
        this.body = body;
        options = options || {};
        this._velocityIncrement = options.velocityIncrement || 0.003;
        this._angleIncrement = options.angleIncrement || 0.03;
        this._fovDistance = options.fovDistance || 150;
        this._fovSensors = options.fovSensors || 360;
        this._fovAngles = [];
        let angle = options.fovAngle || 2 * Math.PI;
        let halfAngle = angle / 2;
        let deltaAngle = angle / this._fovSensors;
        for (let i = 0; i < this._fovSensors; i++) {
            this._fovAngles.push({
                angle: -halfAngle + i * deltaAngle,
                index: i
            });
        }
    }

    moveForward() {
        let forward = this.body.axes[1];
        Body.applyForce(this.body, this.body.position, {x: this._velocityIncrement * forward.x , y: this._velocityIncrement * forward.y });
    }

    moveBackward() { 
        let forward = this.body.axes[1];
        Body.applyForce(this.body, this.body.position, {x: -this._velocityIncrement * forward.x, y: -this._velocityIncrement * forward.y })
    }

    turnLeft() {
        this.body.torque = -this._angleIncrement;
    }

    turnRight() {
        this.body.torque = this._angleIncrement;
    }

    updateSensorData(obstacles) {
        let vForward = Vector.create(this._fovDistance * this.body.axes[1].x, this._fovDistance * this.body.axes[1].y);
        let sensorData = this.sensorData;
        if (!sensorData) {
            sensorData = [];
            for (let i = 0; i < this._fovAngles.length; i++) {
                sensorData.push({});
            }
        }
        for (let i = 0; i < this._fovAngles.length; i++) {
            let deltaAngle = this._fovAngles[i].angle;
            let vFov = Vector.add(Vector.rotate(vForward, deltaAngle), this.body.position);
            let collisions = raycast(obstacles, this.body.position, vFov);
            let sensorItem = sensorData[i];
            if (collisions.length === 0) {
                sensorItem.collides = false;
                sensorItem.point = vFov;
                sensorItem.distance = this._fovDistance;
                sensorItem.distanceRel = 1;
            } else {
                let collision = collisions[0];
                let distance = Vector.magnitude(Vector.sub(collision.point, this.body.position));
                sensorItem.collides = true;
                sensorItem.point = collision.point;
                sensorItem.distance = distance;
                sensorItem.distanceRel = distance / this._fovDistance;
            }
        }
        this.sensorData = sensorData;
        return sensorData;
    }
}