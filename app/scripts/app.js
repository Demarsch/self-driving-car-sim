import './../styles/styles.scss';
import * as $ from 'jquery';
import * as Matter from 'matter-js';
import { buildWorld } from './world';
import Car from './car';
import { FOREGROUND_COLOR } from "./theme";

const Bodies = Matter.Bodies,
      World = Matter.World,
      Events = Matter.Events;

const carHeight = 50,
      carWidth = 25,
      carRestitution = 0.3,
      carFriction = 0.05;

let showSpotlight = false;
let showSensors = false;
let isRecording = false;
let isMoving = false;
let showOverlay = true;

const cars = [];
let selectedCar = null;

function addCar(world) {
    const width = world.element.width();
    const height = world.element.height();
    const body = Bodies.rectangle(width / 2 - 100 + Math.random() * 200, height / 2 - 100 + Math.random() * 200, carHeight, carWidth, {
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
    World.add(world.engine.world, body);
    const car = new Car(body);
    cars.push(car);
    if (!selectedCar) {
        selectedCar = car;
    }
    return car;
}

const world = buildWorld($('.world'));
world.on.render(context => {
    if (!selectedCar) {
        return;F
    }
    if (showSpotlight) {    
        context.fillStyle = FOREGROUND_COLOR;
        context.beginPath();
        context.arc(selectedCar.body.position.x, selectedCar.body.position.y, selectedCar.fovDistance, 0, 2 * Math.PI);
        context.rect(world.element.width(), 0, -world.element.width(), world.element.height());
        context.fill();
    }
    if (showSensors) {
        let sensorData = selectedCar.sensorData;
        for (let i = 0; i < sensorData.length; i++) {
            let sensor = sensorData[i];
            if (sensor.collides) {
                context.fillStyle = 'red';                
                context.fillRect(sensor.point.x - 4, sensor.point.y - 4, 5, 5);
            } else {
                context.fillStyle = FOREGROUND_COLOR;                
                context.fillRect(sensor.point.x - 2, sensor.point.y - 2, 3, 3);
            }
        }
    }
});

addCar(world);

let tickFrequency = 50;
//const totalSensors = frontSensors + rearSensors;

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
        result.add(selectedCar.moveForward);
        selectedCar.moveForward();
    }
    //Down
    if (keys.has(40)) {
        moveAction = 2;
        result.add(selectedCar.moveBackward);
        selectedCar.moveBackward();
    }
    //Left
    if (keys.has(37)) {
        turnAction = 1;
        result.add(selectedCar.turnLeft);
        selectedCar.turnLeft();
    }
    //Right
    if (keys.has(39)) {
        turnAction = 2;
        result.add(selectedCar.turnRight);
        selectedCar.turnRight();
    }
    //action = moveAction * turnActions.length + turnAction;
    // if (action !== 0 && isRecording) {
    //     let sensorData = car.sensorData.map(s => s.distanceRel);
    //     if (recordLearningData(sensorData, action)) {
    //         $('#learnedIterations').text(`${learningData.length} position${learningData.length === 1 ? '' : 's'} ${learningData.length === 1 ? 'has' : 'have'}`);
    //     }
    // }
    return result;
}

let ts = 0;

let currentModel = null;

Events.on(world.engine, 'beforeUpdate', e => {
    for (let car of cars) {
        car.updateSensorData(world.obstacles);
    }
    if (e.timestamp < ts + tickFrequency) {
        return;
    }
    ts = e.timestamp;
    let keyboardActions = keyboardHandler();
    for (let car of cars) {
        //If user starts to drive himself, we suspend all autoprocessing
        if (keyboardActions.size && car === selectedCar) {
            return;
        }
        let sensorData = car.sensorData.map(s => s.distanceRel);
        if (isMoving && currentModel) {
            tf.tidy(() => {            
                let sensorTensor = tf.tensor2d(sensorData, [1, sensorData.length]);
                let predict = currentModel.predict(sensorTensor).flatten();
                let action = predict.argMax().get();
                car.turnActions[action % car.turnActions.length]();
                car.moveActions[Math.floor(action / car.turnActions.length)]();
            });
        }
    }
});

