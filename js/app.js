let worldEl = $('#world');
let width = worldEl.width();
let height = worldEl.height();
let showFov = true;

const carWidth = 25;
const carHeight = 50;
const carRestitution = 0.3;
const carFriction = 0.05;
//We want the car to move smoothly, but to process car state less frequently
const tickFrequency = 50;
const velocityIncrement = 0.003;
const angleIncrement = 0.03;
const fovDistance = 150;
//FoV angle in radians. Centered around cars front
const fovAngle = 2 * Math.PI;
//Number of sensors that the car has. Distributed evenly across car's FoV angle
const fovSensors = 360;

let Engine = Matter.Engine,
    Render = Matter.Render,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Events = Matter.Events,
    Query = Matter.Query,
    MouseConstraint = Matter.MouseConstraint,
    Mouse = Matter.Mouse;

// No gravity, as we percieve our world from above - thus all bodies technically float in the air
let engine = Engine.create();
engine.world.gravity.x = 0;
engine.world.gravity.y = 0;

// Create a renderer
let render = Render.create({
    element: worldEl[0],
    engine: engine,
    options: {
        width: width,
        height: height,
        showAngleIndicator: true,
        showVelocity: true
    }
});

// Run the renderer
Render.run(render);

let allObstacles = [];
//Add world boundaries
let boundsOffset = 10;
let bounds = [
    //Top
    Bodies.rectangle(width / 2, boundsOffset / 2, width, boundsOffset, { isStatic: true }),
    //Right
    Bodies.rectangle(width - boundsOffset / 2, height / 2, boundsOffset, height, { isStatic: true }),
    //Bottom
    Bodies.rectangle(width / 2, height - boundsOffset / 2, width, boundsOffset, { isStatic: true }),
    //Left
    Bodies.rectangle(boundsOffset / 2, height / 2, boundsOffset, height, { isStatic: true })
];
World.add(engine.world, bounds);
allObstacles.splice(0, 0, ...bounds);

// Add some obstacles
let obstacles = [
    Bodies.circle(200, 200, 40, { isStatic: true }),
    Bodies.circle(width - 200, 200, 40, { isStatic: true }),
    Bodies.circle(width - 200, height - 200, 40, { isStatic: true }),
    Bodies.circle(200, height - 200, 40, { isStatic: true })
];
World.add(engine.world, obstacles);
allObstacles.splice(-1, 0, ...obstacles);

// Create our car
let carBody = Bodies.rectangle(width / 2, height / 2, carHeight, carWidth, {
    restitution: carRestitution,
    frictionAir: carFriction
});
Body.rotate(carBody, Math.PI / 2);
World.add(engine.world, carBody);

let car = new Car(carBody, {
    velocityIncrement: velocityIncrement,
    angleIncrement: angleIncrement,
    fovDistance: fovDistance,
    fovSensors: fovSensors,
    fovAngle: fovAngle
});

// Add mouse control
let mouse = Mouse.create(render.canvas);
// Keep the mouse in sync with rendering
render.mouse = mouse;

// Run the engine
Engine.run(engine);
let ts = 0;
let isAutoMove = false;

Events.on(engine, 'beforeUpdate', e => {
    car.updateSensorData(allObstacles);
    if (e.timestamp < ts + tickFrequency) {
        return;
    }
    ts = e.timestamp;
    let keyboardActions = keyboardHandler();
    if (isAutoMove && !keyboardActions.has(car.moveForward)) {
        car.moveForward();
    }
});

const keys = new Set();

function keyboardHandler() {
    let result = new Set();
    //Left
    if (keys.has(37)) {
        result.add(car.turnLeft);
        car.turnLeft();
    }
    //Up
    if (keys.has(38)) {
        result.add(car.moveForward);
        car.moveForward();
    }
    //Right
    if (keys.has(39)) {
        result.add(car.turnRight);
        car.turnRight();
    }
    //Down
    if (keys.has(40)) {
        result.add(car.moveBackward);
        car.moveBackward();
    }
    return result;
}

$(document).on('keydown', e => keys.add(e.keyCode));
$(document).on('keyup', e => keys.delete(e.keyCode));

$('#start').click(() => isAutoMove = true);

$('#stop').click(() => isAutoMove = false);

Events.on(render, 'afterRender', function() {
    let sensorData = car.sensorData;
    if (!sensorData) {
        return;
    }
    let context = render.context;
    Render.startViewTransform(render);
    if (showFov) {        
        for (let i = 0; i < sensorData.length; i++) {
            let sensor = sensorData[i];
            if (sensor.collides) {
                context.fillStyle = 'red';                
                context.fillRect(sensor.point.x - 2, sensor.point.y - 2, 3, 3);
            } else {
                context.fillStyle = 'white';                
                context.fillRect(sensor.point.x, sensor.point.y, 1, 1);
            }
        }
    }
    Render.endViewTransform(render);
}); 