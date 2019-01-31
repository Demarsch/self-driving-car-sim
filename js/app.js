//World parameters
let worldEl = $('.world');
let width = worldEl.width();
let height = worldEl.height();
const mainColor = '#4c1daa';

//Car parameters
const carWidth = 25;
const carHeight = 50;
const carRestitution = 0.3;
const carFriction = 0.05;
//We want the car to move smoothly, but to process car state less frequently
let tickFrequency = 50;
const velocityIncrement = 0.002;
const angleIncrement = 0.02;
const fovDistance = 150;
//FoV angle in radians. Centered around cars front
const frontAngle = Math.PI / 4;
const rearAngle = Math.PI / 4;
const frontSensors = 9;
const rearSensors = 9;
const totalSensors = frontSensors + rearSensors;

let isRecording = false;
let isMoving = false;
let showSensors = false;
let showSpotlight = false;

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
        wireframes: false,
        width: width,
        height: height,
        showAngleIndicator: false,
        showVelocity: false,
        background: 'white'
    }
});

// Run the renderer
Render.run(render);

let allObstacles = [];
//Add world boundaries
let boundsOffset = 1;
let bounds = [
    //Top
    Bodies.rectangle(width / 2, boundsOffset / 2, width, boundsOffset, { 
        isStatic: true,
        render: {
            fillStyle: mainColor
        }
    }),
    //Right
    Bodies.rectangle(width - boundsOffset / 2, height / 2, boundsOffset, height, { 
        isStatic: true,
        render: {
            fillStyle: mainColor
        }
    }),
    //Bottom
    Bodies.rectangle(width / 2, height - boundsOffset / 2, width, boundsOffset, {
         isStatic: true,
         render: {
             fillStyle: mainColor
         }
    }),
    //Left
    Bodies.rectangle(boundsOffset / 2, height / 2, boundsOffset, height, { 
        isStatic: true,
        render: {
            fillStyle: mainColor
        } 
    })
];
World.add(engine.world, bounds);
allObstacles.splice(0, 0, ...bounds);

// Add some obstacles
// let obstacles = [
//     Bodies.circle(200, 200, 40, { isStatic: true }),
//     Bodies.circle(width - 200, 200, 40, { isStatic: true }),
//     Bodies.circle(width - 200, height - 200, 40, { isStatic: true }),
//     Bodies.circle(200, height - 200, 40, { isStatic: true })
// ];
// World.add(engine.world, obstacles);
// allObstacles.splice(-1, 0, ...obstacles);

// Create our car
let carBody = Bodies.rectangle(width / 2 - 100 + Math.random() * 200, height / 2 - 100 + Math.random() * 200, carHeight, carWidth, {
    restitution: carRestitution,
    frictionAir: carFriction,
    render: {
        sprite: {
            texture: './img/car.png',
            xScale: 0.9,
            yScale: 0.9
        }
    }
});
World.add(engine.world, carBody);

let car = new Car(carBody, {
    velocityIncrement: velocityIncrement,
    angleIncrement: angleIncrement,
    fovDistance: fovDistance,
    frontAngle: frontAngle,
    frontSensors: frontSensors,
    rearAngle: rearAngle,
    rearSensors: rearSensors
});


// Add mouse control
let mouse = Mouse.create(render.canvas);
// Keep the mouse in sync with rendering
render.mouse = mouse;

// Run the engine
Engine.run(engine);

let moveActions = [ () => {}, car.moveForward, car.moveBackward ];
let turnActions = [ () => {}, car.turnLeft, car.turnRight ];

let ts = 0;

let currentModel = null;

Events.on(engine, 'beforeUpdate', e => {
    car.updateSensorData(allObstacles);
    if (e.timestamp < ts + tickFrequency) {
        return;
    }
    ts = e.timestamp;
    let keyboardActions = keyboardHandler();
    //If user starts to drive himself, we suspend all autoprocessing
    if (keyboardActions.size) {
        return;
    }
    let sensorData = car.sensorData.map(s => s.distanceRel);
    if (isMoving && currentModel) {
        tf.tidy(() => {            
            let sensorTensor = tf.tensor2d(sensorData, [1, sensorData.length]);
            let predict = currentModel.predict(sensorTensor).flatten();
            let action = predict.argMax().get();
            let turnAction = turnActions[action % turnActions.length];
            let moveAction = moveActions[Math.floor(action / turnActions.length)];
            moveAction.call(car);
            turnAction.call(car);
        });
    }
});


let learningData = [];
let learningLabels = [];
let learningHash = new Map();

