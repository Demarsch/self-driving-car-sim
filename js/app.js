//World parameters
let worldEl = $('.world');
let width = worldEl.width();
let height = worldEl.height();
const mainColor = '#4c1daa';

//Car parameters
const carWidth = 25;
const obstacleSize = carWidth;
const carHeight = 50;
const carRestitution = 0.3;
const carFriction = 0.05;
//We want the car to move smoothly, but to process car state less frequently
let tickFrequency = 50;
const velocityIncrement = 0.002;
const angleIncrement = 0.02;
const fovDistance = 200;
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
    Common = Matter.Common,
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

let obstacles = [];
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
            $('#learnedIterations').text(`${learningData.length} position${learningData.length === 1 ? '' : 's'}`);
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
    if (mouseDownPosition) {
        context.strokeStyle = mainColor;
        context.setLineDash([6]);
        context.beginPath();
        context.moveTo(mouseDownPosition.x, mouseDownPosition.y);
        context.lineTo(mouse.position.x, mouse.position.y);
        context.stroke();
        
    } else if (mouse.position.x > 0 && mouse.position.y > 0) {
        context.strokeStyle = mainColor;
        context.setLineDash([6]);
        context.beginPath();
        context.arc(mouse.position.x, mouse.position.y, obstacleSize, 0, 2 * Math.PI);
        context.stroke();
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

function toggleRecording(on) {
    let btn = $('#record');   
    isRecording = typeof on === 'undefined' ? !isRecording : on;
    btn.toggleClass('on', isRecording);
    let showRecordingContainer = isRecording || learningData.length;
    let container = $('.recording-container');
    if (showRecordingContainer) {
        container.show();
    } else {
        container.hide();
    }
}

$('#reset').click(() => {
    Body.setPosition(carBody,  { x: width * (0.1 + 0.8 * Math.random()), y: height * (0.1 + 0.8 * Math.random()) });
    Body.setAngle(carBody, Math.random() * Math.PI);
});

let mouseDownPosition;

$(document).on('mousedown', e => {
    if (e.altKey || e.ctrlKey || e.shiftKey) {
        return;
    }
    if (e.button === 0) {
        mouseDownPosition = Vector.clone(mouse.position);
    }
});

$('.toolbar').on('mouseup', e => {
    e.stopPropagation();
    mouseDownPosition = null;
});

$(document).click(e => {
    if (e.altKey || e.ctrlKey || e.shiftKey) {
        return;
    }
    if (!mouseDownPosition) {
        return;
    }
    if (e.button === 0) { 
        let mouseUpPosition = mouse.position;
        if (mouseUpPosition.x === mouseDownPosition.x && mouseUpPosition.y === mouseDownPosition.y) {
            obstacle = Bodies.circle(mouseUpPosition.x, mouseUpPosition.y, obstacleSize, {
                isStatic: true,
                render: {
                    fillStyle: mainColor
                }
            });
        } else {
            let length = Math.sqrt((mouseUpPosition.x - mouseDownPosition.x) ** 2 + (mouseUpPosition.y - mouseDownPosition.y) ** 2);
            let angle = Math.asin((mouseUpPosition.y - mouseDownPosition.y) / length) * (Math.sign(mouseUpPosition.x - mouseDownPosition.x) || 1);
            let center = {
                x: mouseDownPosition.x + (mouseUpPosition.x - mouseDownPosition.x) / 2,
                y: mouseDownPosition.y + (mouseUpPosition.y - mouseDownPosition.y) / 2
            }
            obstacle = Bodies.rectangle(center.x, center.y, length, 10, {
                isStatic: true,
                render: {
                    fillStyle: mainColor
                }
            });
            Body.setAngle(obstacle, angle);
        }
        World.add(engine.world, obstacle);
        obstacles.push(obstacle);
        allObstacles.push(obstacle);
    }
    mouseDownPosition = null;
});

$(document).on('contextmenu', e => {
    if (e.altKey || e.ctrlKey || e.shiftKey) {
        return;
    }
    e.stopPropagation();
    let mousePosition = mouse.position;
    let clickedObstacles = Query.point(obstacles, mousePosition);
    if (clickedObstacles.length) {
        for (let obstacle of clickedObstacles) {
            World.remove(engine.world, obstacle);
            obstacles.splice(obstacles.indexOf(obstacle), 1);
            allObstacles.splice(allObstacles.indexOf(obstacle), 1);
        }        
    }
});

$('#sensors').click(e => {
    e.stopPropagation();
    toggleSensors();
});

$('#spotlight').click(e=> {
    e.stopPropagation();
    toggleSpotlight();
});

$('#move').click(e => {
    e.stopPropagation();
    toggleAutoMove();
});

$('#record').click(e => {
    e.stopPropagation();
    toggleAutoMove(false);
    toggleRecording();
    if (isRecording) {
        toggleSensors(true);
    }
});

$('#applyModel').click(async e => {
    e.stopPropagation();
    const epochs = 30;
    let modal = $('#progressModal');
    modal.modal('show');
    let xs = null;
    let ys = null;
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
            yieldEvery : 'epoch'
        });
        currentModel = model;
    } finally {
        if (xs) {
            xs.dispose();
        }
        if (ys) {
            ys.dispose();
        }
        modal.modal('hide');
    }
});

$('#discardModel').click(e => {
    e.stopPropagation();
    if (currentModel) {
        currentModel.dispose();
    }
    learningData.length = 0;
    learningHash.clear();
    learningLabels.length = 0;
    toggleAutoMove();
    $('#learnedIterations').text(`nothing`);
});

$('.recording-container').hide();

tf.loadModel('./agent/trained-agent.json')
    .then(m => { 
        currentModel = m;
        console.log('Loaded model');
    })
    .catch(e => {
        console.log('Failed to load model');
        console.log(e);
    });