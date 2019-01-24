// module aliases
var Engine = Matter.Engine,
    Render = Matter.Render,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Events = Matter.Events,
    Body = Matter.Body;

// create an engine
var engine = Engine.create();
engine.world.gravity.x = 0;
engine.world.gravity.y = 0;

var worldEl = $('#world');

var width = worldEl.width();
var height = worldEl.height();
// create a renderer
var render = Render.create({
    element: worldEl[0],
    engine: engine,
    options: {
        width: width,
        height: height,
        showAngleIndicator: true,
        showVelocity: true
    }
});

//Add world boundaries
var offset = 5;
World.add(engine.world, [
    //Top
    Bodies.rectangle(width / 2, offset, width, 2 * offset, { isStatic: true }),
    //Right
    Bodies.rectangle(width - offset, height / 2, 2 * offset, height, { isStatic: true }),
    //Bottom
    Bodies.rectangle(width / 2, height - offset, width, 2 * offset, { isStatic: true }),
    //Left
    Bodies.rectangle(offset, height / 2, 2 * offset, height, { isStatic: true })
]);

//Add some obstacles

World.add(engine.world, [
    Bodies.circle(200, 200, 40, { isStatic: true }),
    Bodies.circle(width - 200, 200, 40, { isStatic: true }),
    Bodies.circle(width - 200, height - 200, 40, { isStatic: true }),
    Bodies.circle(200, height - 200, 40, { isStatic: true })
]);

//Create our car
var car = Bodies.rectangle(width / 2, height / 2, 50, 25, {
    restitution: 0.3,
    frictionAir: 0.05
});
//car.frictionAir = 0;
Body.rotate(car, Math.PI / 2);
World.add(engine.world, car);

// run the engine
Engine.run(engine);

let ts = 0;

var velocityInc = 0.0025;
var angleInc = 0.015;
var updateFreq = 70

Events.on(engine, 'beforeUpdate', e => {
    if (e.timestamp > ts + updateFreq) {
        if (Math.random() < 0.8) {
            speedUp();
        } else {
            //turnLeft();
        }
        ts = e.timestamp;
    }
});

// run the renderer
Render.run(render);

 function turnLeft() { car.torque = -angleInc; }
 function turnRight() { car.torque = angleInc; }
// function turnLeft() { 
//     let left = car.axes[0];     
//     let forward = car.axes[1];
//     Body.applyForce(car, { x: car.position.x + forward.x * 50, y: car.position.y + forward.y * 25 }, {x: angleInc * left.x, y: angleInc * left.y });
// }
// function turnRight() {
//     let left = car.axes[0];    
//     let forward = car.axes[1];
//     Body.applyForce(car, { x: car.position.x + forward.x * 50, y: car.position.y + forward.y * 25 }, {x: -angleInc * left.x, y: -angleInc * left.y }); 
// }
function speedUp() { 
    let forward = car.axes[1];
    Body.applyForce(car, car.position, {x: velocityInc * forward.x , y: velocityInc * forward.y }); 
}
function slowDown() {    
    let forward = car.axes[1];
    Body.applyForce(car, car.position, {x: -velocityInc * forward.x, y: -velocityInc * forward.y }); 
}

$('#turnLeft').click(() => { turnLeft(); ts += 1.5 * updateFreq; });

$('#turnRight').click(() => { turnRight(); ts += 1.5 * updateFreq; });

$('#speedUp').click(() => { speedUp(); ts += 1.5 * updateFreq; });

$('#slowDown').click(() => { slowDown(); ts += 1.5 * updateFreq; });

$(document).on('keydown', e => {
    switch (e.keyCode) {
        //Left
        case 37:
            turnLeft();
            break;
        //Up
        case 38:
            speedUp();
            break;
        //Right
        case 39:
            turnRight();
            break;
        //Down
        case 40:
            slowDown();
            break;
        case 48:
            break;
    }
});