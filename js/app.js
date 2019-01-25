// module aliases
var Engine = Matter.Engine,
    Render = Matter.Render,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Events = Matter.Events,
    Query = Matter.Query,
    Body = Matter.Body,
    MouseConstraint = Matter.MouseConstraint,
    Mouse = Matter.Mouse;
    

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
var bounds = [
    //Top
    Bodies.rectangle(width / 2, offset, width, 2 * offset, { isStatic: true }),
    //Right
    Bodies.rectangle(width - offset, height / 2, 2 * offset, height, { isStatic: true }),
    //Bottom
    Bodies.rectangle(width / 2, height - offset, width, 2 * offset, { isStatic: true }),
    //Left
    Bodies.rectangle(offset, height / 2, 2 * offset, height, { isStatic: true })
];
World.add(engine.world, bounds);

//Add some obstacles
var obstacles = [
    Bodies.circle(200, 200, 40, { isStatic: true }),
    Bodies.circle(width - 200, 200, 40, { isStatic: true }),
    Bodies.circle(width - 200, height - 200, 40, { isStatic: true }),
    Bodies.circle(200, height - 200, 40, { isStatic: true })
];

World.add(engine.world, obstacles);

var allBodies = obstacles.concat(bounds);

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

var velocityInc = 0.003;
var angleInc = 0.03;
var updateFreq = 40

var isRunning = false;

Events.on(engine, 'beforeUpdate', e => {
    if (!isRunning) {
        return;
    }
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

$('#start').click(() => isRunning = true);

$('#stop').click(() => isRunning = false);

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
    }
});

Events.on(render, 'afterRender', function() {
    var mouse = mouseConstraint.mouse,
        context = render.context,
        bodies = allBodies, //Composite.allBodies(engine.world),
        startPoint = { x: width / 2, y: height / 2 },
        endPoint = mouse.position;

    var collisions = raycast(bodies, startPoint, endPoint);
    // var collisions = Query.ray(bodies, startPoint, endPoint);

    for (var i = 0; i < collisions.length; i++) {

        Render.startViewTransform(render);

        context.beginPath();
        var collision = collisions[i];
        
        context.moveTo(startPoint.x, startPoint.y);
        context.lineTo(collision.point.x, collision.point.y);
        if (collisions.length > 0) {
            context.strokeStyle = '#fff';
        } else {
            context.strokeStyle = '#555';
        }
        context.lineWidth = 0.5;
        context.stroke();

        context.rect(collision.point.x, collision.point.y, 4, 4);
        context.fillStyle = 'rgba(255,165,0,0.7)';
        context.fill();

        Render.endViewTransform(render);
        break;
    }
});

// add mouse control
var mouse = Mouse.create(render.canvas),
    mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.2,
            render: {
                visible: true
            }
        }
    });

World.add(engine.world, mouseConstraint);

// keep the mouse in sync with rendering
render.mouse = mouse;

Render.lookAt(render, {
    min: { x: 0, y: 0 },
    max: { x: width, y: height }
});