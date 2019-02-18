//World parameters
let worldEl = $('.world');
let width = worldEl.width();
let height = worldEl.height();
const mainColor = '#4c1daa';

//Car parameters
const carWidth = 25;
const obstacleSize = carWidth;
const obstacleMass = 1e8;
const carHeight = 50;
const carRestitution = 0.3;
const carFriction = 0.05;
//We want the car to move smoothly, but to process car state less frequently
let tickFrequency = 50;
const velocityIncrement = 0.002;
const angleIncrement = 0.025;
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
let showTrace = true;
let showOverlay = true;

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

let trainingData = new TrainingData();

const keys = new Set();

$(document).on('keydown', e => {
    //Arrow keys
    if (e.keyCode >= 37 && e.keyCode <= 40) {
        keys.add(e.keyCode);
    //CTRL + Z
    } else if (e.ctrlKey && e.keyCode == 90) {
        let obstacle = obstacles.pop();
        if (obstacle) {
            World.remove(engine.world, obstacle);
            allObstacles.pop();
        }
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
        if (trainingData.add(sensorData, action)) {
            $('#learnedIterations').text(`${trainingData.length} position${trainingData.length === 1 ? '' : 's'} ${trainingData.length === 1 ? 'has' : 'have'}`);
        }
    }
    return result;
}

const trace = [];
const MAX_TRAIL_LENGTH = 350;

Events.on(render, 'afterRender', function() {
    if (carBody.speed > 0.1 && showTrace) {
        trace.push({
            rightWheel: Vector.clone(carBody.vertices[1]),
            leftWheel: Vector.clone(carBody.vertices[2])
        });
    }
    let sensorData = car.sensorData;
    if (!sensorData) {
        return;
    }
    let context = render.context;
    Render.startViewTransform(render);
    if (showTrace) {
        context.fillStyle = mainColor;
        for (let i = 0; i < trace.length; i++) {
            let trailItem = trace[i];
            context.fillStyle = `rgba(76, 29, 170, ${(MAX_TRAIL_LENGTH - trace.length + i) / MAX_TRAIL_LENGTH})`;
            context.fillRect(trailItem.rightWheel.x, trailItem.rightWheel.y, 1, 1);
            context.fillRect(trailItem.leftWheel.x, trailItem.leftWheel.y, 1, 1);
        }
    }
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
    if (trace.length > MAX_TRAIL_LENGTH) {
        trace.shift();
    }
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

function toggleTrace(on) {
    let btn = $('#trace');    
    showTrace = typeof on === 'undefined' ? !showTrace : on;
    btn.toggleClass('on', showTrace);
    if (!showTrace) {
        trace.length = 0;
    }
}

function toggleAutoMove(on) {
    let btn = $('#move');    
    isMoving = typeof on === 'undefined' ? !isMoving : on;
    btn.toggleClass('on', isMoving);
}

function toggleRecording(on) {
    let btn = $('#recording');   
    isRecording = typeof on === 'undefined' ? !isRecording : on;
    btn.toggleClass('on', isRecording);
    let enableRecordingContainer = isRecording || trainingData.length;
    $('.recording-container *').prop('disabled', !enableRecordingContainer);
}

function toggleOverlay() {    
    showOverlay = !showOverlay;
    $('.overlay').toggleClass('off', !showOverlay);
    if (showOverlay) {
        $('.btn-overlay').text('Get me back!');
    }
}

$('#reset').click(() => {
    Body.setPosition(carBody,  { x: width * (0.1 + 0.8 * Math.random()), y: height * (0.1 + 0.8 * Math.random()) });
    Body.setAngle(carBody, Math.random() * Math.PI);
});

$('#explosion').click(() => {
    var forceMagnitude = obstacleMass / 50;
    for (let obstacle of obstacles) {
        Body.applyForce(obstacle, obstacle.position, {
            x: forceMagnitude * Common.choose([1, -1]), 
            y: forceMagnitude * Common.choose([1, -1])
        });        
    }
});

let mouseDownPosition;

worldEl.on('mousedown', e => {
    if (e.altKey || e.ctrlKey || e.shiftKey) {
        return;
    }
    if (e.button === 0) {
        mouseDownPosition = Vector.clone(mouse.position);
    }
});

$('.toolbar').on('mouseup', () => {
    mouseDownPosition = null;
});

worldEl.click(e => {
    if (e.altKey || e.ctrlKey || e.shiftKey) {
        return;
    }
    if (!mouseDownPosition) {
        return;
    }
    if (e.button === 0) { 
        let mouseUpPosition = mouse.position;
        let distance = Math.sqrt((mouseUpPosition.x - mouseDownPosition.x) ** 2 + (mouseUpPosition.y - mouseDownPosition.y) ** 2);
        if (distance < obstacleSize) {
            obstacle = Bodies.circle(mouseUpPosition.x, mouseUpPosition.y, obstacleSize, {
                isStatic: false,
                restitution: 0.6,
                render: {
                    fillStyle: mainColor
                }
            });
            Body.setMass(obstacle, obstacleMass);
        } else {
            let angle = Math.asin((mouseUpPosition.y - mouseDownPosition.y) / distance) * (Math.sign(mouseUpPosition.x - mouseDownPosition.x) || 1);
            let center = {
                x: mouseDownPosition.x + (mouseUpPosition.x - mouseDownPosition.x) / 2,
                y: mouseDownPosition.y + (mouseUpPosition.y - mouseDownPosition.y) / 2
            }
            obstacle = Bodies.rectangle(center.x, center.y, distance, 6, {
                isStatic: false,
                restitution: 0.6,
                render: {
                    fillStyle: mainColor
                }
            });
            Body.setAngle(obstacle, angle);
            Body.setMass(obstacle, obstacleMass);
        }
        World.add(engine.world, obstacle);
        obstacles.push(obstacle);
        allObstacles.push(obstacle);
    }
    mouseDownPosition = null;
});

worldEl.on('contextmenu', e => {
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
    toggleSensors();
});

$('#spotlight').click(() => {
    toggleSpotlight();
});

$('#trace').click(() => {
    toggleTrace();
});

$('#move').click(() => {
    toggleAutoMove();
});

$('#recording').click(e => {
    toggleRecording();
    if (isRecording) {
        toggleAutoMove(false);
        toggleSensors(true);
        if (currentModel) {
            currentModel.dispose();
            currentModel = null;
        }
    }
});

$('#applyModel').click(async () => {
    if (!trainingData.length) {
        return;
    }
    const epochs = 40;
    let modal = $('#progressModal');
    modal.modal('show');
    let xs = null;
    let ys = null;
    try {
        let model = tf.sequential();
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
        const xs = tf.tensor2d(trainingData.data, [trainingData.length, totalSensors]);
        const ys = tf.tidy(() => tf.oneHot(tf.tensor1d(trainingData.labels, 'int32'), moveActions.length * turnActions.length));
        await model.fit(xs, ys, {
            epochs: epochs,
            yieldEvery : 'epoch'
        });
        if (currentModel) {
            currentModel.dispose();
        }
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

$('#discardModel').click(() => {
    if (currentModel) {
        currentModel.dispose();
        currentModel = null;
    }
    trainingData.clear();
    toggleAutoMove(false);
    $('#learnedIterations').text('No positions have');
});

const saveModelModal = $('#saveModelModal');
const loadModelModal = $('#loadModelModal');

saveModelModal.find('input[type="text"]').on('input', e => {
    let text = $(e.target).val();
    $('#confirmSaveModel').prop('disabled', text ? false : true);
});

$('#confirmSaveModel').click(async () => {
    let name = saveModelModal.find('input[type="text"]').val();
    currentModel.save(`downloads://${name}`);

    if (trainingData.length) {
        var data = "text/json;charset=utf-8," + encodeURIComponent(trainingData.toJson());
        let link = $(`<a href="data:${data}" download="${name}.training-data.json">download JSON</a>`).appendTo($('body'));
        link[0].click();
        link.remove();
    }

    saveModelModal.modal('hide');
});

$('#cancelSaveModel').click(() => {
    saveModelModal.modal('hide');
});

$('#saveModel').click(() => {
    if (currentModel == null) {
        return;
    }
    saveModelModal.modal('show');
});

$('#loadModel').click(() => {
    loadModelModal.find('input[type="file"]').val(null);
    loadModelModal.modal('show');
});

loadModelModal.find('input[type="file"]').change(() => {
    let hasModelFile = $('#loadModelFileInput')[0].files.length > 0;
    let hasWeightsFile = $('#loadWeightsFileInput')[0].files.length > 0;
    $('#confirmLoadModel').prop('disabled', !hasModelFile || !hasWeightsFile);
});

$('#confirmLoadModel').click(async () => {
    let modelFile = $('#loadModelFileInput')[0].files[0];
    let weightsFile = $('#loadWeightsFileInput')[0].files[0];
    let trainingDataFile = $('#loadTrainingDataFileInput')[0].files[0];
    loadModelModal.modal('hide');
    if (!modelFile || !weightsFile) {
        return;
    }
    try {
        const loadedModel = await tf.loadModel(tf.io.browserFiles([modelFile, weightsFile]))
        currentModel = loadedModel;
        console.log('Loaded model');
        if (trainingDataFile) {
            fr = new FileReader();
            fr.onload = e => {
                let lines = e.target.result;
                let newTrainingData = JSON.parse(lines);
                trainingData.fromJson(newTrainingData);
                $('#learnedIterations').text(`${trainingData.length} position${trainingData.length === 1 ? '' : 's'} ${trainingData.length === 1 ? 'has' : 'have'}`);
                console.log('Loaded training data');
                
            };
            fr.readAsText(trainingDataFile);
        }
    }
    catch {
        alert('Failed to upload model')
    }
});

$('#cancelLoadModel').click(() => {
    loadModelModal.modal('hide');
});

$('#toggleToolbarButton').click(() => {
    $('.toolbar').toggle();
});

$('#help').click(toggleOverlay);

$('.recording-container *').prop('disabled', true);

$('.dropdown-menu').on('click', e => e.stopPropagation());

$('.btn-overlay').click(toggleOverlay);

tf.loadModel('./agent/trained-agent.json')
    .then(m => { 
        currentModel = m;
        console.log('Loaded model');
    })
    .catch(e => {
        console.log('Failed to load model');
        console.log(e);
    });