// let learningData = [];
// let learningLabels = [];
// let learningHash = new Map();

// function recordLearningData(sensorData, action) {
//     let sensorHash = Math.round(sensorData.reduce((x, y) => x + y, 0) * 10e8);
//     let hashBucket = learningHash.get(sensorHash);
//     let result = false;
//     if (hashBucket) {
//         let found = true;
//         for (var i = 0; i < hashBucket.length; i++) {
//             found = true;
//             let hashBucketItem = hashBucket[i];
//             for (var j = 0; j < sensorData.length; j++) {
//                 if (sensorData[j] !== hashBucketItem[j]) {
//                     found = false;
//                     break;
//                 }
//             }
//             if (found) {
//                 break;
//             }
//         }
//         if (!found) {
//             hashBucket.push(sensorData);
//             result = true;
//         } 
//     } else {
//         hashBucket = [sensorData];
//         learningHash.set(sensorHash, hashBucket);
//         result = true;
//     }
//     if (result) {        
//         learningData.push(sensorData)
//         learningLabels.push(action);
//     }
//     return result;
// }


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
    let btn = $('#recording');   
    isRecording = typeof on === 'undefined' ? !isRecording : on;
    btn.toggleClass('on', isRecording);
    let enableRecordingContainer = isRecording || learningData.length;
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
    Body.setPosition(selectedCar.body,  { x: width * (0.1 + 0.8 * Math.random()), y: height * (0.1 + 0.8 * Math.random()) });
    Body.setAngle(selectedCar.body, Math.random() * Math.PI);
});

// $('#explosion').click(() => {
//     var forceMagnitude = obstacleMass / 50;
//     for (let obstacle of obstacles) {
//         Body.applyForce(obstacle, obstacle.position, {
//             x: (forceMagnitude + Common.random() * forceMagnitude) * Common.choose([1, -1]), 
//             y: -forceMagnitude + Common.random() * -forceMagnitude * Common.choose([1, -1])
//         });        
//     }
// });

// $('.toolbar').on('mouseup', () => {
//     mouseDownPosition = null;
// });

$('#sensors').click(() => {
    toggleSensors();
});

$('#spotlight').click(() => {
    toggleSpotlight();
});

$('#move').click(() => {
    toggleAutoMove();
});

// $('#recording').click(e => {
//     toggleRecording();
//     if (isRecording) {
//         toggleAutoMove(false);
//         toggleSensors(true);
//         if (currentModel) {
//             currentModel.dispose();
//             currentModel = null;
//         }
//     }
// });

// $('#applyModel').click(async () => {
//     if (!learningData.length) {
//         return;
//     }
//     const epochs = 40;
//     let modal = $('#progressModal');
//     modal.modal('show');
//     let xs = null;
//     let ys = null;
//     try {
//         let model = tf.sequential();
//         model.add(tf.layers.dense({
//             units: Math.max(100, totalSensors * 2),
//             inputShape: [totalSensors],
//             activation: 'relu'
//             }));
//         model.add(tf.layers.dense({
//             units: moveActions.length * turnActions.length,
//             activation: 'softmax'
//         }));
//         model.compile({
//             loss: 'categoricalCrossentropy',
//             optimizer: 'sgd'
//         });
//         const xs = tf.tensor2d(learningData, [learningData.length, totalSensors]);
//         const ys = tf.tidy(() => tf.oneHot(tf.tensor1d(learningLabels, 'int32'), moveActions.length * turnActions.length));
//         await model.fit(xs, ys, {
//             epochs: epochs,
//             yieldEvery : 'epoch'
//         });
//         if (currentModel) {
//             currentModel.dispose();
//         }
//         currentModel = model;
//     } finally {
//         if (xs) {
//             xs.dispose();
//         }
//         if (ys) {
//             ys.dispose();
//         }
//         modal.modal('hide');
//     }
// });

// $('#discardModel').click(() => {
//     if (currentModel) {
//         currentModel.dispose();
//         currentModel = null;
//     }
//     learningData.length = 0;
//     learningHash.clear();
//     learningLabels.length = 0;
//     toggleAutoMove(false);
//     $('#learnedIterations').text('No positions have');
// });

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
