# Self-driving Car. Learning by Example

## Appetizer

Live environment can be found [here](https://demarsch.github.io/self-driving-car-sim/)

![Self-driving car](demo.gif)

## Introduction

[Reinforcement learning](https://en.wikipedia.org/wiki/Reinforcement_learning) refers to goal-oriented algorithms, which learn how to attain a complex objective (goal) or maximize along a particular dimension over many steps; for example, maximize the points won in a game over many moves. They can start from a blank slate, and under the right conditions they achieve superhuman performance. Like a child incentivized by spankings and candy, these algorithms are penalized when they make the wrong decisions and rewarded when they make the right ones – this is reinforcement.

However there are situations when the ideal/appropriate course of actions requires too many inputs or can't not be formally defined. And here comes extra techniques like [inverse reinforcement learning](https://en.wikipedia.org/wiki/Reinforcement_learning#Inverse_reinforcement_learning) and [apprenticeship learning](https://en.wikipedia.org/wiki/Apprenticeship_learning) or simply put "Learn by Example".

## Description

My project utilizes this concept in some way but by no means my implementation should be considered following any published academic researched. 

It consists of two main parts: an environment that emulates some of the real world concepts e.g. mass, force, intertia, friction and contains physical bodies (obstacles) and an agent (car) that can observe and record human player actions and then try to learn this behavior and apply it to the unknown situations.

The car's brain is represented by a simple neural network (NN) with fixed number of inputs (obstacle position data comes from front and rear sensors), a hidden layer with triple the number of inputs or 100 (whichever is greater) and 9 outputs that represent the possible set of two actions taken at any given moment: one of the move actions (No action, move forward/speed up, move backward/slow down) and one of the turn actions (No action, turn right, turn left).

The human player starts recording and manully controls the car with the arrow keys. Later when he decides that enough positions have been recorded, he commits the recorded data which triggers the creation and fitting the new NN. After this he can start the self-driving mode and this NN begins to process the car inputs and predict the action/actions needed to be taken. At any given moment human player can add more obstacles to the world (or remove the existing ones) and perform new actions (which can in turn be recorded and used to further hone the car skills)

## Technology Stack

The whole application is built using client-side only technologies (HTML, CSS, JavaScript) thus requires no special deployment.

The environment is built using [matter.js](http://brm.io/matter-js/) physics engine and utilizes [Technostalgic](https://github.com/Technostalgic) implementation of [raycasting algorithm](https://github.com/Technostalgic/MatterJS_Raycast).

UI and styling is done with the help of [Bootstrap](https://getbootstrap.com/) and [jQuery](https://jquery.com/)

Machine learning part is built using [Tensorflow.js](https://js.tensorflow.org/)
