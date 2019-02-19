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
        this._frontSensors = options.frontSensors || 9;
        this._frontAngle = options.frontAngle || Math.PI / 2;
        this._rearSensors = options.rearSensors || 0;
        this._rearAngle = options.rearAngle || Math.PI / 2;
        this._frontAngles = [];
        this._rearAngles = [];
        this.sensorData = [];

        let angle = this._frontAngle;
        let halfAngle = angle / 2;
        let deltaAngle = angle / this._frontSensors;
        for (let i = 0; i < this._frontSensors; i++) {
            this.sensorData.push({ point: { x: 0, y: 0 }});
            this._frontAngles.push(-halfAngle + i * deltaAngle);
        }        

        angle = this._rearAngle;
        halfAngle = angle / 2;
        deltaAngle = this._rearSensors ? angle / this._rearSensors : 0;
        for (let i = 0; i < this._rearSensors; i++) {
            this.sensorData.push({ point: { x: 0, y: 0 }});
            this._rearAngles.push(-halfAngle + i * deltaAngle);
        }        
    }

    getForwardVector() {
        return this.body.axes[1];
    }

    _onAction() {        
        this.speedDelta = carBody.speed - (this.speed || 0);
        this.speed = carBody.speed;
    }

    moveForward() {
        this._onAction();
        let forward = this.body.axes[1];
        Body.applyForce(this.body, this.body.position, {x: this._velocityIncrement * forward.x , y: this._velocityIncrement * forward.y });
    }

    moveBackward() { 
        this._onAction();
        let forward = this.body.axes[1];
        Body.applyForce(this.body, this.body.position, {x: -this._velocityIncrement * forward.x, y: -this._velocityIncrement * forward.y })
    }

    turnLeft() {
        this._onAction();
        this.body.torque = -this._angleIncrement;
    }

    turnRight() {
        this._onAction();
        this.body.torque = this._angleIncrement;
    }

    updateSensorData(obstacles) {
        let vForward = Vector.create(this._fovDistance * this.body.axes[1].x, this._fovDistance * this.body.axes[1].y);
        let sensorData = this.sensorData;
        let totalSensors = this._frontSensors + this._rearSensors;
        for (let i = 0; i < totalSensors; i++) {
            let deltaAngle = i < this._frontSensors
                ? this._frontAngles[i]
                : Math.PI + this._rearAngles[i - this._frontSensors];
            let vFov = Vector.add(Vector.rotate(vForward, deltaAngle), this.body.position);
            let collisions = raycast(obstacles, this.body.position, vFov);
            let sensorItem = sensorData[i];
            sensorItem.angle = deltaAngle;
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
                //We don't need the extreme precision here as 1 screen pixel is approx. 0.005 of the FoV distance
                sensorItem.distanceRel = Math.round(distance * 10e2 / this._fovDistance) / 10e2;
            }
        }
        this.sensorData = sensorData;
        return sensorData;
    }
}