function recordLearningData(sensorData, action) {
    let sensorHash = Math.round(sensorData.reduce((x, y) => x + y, 0) * 10e8);
    let hashBucket = learningHash.get(sensorHash);
    let result = false;
    if (hashBucket) {
        let found = true;
        for (var i = 0; i < hashBucket.length; i++) {
            found = true;
            let hashBucketItem = hashBucket[i];
            for (var j = 0; j < sensorData.length; j++) {
                if (sensorData[j] !== hashBucketItem[j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                break;
            }
        }
        if (!found) {
            hashBucket.push(sensorData);
            result = true;
        } 
    } else {
        hashBucket = [sensorData];
        learningHash.set(sensorHash, hashBucket);
        result = true;
    }
    if (result) {        
        learningData.push(sensorData)
        learningLabels.push(action);
    }
    return result;
}

const keys = new Set();

$(document).on('keydown', e => {
    //Arrow keys
    if (e.keyCode >= 37 && e.keyCode <= 40) {
        keys.add(e.keyCode);
    }
});

$(document).on('keyup', e => {
    //Arrow keys
    if (e.keyCode >= 37 && e.keyCode <= 40) {
        keys.delete(e.keyCode);
    }
});

function keyboardHandler() {
    let result = new Set();
    let moveAction = 0;
    let turnAction = 0;
    //Up
    if (keys.has(38)) {
        moveAction = 1;
        result.add(car.moveForward);
        car.moveForward();
    }
    //Down
    if (keys.has(40)) {
        moveAction = 2;
        result.add(car.moveBackward);
        car.moveBackward();
    }
    //Left
    if (keys.has(37)) {
        turnAction = 1;
        result.add(car.turnLeft);
        car.turnLeft();
    }
    //Right
    if (keys.has(39)) {
        turnAction = 2;
        result.add(car.turnRight);
        car.turnRight();
    }
    action = moveAction * turnActions.length + turnAction;
    if (action !== 0 && isRecording) {
        let sensorData = car.sensorData.map(s => s.distanceRel);
        if (recordLearningData(sensorData, action)) {
            $('#learnedIterations').text(learningData.length.toString());
        }
    }
    return result;
}

Events.on(render, 'afterRender', function() {
    let sensorData = car.sensorData;
    if (!sensorData) {
        return;
    }
    let context = render.context;
    Render.startViewTransform(render);
    if (showSpotlight) {        
        context.fillStyle = mainColor;
        context.beginPath();
        context.arc(carBody.position.x, carBody.position.y, fovDistance, 0, 2 * Math.PI);
        context.rect(width, 0, -width, height);
        context.fill();
    }
    if (showSensors) {
        for (let i = 0; i < sensorData.length; i++) {
            let sensor = sensorData[i];
            if (sensor.collides) {
                context.fillStyle = 'red';                
                context.fillRect(sensor.point.x - 4, sensor.point.y - 4, 5, 5);
            } else {
                context.fillStyle = mainColor;                
                context.fillRect(sensor.point.x - 2, sensor.point.y - 2, 3, 3);
            }
        }
    }
    Render.endViewTransform(render);
}); 

// Fit the render viewport to the scene
Render.lookAt(render, {
    min: { x: 0, y: 0 },
    max: { x: width, y: height }
});

function toggleSensors(on) {
    let btn = $('#sensors');
    showSensors = typeof on === 'undefined' ? !showSensors : on;
    btn.toggleClass('on', showSensors);
}

function toggleSpotlight(on) {
    let btn = $('#spotlight');    
    showSpotlight = typeof on === 'undefined' ? !showSpotlight : on;
    btn.toggleClass('on', showSpotlight);
}

function toggleAutoMove(on) {
    let btn = $('#move');    
    isMoving = typeof on === 'undefined' ? !isMoving : on;
    btn.toggleClass('on', isMoving);
}

$('#reset').click(() => {
    Body.setPosition(carBody,  { x: width * (0.1 + 0.8 * Math.random()), y: height * (0.1 + 0.8 * Math.random()) });
    Body.setAngle(carBody, Math.random() * Math.PI);
});

$('#sensors').click(() => toggleSensors());

$('#spotlight').click(() => toggleSpotlight());

$('#move').click(() => toggleAutoMove());

$('#record').click(() => {
    toggleAutoMove(false);
    isRecording = !isRecording;
    if (isRecording) {
        toggleSpotlight(true);
        toggleSensors(true);
    }
});

$('#finish').click(async () => {
    const epochs = 30;
    let modal = $('#progressModal');
    modal.modal('show');
    let progress = modal.find('.progress-bar');
    try {
        let model = currentModel;
        if (!model) {
            model = tf.sequential();
            model.add(tf.layers.dense({
                units: Math.max(100, totalSensors * 2),
                inputShape: [totalSensors],
                activation: 'relu'
                }));
            model.add(tf.layers.dense({
                units: moveActions.length * turnActions.length,
                activation: 'softmax'
            }));
            model.compile({
                loss: 'categoricalCrossentropy',
                optimizer: 'sgd'
            });
        }

        const xs = tf.tensor2d(learningData, [learningData.length, totalSensors]);
        const ys = tf.tidy(() => tf.oneHot(tf.tensor1d(learningLabels, 'int32'), moveActions.length * turnActions.length));        
        await model.fit(xs, ys, {
            epochs: epochs,
            callbacks : {
                onEpochEnd: e => {
                    progress.css('width', `100%`);
                }
            },
            yieldEvery : 'epoch'
        });
        //TODO: dispose current model
        currentModel = model;
    } finally {
        modal.modal('hide');
        progress.css('width', '0px');
    }
});