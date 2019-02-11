import * as Matter from 'matter-js';
import * as $ from 'jquery';
import { BACKGROUND_COLOR, FOREGROUND_COLOR } from "./theme";

const worldBoundsOffest = 1;
const obstacleSize = 25;

let Engine = Matter.Engine,
    Render = Matter.Render,
    World = Matter.World,
    Body = Matter.Body,
    Bodies = Matter.Bodies,
    Events = Matter.Events,
    Query = Matter.Query,
    Mouse = Matter.Mouse,
    Vector = Matter.Vector;

const addItem = function(items, item) {
    if (item) {
        items.push(item);
    }
}

const removeItem = function(items, item) {
    if (!item) {
        return;
    }
    const index = items.lastIndexOf(item);
    if (index >= 0) {
        items.splice(index, 1);
    }
}

export function buildWorld(worldElement) {
    // No gravity, as we percieve our world from above - thus all bodies technically float in the air
    const engine = Engine.create();
    engine.world.gravity.x = 0;
    engine.world.gravity.y = 0;

    const width = worldElement.width();
    const height = worldElement.height();
    
    const render = Render.create({
        element: worldElement[0],
        engine: engine,
        options: {
            wireframes: false,
            width: width,
            height: height,
            showAngleIndicator: false,
            showVelocity: false,
            background: BACKGROUND_COLOR
        }
    });

    const mouse = Mouse.create(render.canvas);
    render.mouse = mouse;
    
    Render.run(render);
    Engine.run(engine);

    const obstacles = [];
    const allObstacles = [];
    //Add world boundaries
    let bounds = [
        //Top
        Bodies.rectangle(width / 2, worldBoundsOffest / 2, width, worldBoundsOffest, { 
            isStatic: true,
            render: {
                fillStyle: FOREGROUND_COLOR
            }
        }),
        //Right
        Bodies.rectangle(width - worldBoundsOffest / 2, height / 2, worldBoundsOffest, height, { 
            isStatic: true,
            render: {
                fillStyle: FOREGROUND_COLOR
            }
        }),
        //Bottom
        Bodies.rectangle(width / 2, height - worldBoundsOffest / 2, width, worldBoundsOffest, {
             isStatic: true,
             render: {
                 fillStyle: FOREGROUND_COLOR
             }
        }),
        //Left
        Bodies.rectangle(worldBoundsOffest / 2, height / 2, worldBoundsOffest, height, { 
            isStatic: true,
            render: {
                fillStyle: FOREGROUND_COLOR
            } 
        })
    ];
    World.add(engine.world, bounds);
    allObstacles.splice(0, 0, ...bounds);

    let mouseDownPosition;

    worldElement.on('mousedown', e => {
        if (e.altKey || e.ctrlKey || e.shiftKey) {
            return;
        }
        if (e.button === 0) {
            mouseDownPosition = Vector.clone(mouse.position);
        }
    });

    worldElement.click(e => {
        if (e.altKey || e.ctrlKey || e.shiftKey) {
            return;
        }
        if (!mouseDownPosition) {
            return;
        }
        if (e.button === 0) { 
            let mouseUpPosition = mouse.position;
            let distance = Math.sqrt((mouseUpPosition.x - mouseDownPosition.x) ** 2 + (mouseUpPosition.y - mouseDownPosition.y) ** 2);
            let obstacle;
            if (distance < obstacleSize) {
                obstacle = Bodies.circle(mouseUpPosition.x, mouseUpPosition.y, obstacleSize, {
                    isStatic: true,
                    restitution: 0.6,
                    render: {
                        fillStyle: FOREGROUND_COLOR
                    }
                });
            } else {
                let angle = Math.asin((mouseUpPosition.y - mouseDownPosition.y) / distance) * (Math.sign(mouseUpPosition.x - mouseDownPosition.x) || 1);
                let center = {
                    x: mouseDownPosition.x + (mouseUpPosition.x - mouseDownPosition.x) / 2,
                    y: mouseDownPosition.y + (mouseUpPosition.y - mouseDownPosition.y) / 2
                }
                obstacle = Bodies.rectangle(center.x, center.y, distance, 6, {
                    isStatic: true,
                    restitution: 0.6,
                    render: {
                        fillStyle: FOREGROUND_COLOR
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
    
    worldElement.on('contextmenu', e => {
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

    // Fit the render viewport to the scene
    Render.lookAt(render, {
        min: { x: 0, y: 0 },
        max: { x: window.screen.width, y: window.screen.height }
    });    

    $(document).on('keydown', e => {
        //CTRL + Z
        if (e.ctrlKey && e.keyCode == 90) {
            const obstacle = obstacles.pop();
            if (obstacle) {
                World.remove(engine.world, obstacle);
                allObstacles.pop();
            }
        }
    });

    const renderHandlers = [];

    Events.on(render, 'afterRender', function() {
        const context = render.context;
        Render.startViewTransform(render);
        for (const handler of renderHandlers) {
            handler(context);
        }
        if (mouseDownPosition) {
            context.strokeStyle = FOREGROUND_COLOR;
            context.setLineDash([6]);
            context.beginPath();
            context.moveTo(mouseDownPosition.x, mouseDownPosition.y);
            context.lineTo(mouse.position.x, mouse.position.y);
            context.stroke();
            
        } else if (mouse.position.x > 0 && mouse.position.y > 0) {
            context.strokeStyle = FOREGROUND_COLOR;
            context.setLineDash([6]);
            context.beginPath();
            context.arc(mouse.position.x, mouse.position.y, obstacleSize, 0, 2 * Math.PI);
            context.stroke();
        }
        Render.endViewTransform(render);
    });

    return {
        element: worldElement,
        engine: engine,
        render: render,
        obstacles: allObstacles,
        on: {
            render: function(handler) {
                addItem(renderHandlers, handler);
            }
        },
        off: {
            render: function(handler) {
                removeItem(renderHandlers, handler);
            }
        },
        addNewBody: function(options) {
            options = options || { isStatic: false };
        }
    }
}